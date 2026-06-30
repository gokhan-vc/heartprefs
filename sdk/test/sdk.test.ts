import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildDoc,
  signDoc,
  verifyDoc,
  recoverSigner,
  validate,
  matches,
  publicProjection,
  canonicalForSigning,
  didPkhFromAddress,
  addressFromDidPkh,
  type HeartPrefs,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

// A deterministic test key (well-known Anvil/Hardhat account #0).
const PRIV =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const account = privateKeyToAccount(PRIV);
const SUBJECT = didPkhFromAddress(account.address, 8453);

function freshDoc() {
  return buildDoc({
    id: "urn:heartprefs:01J9X8ZK3M0TEST0000000",
    self: {
      gender: "woman",
      age: 31,
      ethnicity: ["turkish"],
      kids: "none-want-some",
      substances: { alcohol: "sometimes", tobacco: "never" },
      languages: ["tr", "en"],
    },
    seek: {
      genders: ["man"],
      ageRange: { min: 30, max: 45 },
      languages: ["en"],
      ethnicities: [],
      dealbreakers: ["smoking", "wants-no-kids"],
    },
    free: { about: "Lives by the tide charts.", desire: "", boundaries: "" },
    identity: { subject: SUBJECT },
    attestation: { ageOver18: true },
    created: "2026-06-30T00:00:00Z",
    nonce: "fixed-nonce-for-test",
  });
}

describe("did helpers", () => {
  it("round-trips address <-> did:pkh", () => {
    const did = didPkhFromAddress(account.address, 8453);
    expect(did).toBe(`did:pkh:eip155:8453:${account.address}`);
    expect(addressFromDidPkh(did)?.toLowerCase()).toBe(
      account.address.toLowerCase(),
    );
  });

  it("returns null for non did:pkh subjects", () => {
    expect(addressFromDidPkh("did:web:ishtar.numetal.xyz")).toBeNull();
  });
});

describe("buildDoc", () => {
  it("assembles a schema-shaped doc with an unsigned proof scaffold", () => {
    const doc = freshDoc();
    expect(doc.kind).toBe("heartprefs");
    expect(doc.version).toBe("0.1.0");
    expect(doc.$schema).toBe("https://w3id.org/heartprefs/0.1/schema.json");
    expect(doc.proof?.type).toBe("EIP191");
    expect(doc.proof?.verificationMethod).toBe(SUBJECT);
    expect(doc.proof?.signature).toBeUndefined();
  });
});

