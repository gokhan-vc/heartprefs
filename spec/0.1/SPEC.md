# HeartPrefs — Specification v0.1 (DRAFT)

> **Status: DRAFT / experimental.** Field names and bindings may change until v1.0. Every external rail this spec composes onto (x402, AP2, A2A, MCP, ERC-8004, VC cryptosuites) is itself draft or fast-moving — implementers MUST re-verify against first-party sources before depending on a specific field/path/ABI. See [§9](#9-versioning--stability).

HeartPrefs is an **open, portable, signed matching-intent document**: a single JSON object that says who someone is, who and what they seek, and on what terms an agent may act for them — readable and actable by any agent at any venue.

The only thing HeartPrefs *invents* is the **matching vocabulary** (`self` / `seek` / `free`). Everything that makes a document trustable, portable and payable is delegated to existing standards via four thin **binding blocks** (`identity`, `attestation`, `consent`, `payment`). The same canonical bytes are designed to ride an x402 response body, an [A2A](https://a2a-protocol.org) Agent-Card extension, an [MCP](https://modelcontextprotocol.io) resource, and an [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) service entry without transformation.

## 1. Document shape
A HeartPrefs document is a JSON object validated by [`heartprefs.schema.json`](./heartprefs.schema.json) (JSON Schema **draft 2020-12**). Required top-level members: `version`, `kind` (const `"heartprefs"`), `id`, `self`, `seek`, `free`, `identity`, `proof`. See [`../../examples/minimal.json`](../../examples/minimal.json).

- **`self`** — `gender`, `age` (≥18), `ethnicity[]`, `kids`, `substances{}`, `languages[]`. `additionalProperties: false`.
- **`seek`** — `genders[]`, `ageRange{min,max}`, `languages[]`, `ethnicities[]`, `dealbreakers[]`. `additionalProperties: false`.
- **`free`** — `about`, `seeking`, `values`, `interests`, `logistics`, `desire`, `boundaries`. `desire` and `boundaries` are **gated keys** (see [§5](#5-public-vs-gated)).

## 2. Identity binding (`identity` + `proof`)
The document is bound to a controller key and signed:
- `identity.subject` is a **DID** — `did:pkh:eip155:<chainId>:<address>` for an EVM wallet, or `did:web:<host>` for a venue/issuer.
- `proof` is a **detached signature** over the **RFC 8785 (JCS)** canonicalization of the document with `proof.signature` removed. v0.1 uses `proof.type = "EIP191"` (`personal_sign`); `proof.verificationMethod` MUST equal `identity.subject`.
- **Verification:** re-canonicalize the document (JCS, `proof.signature` removed), recover the signer, and assert it equals the address in `identity.subject`. A document whose signature does not recover to its subject is invalid.

> Implementation note: JCS number/Unicode handling is the usual signature-mismatch bug. Confirm your serializer is JCS-exact on both ends.

## 3. Adulthood (`attestation`)
HeartPrefs carries **proof of adulthood by selective disclosure — never a date of birth.** `attestation.credential` is a W3C **Verifiable Presentation** (VC Data Model 2.0) that discloses only a boolean `ageOver18` predicate, issued by a venue/issuer DID (`did:web:…`) after an out-of-band age check. `attestation.ageOver18` is a fast-filter summary; the credential is the source of truth. v0.1 pins the boolean property name **`ageOver18`** (VC 2.0 defines no normative age field).

## 4. Payment & standing access (`payment` + `consent`)
- **`payment`** is an **x402** `PaymentRequirements` quote (`x402Version`, `accepts[]`) advertising the price to read/submit. Settlement happens out of band over the x402 wire (HTTP `402` → `X-PAYMENT` → facilitator verify/settle); the document only advertises the quote.
- **`consent`** expresses *standing* access for an agent acting on the subject's behalf — either an **AP2 `IntentMandate`** (`scheme: "ap2-intent"`) or a signed metered **allowance** (`scheme: "eip191-allowance"`). x402 has no native recurring primitive; a venue picks ONE scheme.

## 5. Public vs gated
One schema, two projections:
- **Public projection** — everything except `free.desire` and `free.boundaries`. Safe to publish on a board, an A2A public Agent Card, or an unpaid MCP read.
- **Gated projection** — adds `free.desire` + `free.boundaries`, served only after identity proof **and** payment/consent are satisfied.

## 6. Matching semantics (bilateral)
A **match** is mutual and constraint-checked, not one-directional:
1. For candidates A and B, A's `seek` constraints are checked against B's `self`, **and** B's `seek` against A's `self`.
2. **Dealbreakers are hard and ANDed:** if any term in one side's `seek.dealbreakers` is present in the other's document, there is no match. `seek.ageRange`, `seek.genders`, and non-empty `seek.languages` / `seek.ethnicities` are hard filters.
3. Free-text and soft preferences feed ranking, not eligibility.

A conforming venue MUST enforce dealbreakers as hard predicates before proposing a pairing.

## 7. Extensions
`ext` is a permissionless bag for venue- or community-specific keys (suggested form `namespace:key`). Consumers **MUST ignore** unknown `ext` keys and unknown top-level members — never reject. Breaking additions go through the [HIP process](../../GOVERNANCE.md).

## 8. Conformance
A **conformant document** validates against `heartprefs.schema.json` and carries a `proof` that recovers to `identity.subject`. A **conformant venue** (a) accepts any conformant document, (b) enforces §6 dealbreakers, and (c) honors the public/gated projection in §5. A hosted validator + badge are part of the reference tooling.

## 9. Versioning & stability
The schema `$id` is version-pathed (`/0.1/`) so later versions can change shape without breaking existing holders. v0.1 is **draft**: treat field names and the binding blocks as unstable until v1.0. Because every composed rail is itself draft/preview, implementers MUST re-verify the exact x402 version, A2A Agent-Card version, MCP protocol/registry schema, ERC-8004 ABIs/addresses, and VC cryptosuite against first-party sources before locking an implementation.

## 10. Media type & schema URL
- Media type: `application/heartprefs+json` (IANA registration pending; use provisionally).
- Schema `$id`: `https://w3id.org/heartprefs/0.1/schema.json` (w3id permalink registration pending; until it resolves, fetch the schema from this repository).
