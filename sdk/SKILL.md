---
name: heartprefs-author
description: >
  Author, sign (EIP-191 over RFC-8785 JCS), verify, validate, and match a
  HeartPrefs v0.1 matching-intent document with the agent's own wallet key.
  Load when an agent needs to write a portable, signed dating/matching intent
  that any HeartPrefs venue (Ishtar, or any conformant agent) can read and act
  on. Triggers: "write my HeartPrefs", "sign a matching intent", "publish a
  dating profile an agent can verify", heartprefs, matching-intent doc.
license: Apache-2.0
---

# Skill: Author & sign a HeartPrefs

A **HeartPrefs** is one signed JSON object that says who someone is (`self`),
who/what they seek (`seek`), and free-text (`free`) — portable across venues,
verifiable by anyone, gated by payment only for the sensitive keys
(`free.desire`, `free.boundaries`). The agent signs it with **its own key**
(EIP-191 `personal_sign` over the RFC-8785 / JCS canonicalization of the doc
with `proof.signature` removed). No server, no custody — the key never leaves
the agent.

## Install

```bash
npm install @heartprefs/sdk viem
```

## Author + sign with your own key (copy-paste)

```ts
import { buildDoc, signDoc, verifyDoc, validate, didPkhFromAddress } from "@heartprefs/sdk";
import { privateKeyToAccount } from "viem/accounts";

// 1. Your agent's own key. Load it from your secret store — NEVER hardcode.
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);

// 2. Your DID = did:pkh on Base (chainId 8453). It MUST match the signing key.
const subject = didPkhFromAddress(account.address, 8453);

// 3. Assemble the document. `self.age` must be >= 18.
const doc = buildDoc({
  id: `urn:heartprefs:${crypto.randomUUID()}`,
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
    dealbreakers: ["smoking", "wants-no-kids"], // HARD, ANDed exclusions
  },
  free: {
    about: "Lives by the tide charts; happiest cooking for friends.",
    seeking: "Someone kind, curious, and game for a long walk.",
    values: "Honesty, slowness, loyalty.",
    desire: "",      // GATED — only revealed after payment + proof
    boundaries: "",  // GATED
  },
  identity: { subject },
  attestation: { ageOver18: true }, // the credential, if any, is the source of truth
});

// 4. Sign it with EIP-191 over the JCS canonicalization (signature stripped).
const signed = await signDoc(doc, account); // or pass the raw 0x private key

// 5. Sanity-check before you publish it.
const { valid, errors } = validate(signed);          // ajv, JSON Schema 2020-12
if (!valid) throw new Error(JSON.stringify(errors, null, 2));

const v = await verifyDoc(signed);                   // recover signer
console.log(v.valid, v.recovered);                   // true, 0x<your wallet>

console.log(JSON.stringify(signed, null, 2));         // <-- this is your HeartPrefs
```

## Anyone can verify it (no key needed)

```ts
import { verifyDoc } from "@heartprefs/sdk";

const { valid, recovered, subject } = await verifyDoc(someHeartPrefs);
// valid === true  iff  the EIP-191 signer recovers to identity.subject
```

## Check a bilateral match

```ts
import { matches } from "@heartprefs/sdk";

const { match, reasons } = matches(aliceDoc, bobDoc);
// match is true only if BOTH directions pass:
//   - alice.seek vs bob.self AND bob.seek vs alice.self
//   - dealbreakers are HARD & ANDed (any hit on either side => no match)
//   - genders, ageRange, and non-empty languages/ethnicities are hard filters
//   - free-text is NOT consulted here (that's ranking, not eligibility)
if (!match) console.log("no match:", reasons);
```

## Public vs gated projection

`free.desire` and `free.boundaries` are **gated** — strip them before publishing
an unpaid view:

```ts
import { publicProjection } from "@heartprefs/sdk";
const safeToPublish = publicProjection(signed); // drops free.desire & free.boundaries
```

The full signed doc still verifies; the public projection is a derived view, not
a separately-signed object. Serve the gated keys only after payment (x402) +
identity proof per the [spec](../spec/0.1/SPEC.md).

## The one rule (so signatures interoperate)

Canonicalization is **RFC 8785 (JCS)** over the whole document **minus
`proof.signature`** (every other `proof` field — `type`, `verificationMethod`,
`created`, `nonce` — is part of the signed bytes). Then **EIP-191
`personal_sign`**. Verify by re-canonicalizing the same way, recovering the
signer, and asserting it equals the address in `identity.subject`. `signDoc` and
`verifyDoc` both route through the same canonicalizer, so they can never diverge.

## API

| Export | Signature | Purpose |
|---|---|---|
| `buildDoc(input)` | `BuildDocInput → UnsignedHeartPrefs` | assemble self/seek/free + identity + unsigned proof scaffold |
| `signDoc(doc, key)` | `(doc, Signer) → Promise<HeartPrefs>` | EIP-191 over JCS(doc − proof.signature); fills `proof` |
| `verifyDoc(doc)` | `HeartPrefs → Promise<VerifyResult>` | recover signer; assert == `identity.subject` |
| `recoverSigner(doc)` | `HeartPrefs → Promise<Address>` | recovered address, throws if invalid |
| `validate(doc)` | `unknown → {valid, errors}` | ajv against the frozen 2020-12 schema |
| `matches(a, b)` | `(doc, doc) → {match, reasons}` | bilateral seek/dealbreaker check |
| `publicProjection(doc)` | `doc → doc` | strip gated keys |

`Signer` = a `0x`-prefixed private key **or** a viem `LocalAccount`.

License: **Apache-2.0**. The HeartPrefs vocabulary/schema/spec is CC-BY-4.0
(attribute "HeartPrefs (Atelier Gökhan / Numetal)").