describe("sign -> verify round trip", () => {
  it("verifies and recovers to the signer address (private key)", async () => {
    const signed = await signDoc(freshDoc(), PRIV);
    expect(signed.proof.signature).toMatch(/^0x[0-9a-fA-F]+$/);

    const result = await verifyDoc(signed);
    expect(result.valid).toBe(true);
    expect(result.recovered.toLowerCase()).toBe(account.address.toLowerCase());
    expect(result.subject?.toLowerCase()).toBe(account.address.toLowerCase());

    const recovered = await recoverSigner(signed);
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("verifies when signing with a viem LocalAccount", async () => {
    const signed = await signDoc(freshDoc(), account);
    const result = await verifyDoc(signed);
    expect(result.valid).toBe(true);
    expect(result.recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("fails verification when the document is tampered after signing", async () => {
    const signed = await signDoc(freshDoc(), PRIV);
    const tampered: HeartPrefs = JSON.parse(JSON.stringify(signed));
    tampered.self.age = 99; // mutate a signed field
    const result = await verifyDoc(tampered);
    expect(result.valid).toBe(false);
    expect(result.recovered.toLowerCase()).not.toBe(
      account.address.toLowerCase(),
    );
  });

  it("canonicalization ignores only proof.signature, not other proof fields", () => {
    const doc = freshDoc();
    const c1 = canonicalForSigning({
      ...doc,
      proof: { ...doc.proof!, signature: "0xdead" },
    } as HeartPrefs);
    const c2 = canonicalForSigning({
      ...doc,
      proof: { ...doc.proof!, signature: "0xbeef" },
    } as HeartPrefs);
    expect(c1).toBe(c2); // signature stripped
    // changing the nonce DOES change the canonical bytes
    const c3 = canonicalForSigning({
      ...doc,
      proof: { ...doc.proof!, nonce: "other", signature: "0xdead" },
    } as HeartPrefs);
    expect(c3).not.toBe(c1);
  });

  it("refuses to sign when the key does not match a did:pkh subject", async () => {
    const doc = buildDoc({
      ...({ id: "urn:heartprefs:mismatch", self: { age: 30 }, seek: {} } as const),
      identity: {
        subject: "did:pkh:eip155:8453:0x0000000000000000000000000000000000000001",
      },
    });
    await expect(signDoc(doc, PRIV)).rejects.toThrow(/does not match/);
  });
});

describe("validate against the frozen schema", () => {
  it("accepts examples/minimal.json (the canonical example)", () => {
    const raw = readFileSync(
      join(repoRoot, "examples", "minimal.json"),
      "utf8",
    );
    const example = JSON.parse(raw);
    const result = validate(example);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a freshly built + signed doc", async () => {
    const signed = await signDoc(freshDoc(), PRIV);
    const result = validate(signed);
    expect(result.valid).toBe(true);
  });

  it("rejects a malformed doc (missing required members + bad kind)", () => {
    const bad = {
      version: "0.1.0",
      kind: "not-heartprefs",
      // missing id, self, seek, free, identity, proof
    };
    const result = validate(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects a doc with an under-age self (age < 18)", () => {
    const doc = freshDoc();
    (doc.self as { age: number }).age = 16;
    const result = validate(doc);
    expect(result.valid).toBe(false);
  });

  it("rejects unknown keys in self (additionalProperties:false)", () => {
    const doc = freshDoc() as Record<string, unknown>;
    (doc.self as Record<string, unknown>).hairColor = "auburn";
    const result = validate(doc);
    expect(result.valid).toBe(false);
  });
});

describe("matches (bilateral, dealbreakers hard)", () => {
  // Base: a woman seeking a man, and a man seeking a woman — mutual.
  function womanDoc(overrides: Record<string, unknown> = {}) {
    return buildDoc({
      id: "urn:heartprefs:woman",
      self: { gender: "woman", age: 31, languages: ["en"], kids: "none-want-some" },
      seek: {
        genders: ["man"],
        ageRange: { min: 30, max: 45 },
        languages: ["en"],
        dealbreakers: ["smoking"],
      },
      identity: { subject: SUBJECT },
      ...overrides,
    });
  }
  function manDoc(overrides: Partial<{ self: Record<string, unknown>; seek: Record<string, unknown> }> = {}) {
    return buildDoc({
      id: "urn:heartprefs:man",
      self: {
        gender: "man",
        age: 34,
        languages: ["en"],
        substances: { tobacco: "never" },
        ...(overrides.self ?? {}),
      },
      seek: {
        genders: ["woman"],
        ageRange: { min: 28, max: 40 },
        languages: ["en"],
        ...(overrides.seek ?? {}),
      },
      identity: { subject: SUBJECT },
    });
  }

  it("matches a mutually-compatible pair", () => {
    const result = matches(womanDoc(), manDoc());
    expect(result.match).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("respects a dealbreaker (smoking) as a hard exclusion", () => {
    const smoker = manDoc({ self: { substances: { tobacco: "yes" } } });
    const result = matches(womanDoc(), smoker);
    expect(result.match).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/dealbreaker "smoking"/);
  });

  it("respects a tag-style dealbreaker via self.kids", () => {
    const woman = womanDoc({
      seek: {
        genders: ["man"],
        ageRange: { min: 30, max: 45 },
        languages: ["en"],
        dealbreakers: ["none-want-none"],
      },
    });
    const manNoKids = manDoc({ self: { kids: "none-want-none" } });
    const result = matches(woman, manNoKids);
    expect(result.match).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/dealbreaker "none-want-none"/);
  });

  it("rejects on a hard gender filter", () => {
    const womanSeekingWoman = womanDoc({
      seek: { genders: ["woman"], ageRange: { min: 30, max: 45 }, languages: ["en"] },
    });
    const result = matches(womanSeekingWoman, manDoc());
    expect(result.match).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/gender/);
  });

  it("rejects on an age-range filter (out of bounds in one direction)", () => {
    const olderMan = manDoc({ self: { age: 60 } });
    const result = matches(womanDoc(), olderMan);
    expect(result.match).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/above max/);
  });

  it("rejects when there is no shared sought language", () => {
    const trOnly = manDoc({ self: { languages: ["tr"] } });
    const result = matches(womanDoc(), trOnly);
    expect(result.match).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/shared sought language/);
  });
});

describe("publicProjection", () => {
  it("strips gated keys (free.desire, free.boundaries)", () => {
    const doc = freshDoc();
    (doc.free as Record<string, string>).desire = "secret";
    (doc.free as Record<string, string>).boundaries = "private";
    const pub = publicProjection(doc);
    expect(pub.free?.desire).toBeUndefined();
    expect(pub.free?.boundaries).toBeUndefined();
    // original is untouched
    expect(doc.free?.desire).toBe("secret");
  });
});
