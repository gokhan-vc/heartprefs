/**
 * Shared fast-check arbitraries for the HeartPrefs SDK fuzz suite.
 *
 * fast-check 4.x notes (this repo):
 *   - There is NO fc.stringOf / fc.hexaString. Build constrained strings via
 *     fc.array(fc.constantFrom(...parts), {min,max}).map(a => a.join('')).
 *   - Keep JSON-value arbitraries free of NaN/Infinity/undefined/functions only
 *     where a surface would otherwise legitimately reject them; the decoders
 *     under test are expected to tolerate arbitrary *object-shaped* JSON.
 */
import fc from "fast-check";

const HEX_NIBBLES = "0123456789abcdef".split("");
const HEX_NIBBLES_UPPER = "0123456789abcdefABCDEF".split("");

/** A lowercase 40-nibble hex body (no 0x). Always a VALID EVM address body. */
export const hex40Lower = fc
  .array(fc.constantFrom(...HEX_NIBBLES), { minLength: 40, maxLength: 40 })
  .map((a) => a.join(""));

/** A valid lowercase 0x-prefixed EVM address (isAddress-true, any checksum). */
export const evmAddressLower = hex40Lower.map((body) => `0x${body}`);

/** A 0x-prefixed private key (32 bytes = 64 nibbles), non-zero-ish. */
export const privateKeyHex = fc
  .array(fc.constantFrom(...HEX_NIBBLES), { minLength: 64, maxLength: 64 })
  // avoid the all-zero key (invalid for secp256k1) by forcing a non-zero nibble.
  .map((a) => {
    const s = a.join("");
    return s === "0".repeat(64) ? `0x${"0".repeat(63)}1` : `0x${s}`;
  });

/** Arbitrary short tokens/labels used across self/seek fields. */
export const token = fc
  .array(
    fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_ ".split(
        "",
      ),
      // include a handful of tricky chars that stress case-folding / trimming
      ..."İıÇçß\t\n".split(""),
    ),
    { minLength: 0, maxLength: 12 },
  )
  .map((a) => a.join(""));

/** Arbitrary hex-ish string that is USUALLY not a valid address (fuzz did). */
export const junkAddressLike = fc.oneof(
  // wrong length
  fc.array(fc.constantFrom(...HEX_NIBBLES_UPPER), { minLength: 0, maxLength: 60 }).map((a) => `0x${a.join("")}`),
  // no 0x prefix
  fc.array(fc.constantFrom(...HEX_NIBBLES_UPPER), { minLength: 40, maxLength: 40 }).map((a) => a.join("")),
  // contains non-hex
  fc.array(fc.constantFrom(..."ghijklGHIJKL0123456789".split("")), { minLength: 40, maxLength: 40 }).map((a) => `0x${a.join("")}`),
  fc.string(),
);

/** An arbitrary DID-ish string to feed addressFromDidPkh. */
export const didLike = fc.oneof(
  // shaped did:pkh:eip155:<chainId>:<addr> with a valid lowercase address
  fc
    .tuple(fc.integer({ min: 0, max: 1_000_000 }), evmAddressLower)
    .map(([cid, addr]) => `did:pkh:eip155:${cid}:${addr}`),
  // shaped but junk address
  fc.tuple(fc.integer({ min: 0, max: 999 }), junkAddressLike).map(([cid, a]) => `did:pkh:eip155:${cid}:${a}`),
  // wrong scheme/method/namespace
  fc.tuple(token, token, token, token, token).map((p) => p.join(":")),
  // did:web and other methods
  fc.constantFrom("did:web:ishtar.numetal.xyz", "did:key:z6Mk", "did:pkh:eip155:1", "did:pkh:solana:x:y"),
  // total junk incl. colons
  fc.string(),
  fc.array(token, { minLength: 0, maxLength: 8 }).map((a) => a.join(":")),
);

