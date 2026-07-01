import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validate } from "../../src/validate.js";
import { publicProjection } from "../../src/build.js";
import type { HeartPrefs } from "../../src/types.js";
import { looseDocArb, jsonValue, token } from "./arbitraries.js";

const RUNS = 2000;

describe("validate — fuzz (never throws, fails-closed)", () => {
  it("never throws on arbitrary JSON values; always returns a boolean verdict", () => {
    fc.assert(
      fc.property(jsonValue, (v) => {
        const r = validate(v);
        expect(typeof r.valid).toBe("boolean");
        expect(Array.isArray(r.errors)).toBe(true);
        // invalid must carry at least one ajv error; valid must carry none.
        if (r.valid) expect(r.errors).toHaveLength(0);
        else expect(r.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: RUNS },
    );
  });

  it("never throws on loosely-shaped documents", () => {
    fc.assert(
      fc.property(looseDocArb, (doc) => {
        const r = validate(doc);
        expect(typeof r.valid).toBe("boolean");
      }),
      { numRuns: RUNS },
    );
  });

  it("no-ReDoS: format-checked fields (adversarial date/uri strings) validate fast", () => {
    // Strings crafted to stress a naive date-time / uri regex. ajv-formats uses
    // linear-time checks; assert the call returns well under a generous budget.
    const evil = fc.oneof(
      fc.array(fc.constantFrom("0", "-", ":", "T", "Z", "."), { minLength: 0, maxLength: 400 }).map((a) => a.join("")),
      fc.array(fc.constantFrom("a", ".", "/", ":", "@"), { minLength: 0, maxLength: 400 }).map((a) => a.join("")),
    );
    fc.assert(
      fc.property(evil, evil, (created, schemaUri) => {
        const doc = {
          $schema: schemaUri,
          version: "0.1.0",
          kind: "heartprefs",
          id: "urn:heartprefs:redos",
          self: { age: 30 },
          seek: {},
          free: {},
          identity: { subject: "did:pkh:eip155:1:0x0000000000000000000000000000000000000001" },
          proof: { type: "EIP191", verificationMethod: "x", created, signature: "0x1" },
        };
        const t0 = Date.now();
        validate(doc);
        expect(Date.now() - t0).toBeLessThan(1000);
      }),
      { numRuns: 600 },
    );
  });
});

describe("publicProjection — fuzz (always strips gated keys, never mutates input)", () => {
  it("strips free.desire and free.boundaries regardless of what else is present", () => {
    const freeArb = fc.dictionary(token, fc.string(), { maxKeys: 8 });
    fc.assert(
      fc.property(freeArb, fc.string(), fc.string(), (free, desire, boundaries) => {
        const doc = {
          version: "0.1.0",
          kind: "heartprefs",
          id: "x",
          self: { age: 30 },
          seek: {},
          free: { ...free, desire, boundaries },
          identity: { subject: "did:x" },
          proof: { type: "EIP191", verificationMethod: "did:x", signature: "0x1" },
        } as unknown as HeartPrefs;
        const before = JSON.stringify(doc);
        const pub = publicProjection(doc);
        // gated keys gone from the projection...
        expect((pub.free as Record<string, unknown>).desire).toBeUndefined();
        expect((pub.free as Record<string, unknown>).boundaries).toBeUndefined();
        // ...but the original doc is untouched.
        expect(JSON.stringify(doc)).toBe(before);
      }),
      { numRuns: RUNS },
    );
  });

  it("is a no-op safe when free is absent/odd (never throws)", () => {
    fc.assert(
      fc.property(fc.option(jsonValue, { nil: undefined }), (free) => {
        const doc = { version: "0.1.0", kind: "heartprefs", free } as unknown as HeartPrefs;
        const pub = publicProjection(doc);
        expect(pub).toBeDefined();
      }),
      { numRuns: RUNS },
    );
  });
});
