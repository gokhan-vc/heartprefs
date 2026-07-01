import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { canonicalForSigning } from "../../src/canonical.js";
import type { HeartPrefs } from "../../src/types.js";
import { looseDocArb, jsonValue } from "./arbitraries.js";

const RUNS = 2000;

describe("canonicalForSigning — fuzz", () => {
  it("never throws on an object-shaped doc (no-throw decoder)", () => {
    fc.assert(
      fc.property(looseDocArb, (doc) => {
        // The realistic untrusted input is a parsed JSON object. It must
        // canonicalize without throwing regardless of missing/wrong-typed keys.
        const out = canonicalForSigning(doc as unknown as HeartPrefs);
        expect(typeof out).toBe("string");
      }),
      { numRuns: RUNS },
    );
  });

  it("is idempotent: canon(parse(canon(doc))) === canon(doc)", () => {
    fc.assert(
      fc.property(looseDocArb, (doc) => {
        const c1 = canonicalForSigning(doc as unknown as HeartPrefs);
        // A canonical string is itself valid JSON; re-canonicalizing its parse
        // must be a fixed point.
        const reparsed = JSON.parse(c1);
        const c2 = canonicalForSigning(reparsed as HeartPrefs);
        expect(c2).toBe(c1);
      }),
      { numRuns: RUNS },
    );
  });

  it("strips ONLY proof.signature — every other field is signed", () => {
    fc.assert(
      fc.property(
        looseDocArb,
        fc.string(),
        fc.string(),
        (doc, sigA, sigB) => {
          fc.pre(sigA !== sigB);
          const withProof = {
            ...doc,
            proof: { ...(doc.proof ?? {}), type: "EIP191", verificationMethod: "x" },
          } as Record<string, unknown>;
          const a = canonicalForSigning({ ...withProof, proof: { ...(withProof.proof as object), signature: sigA } } as unknown as HeartPrefs);
          const b = canonicalForSigning({ ...withProof, proof: { ...(withProof.proof as object), signature: sigB } } as unknown as HeartPrefs);
          // Changing ONLY the signature must NOT change the signed bytes.
          expect(a).toBe(b);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("SECURITY: mutating any proof field OTHER than signature changes the bytes", () => {
    fc.assert(
      fc.property(
        looseDocArb,
        fc.constantFrom("type", "verificationMethod", "created", "nonce"),
        fc.string(),
        fc.string(),
        (doc, field, vA, vB) => {
          fc.pre(vA !== vB);
          const base = {
            ...doc,
            proof: { type: "EIP191", verificationMethod: "m", created: "t", nonce: "n", signature: "0xsig" },
          } as Record<string, unknown>;
          const mk = (v: string) =>
            canonicalForSigning({
              ...base,
              proof: { ...(base.proof as Record<string, unknown>), [field]: v },
            } as unknown as HeartPrefs);
          // A non-signature proof field IS part of the signed payload, so
          // distinct values MUST yield distinct canonical bytes. If this ever
          // fails, a class of proof-substitution attacks becomes possible.
          expect(mk(vA)).not.toBe(mk(vB));
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("does not mutate its input (proof.signature survives on the original)", () => {
    fc.assert(
      fc.property(looseDocArb, (doc) => {
        const withSig = { ...doc, proof: { ...(doc.proof ?? {}), signature: "0xKEEPME" } } as Record<string, unknown>;
        const snapshot = JSON.stringify(withSig);
        canonicalForSigning(withSig as unknown as HeartPrefs);
        expect(JSON.stringify(withSig)).toBe(snapshot);
      }),
      { numRuns: RUNS },
    );
  });

  it("key order is normalized: two key-permuted objects canonicalize equal", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), jsonValue, { maxKeys: 8 }), (obj) => {
        const keys = Object.getOwnPropertyNames(obj);
        fc.pre(keys.length >= 2);
        // Build the key-reversed object with defineProperty so that a literal
        // "__proto__" key becomes a real OWN property (bracket assignment would
        // hit the prototype setter and silently drop it, unlike JSON.parse).
        const reversed: Record<string, unknown> = {};
        for (const k of [...keys].reverse()) {
          Object.defineProperty(reversed, k, {
            value: (obj as Record<string, unknown>)[k],
            enumerable: true,
            writable: true,
            configurable: true,
          });
        }
        const a = canonicalForSigning(obj as unknown as HeartPrefs);
        const b = canonicalForSigning(reversed as unknown as HeartPrefs);
        expect(a).toBe(b);
      }),
      { numRuns: RUNS },
    );
  });
});