const substanceValue = fc.constantFrom("no", "never", "yes", "sometimes", "", "YES", "No", "Never", "occasionally");

/** A Self block; fields optional, occasionally malformed via extra props. */
export const selfArb = fc.record(
  {
    gender: fc.option(token, { nil: undefined }),
    age: fc.oneof(
      fc.integer({ min: 0, max: 200 }),
      fc.double({ min: -1e6, max: 1e6, noNaN: true }),
    ),
    ethnicity: fc.option(fc.array(token, { maxLength: 5 }), { nil: undefined }),
    kids: fc.option(token, { nil: undefined }),
    substances: fc.option(fc.dictionary(token, substanceValue, { maxKeys: 5 }), { nil: undefined }),
    languages: fc.option(fc.array(token, { maxLength: 5 }), { nil: undefined }),
  },
  { requiredKeys: ["age"] },
);

/** A Seek block; all fields optional. */
export const seekArb = fc.record(
  {
    genders: fc.option(fc.array(token, { maxLength: 5 }), { nil: undefined }),
    ageRange: fc.option(
      fc.record(
        {
          min: fc.option(fc.integer({ min: -100, max: 300 }), { nil: undefined }),
          max: fc.option(fc.integer({ min: -100, max: 300 }), { nil: undefined }),
        },
        { requiredKeys: [] },
      ),
      { nil: undefined },
    ),
    languages: fc.option(fc.array(token, { maxLength: 5 }), { nil: undefined }),
    ethnicities: fc.option(fc.array(token, { maxLength: 5 }), { nil: undefined }),
    dealbreakers: fc.option(fc.array(token, { maxLength: 6 }), { nil: undefined }),
  },
  { requiredKeys: [] },
);

/**
 * A JSON value with no NaN/Infinity/undefined so it survives JSON round-trips
 * intact — used to fuzz the `ext` bag and free-form fields.
 */
export const jsonValue = fc.jsonValue();

/**
 * A loosely-shaped, object-valued "document" for decoder no-throw fuzzing.
 * Intentionally permissive: keys may be missing, values may be wrong-typed.
 * Always an object (real untrusted input is a parsed JSON object), never a
 * bare null/primitive.
 */
export const looseDocArb: fc.Arbitrary<Record<string, unknown>> = fc.record(
  {
    $schema: fc.option(fc.string(), { nil: undefined }),
    version: fc.option(fc.string(), { nil: undefined }),
    kind: fc.option(fc.oneof(fc.constant("heartprefs"), fc.string()), { nil: undefined }),
    id: fc.option(fc.string(), { nil: undefined }),
    self: fc.option(selfArb, { nil: undefined }),
    seek: fc.option(seekArb, { nil: undefined }),
    free: fc.option(fc.dictionary(token, fc.string(), { maxKeys: 8 }), { nil: undefined }),
    identity: fc.option(
      fc.record({ subject: didLike }, { requiredKeys: ["subject"] }),
      { nil: undefined },
    ),
    attestation: fc.option(jsonValue, { nil: undefined }),
    consent: fc.option(jsonValue, { nil: undefined }),
    payment: fc.option(jsonValue, { nil: undefined }),
    ext: fc.option(jsonValue, { nil: undefined }),
    proof: fc.option(
      fc.record(
        {
          type: fc.option(fc.string(), { nil: undefined }),
          verificationMethod: fc.option(fc.string(), { nil: undefined }),
          created: fc.option(fc.string(), { nil: undefined }),
          nonce: fc.option(fc.string(), { nil: undefined }),
          signature: fc.option(fc.string(), { nil: undefined }),
        },
        { requiredKeys: [] },
      ),
      { nil: undefined },
    ),
  },
  { requiredKeys: [] },
);

/** A minimally schema-plausible Self for match fuzzing (age is a real number). */
export const matchSelfArb = selfArb.map((s) => ({ ...s, age: Math.trunc(Number(s.age)) || 0 }));
