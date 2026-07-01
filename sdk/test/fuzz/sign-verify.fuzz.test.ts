import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { privateKeyToAccount } from "viem/accounts";
import { buildDoc } from "../../src/build.js";
import { signDoc, verifyDoc } from "../../src/sign.js";
import { canonicalForSigning } from "../../src/canonical.js";
import { didPkhFromAddress } from "../../src/did.js";
import type { HeartPrefs } from "../../src/types.js";
import { privateKeyHex, selfArb, seekArb, token } from "./arbitraries.js";

// Async property runs are heavier (ECDSA sign+recover); keep counts modest.
const RUNS = 120;

/** Build a signable doc whose subject matches the given key. */
function docForKey(priv: `0x${string}`, self: Record<string, unknown>, seek: Record<string, unknown>, id: string) {
  const account = privateKeyToAccount(priv);
  const subject = didPkhFromAddress(account.address, 8453);
  return buildDoc({
    id: id || "urn:heartprefs:fuzz",
    self: self as never,
    seek: seek as never,
    identity: { subject },
    created: "2026-06-30T00:00:00Z",
    nonce: "fuzz-nonce",
  });
}

describe("signDoc → verifyDoc — fuzz (crypto round-trip)", () => {
  it("a freshly signed doc always verifies to its subject", async () => {
    await fc.assert(
      fc.asyncProperty(privateKeyHex, selfArb, seekArb, token, async (priv, self, seek, id) => {
        const account = privateKeyToAccount(priv as `0x${string}`);
        const doc = docForKey(priv as `0x${string}`, self, seek, id);
        const signed = await signDoc(doc, priv);
        const res = await verifyDoc(signed);
        expect(res.valid).toBe(true);
        expect(res.recovered.toLowerCase()).toBe(account.address.toLowerCase());
      }),
      { numRuns: RUNS },
    );
  });

  it("SECURITY: mutating age after signing fails verification (fail-closed tamper detection)", async () => {
    await fc.assert(
      fc.asyncProperty(
        privateKeyHex,
        selfArb,
        seekArb,
        fc.integer({ min: 0, max: 200 }),
        async (priv, self, seek, newAge) => {
          const doc = docForKey(priv as `0x${string}`, self, seek, "urn:heartprefs:tamper");
          const signed = await signDoc(doc, priv);
          const tampered: HeartPrefs = JSON.parse(JSON.stringify(signed));
          fc.pre(tampered.self.age !== newAge); // only test a real change
          tampered.self.age = newAge;
          const res = await verifyDoc(tampered);
          // The recovered signer must NOT be the subject → invalid.
          expect(res.valid).toBe(false);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("SECURITY: swapping the signature to another key's signature fails", async () => {
    await fc.assert(
      fc.asyncProperty(privateKeyHex, privateKeyHex, selfArb, seekArb, async (privA, privB, self, seek) => {
        const accA = privateKeyToAccount(privA as `0x${string}`);
        const accB = privateKeyToAccount(privB as `0x${string}`);
        fc.pre(accA.address.toLowerCase() !== accB.address.toLowerCase());
        // Sign the SAME canonical payload (subject=A) with key B, splice B's sig in.
        const doc = docForKey(privA as `0x${string}`, self, seek, "urn:heartprefs:swap");
        const signedA = await signDoc(doc, privA);
        const message = canonicalForSigning(signedA);
        const forgedSig = await accB.signMessage({ message });
        const forged: HeartPrefs = { ...signedA, proof: { ...signedA.proof, signature: forgedSig } };
        const res = await verifyDoc(forged);
        // recovers to B, subject is A → invalid.
        expect(res.valid).toBe(false);
        expect(res.recovered.toLowerCase()).toBe(accB.address.toLowerCase());
      }),
      { numRuns: RUNS },
    );
  });

  it("SECURITY: tampering with a non-signature proof field (nonce) fails verification", async () => {
    await fc.assert(
      fc.asyncProperty(privateKeyHex, selfArb, seekArb, token, async (priv, self, seek, newNonce) => {
        const doc = docForKey(priv as `0x${string}`, self, seek, "urn:heartprefs:nonce");
        const signed = await signDoc(doc, priv);
        fc.pre((signed.proof.nonce ?? "") !== newNonce);
        const tampered: HeartPrefs = JSON.parse(JSON.stringify(signed));
        tampered.proof.nonce = newNonce;
        const res = await verifyDoc(tampered);
        expect(res.valid).toBe(false);
      }),
      { numRuns: RUNS },
    );
  });

  it("verifyDoc fails-closed (valid:false, no throw) when verificationMethod != subject", async () => {
    await fc.assert(
      fc.asyncProperty(privateKeyHex, selfArb, seekArb, async (priv, self, seek) => {
        const doc = docForKey(priv as `0x${string}`, self, seek, "urn:heartprefs:vm");
        const signed = await signDoc(doc, priv);
        const tampered: HeartPrefs = JSON.parse(JSON.stringify(signed));
        tampered.proof.verificationMethod = "did:web:evil.example";
        const res = await verifyDoc(tampered);
        expect(res.valid).toBe(false);
        expect(res.reason).toMatch(/verificationMethod/);
      }),
      { numRuns: 60 },
    );
  });
});
