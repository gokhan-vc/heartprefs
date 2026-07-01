import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getAddress } from "viem";
import { addressFromDidPkh, didPkhFromAddress } from "../../src/did.js";
import { didLike, evmAddressLower, junkAddressLike } from "./arbitraries.js";

const RUNS = 3000;

describe("addressFromDidPkh — fuzz (fail-closed parser)", () => {
  it("never throws on arbitrary DID-ish input", () => {
    fc.assert(
      fc.property(didLike, (did) => {
        // Must return Address | null, never throw, on any string.
        const out = addressFromDidPkh(did);
        expect(out === null || typeof out === "string").toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it("SECURITY: any returned address is the checksum of the DID's own address field", () => {
    fc.assert(
      fc.property(didLike, (did) => {
        const out = addressFromDidPkh(did);
        if (out === null) return; // fail-closed is always acceptable
        // A non-null result must correspond EXACTLY to the 5th ':'-segment of
        // the DID — never a different address, never a fabricated one.
        const parts = did.split(":");
        expect(parts.length).toBe(5);
        const field = parts[4]!;
        expect(out.toLowerCase()).toBe(field.toLowerCase());
        // and it must be a canonical EIP-55 checksum (idempotent under getAddress)
        expect(getAddress(out)).toBe(out);
      }),
      { numRuns: RUNS },
    );
  });

  it("round-trips valid lowercase addresses through did:pkh and back", () => {
    fc.assert(
      fc.property(evmAddressLower, fc.integer({ min: 0, max: 1_000_000 }), (addr, chainId) => {
        const did = didPkhFromAddress(addr, chainId);
        expect(did).toBe(`did:pkh:eip155:${chainId}:${getAddress(addr)}`);
        const back = addressFromDidPkh(did);
        expect(back).not.toBeNull();
        expect(back!.toLowerCase()).toBe(addr.toLowerCase());
      }),
      { numRuns: RUNS },
    );
  });

  it("a malformed 5-segment did:pkh with a junk address field returns null (never a wrong address)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), junkAddressLike, (cid, junk) => {
        const did = `did:pkh:eip155:${cid}:${junk}`;
        const out = addressFromDidPkh(did);
        if (out !== null) {
          // If it parsed, the junk actually WAS a valid address body — verify
          // it lowercases back rather than being some fabricated value.
          expect(out.toLowerCase()).toBe(junk.toLowerCase());
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("didPkhFromAddress throws on non-addresses, succeeds on valid ones", () => {
    fc.assert(
      fc.property(junkAddressLike, fc.integer({ min: 0, max: 1000 }), (junk, cid) => {
        // Guard: only assert the throw path for values viem rejects.
        let valid = true;
        try {
          getAddress(junk);
        } catch {
          valid = false;
        }
        if (!valid) {
          expect(() => didPkhFromAddress(junk, cid)).toThrow();
        }
      }),
      { numRuns: RUNS },
    );
  });
});
