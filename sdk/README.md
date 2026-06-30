# @heartprefs/sdk

**Author, sign, verify, validate, and match [HeartPrefs](../README.md) v0.1
matching-intent documents.** TypeScript, Apache-2.0.

A HeartPrefs is one signed JSON object — who someone is (`self`), who/what they
seek (`seek`), free text (`free`) — portable across venues and verifiable by
anyone. This SDK is the reference implementation of the *one rule*: **EIP-191
`personal_sign` over the RFC-8785 (JCS) canonicalization of the document with
`proof.signature` removed.**

## Install

```bash
npm install @heartprefs/sdk viem
```

`viem` is a peer-level runtime dependency (used for signing + signer recovery).

## Use

```ts
import { buildDoc, signDoc, verifyDoc, validate, matches, didPkhFromAddress } from "@heartprefs/sdk";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const subject = didPkhFromAddress(account.address, 8453); // Base

const doc = buildDoc({
  id: `urn:heartprefs:${crypto.randomUUID()}`,
  self: { gender: "woman", age: 31, languages: ["tr", "en"] },
  seek: { genders: ["man"], ageRange: { min: 30, max: 45 }, dealbreakers: ["smoking"] },
  identity: { subject },
  attestation: { ageOver18: true },
});

const signed = await signDoc(doc, account);   // fills proof.signature
const { valid } = validate(signed);            // ajv, JSON Schema draft 2020-12
const v = await verifyDoc(signed);             // v.recovered === account.address
```

A full copy-paste agent walkthrough is in [`SKILL.md`](./SKILL.md).

## API

| Export | Purpose |
|---|---|
| `buildDoc(input)` | assemble a v0.1 doc (`self`/`seek`/`free` + identity + unsigned proof scaffold) |
| `signDoc(doc, privateKeyOrViemAccount)` | EIP-191 over JCS(doc − `proof.signature`); fills `proof` |
| `verifyDoc(doc)` | re-canonicalize, recover signer, assert == `identity.subject` → `{ valid, recovered, subject, reason? }` |
| `recoverSigner(doc)` | recovered address; throws if it doesn't equal the subject |
| `validate(doc)` | ajv against the frozen schema → `{ valid, errors }` |
| `matches(a, b)` | bilateral seek/dealbreaker check → `{ match, reasons }` |
| `publicProjection(doc)` | strip the gated keys (`free.desire`, `free.boundaries`) |
| `canonicalForSigning(doc)` | the exact JCS bytes that get signed (escape hatch) |
| `didPkhFromAddress` / `addressFromDidPkh` | `did:pkh:eip155` ⇄ EVM address |

### Matching semantics

A match is **mutual** (SPEC §6): `a.seek` is checked against `b.self` **and**
`b.seek` against `a.self`. **Dealbreakers are hard and ANDed** — if any of one
side's `seek.dealbreakers` appears in the other's document, there is no match.
`genders`, `ageRange`, and non-empty `languages` / `ethnicities` are hard
filters. Free text feeds ranking, not eligibility, and is not consulted here.

## Develop

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # tsup -> dist (ESM + CJS + .d.ts)
```

The schema in `src/heartprefs.schema.json` is a byte-identical copy of the
canonical [`spec/0.1/heartprefs.schema.json`](../spec/0.1/heartprefs.schema.json),
inlined so the package validates standalone. The spec is the source of truth.

## License

**Apache-2.0** (see [`LICENSE`](./LICENSE)). The HeartPrefs vocabulary, schema,
and spec are **CC-BY-4.0** — attribute "HeartPrefs (Atelier Gökhan / Numetal)".
