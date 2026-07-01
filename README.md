<div align="center">

# HeartPrefs

**An open, portable, signed matching-intent document that agents exchange to negotiate matches.**

[![License](https://img.shields.io/github/license/gokhan-vc/heartprefs)](./LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/gokhan-vc/heartprefs)](https://github.com/gokhan-vc/heartprefs/commits)
[![Stars](https://img.shields.io/github/stars/gokhan-vc/heartprefs?style=social)](https://github.com/gokhan-vc/heartprefs/stargazers)

![Spec status](https://img.shields.io/badge/spec-DRAFT%20v0.1-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![JSON Schema](https://img.shields.io/badge/JSON--Schema-2020--12-blue)
![EIP-191](https://img.shields.io/badge/signing-EIP--191-627EEA)
![x402](https://img.shields.io/badge/interop-x402-000000)
![A2A](https://img.shields.io/badge/interop-A2A-4285F4)
![MCP](https://img.shields.io/badge/interop-MCP-000000)

</div>

A **HeartPrefs** document says who someone is, who and what they seek, and on what terms an agent may act for them — in one signed JSON object that any agent, at any venue, can read, verify, and act on. You write it once; your agent can court anywhere that speaks HeartPrefs.

> **Status: v0.1 — DRAFT / experimental.** Field names and bindings may change until v1.0.

## What it is

HeartPrefs invents only the **matching vocabulary** (`self` / `seek` / `free`). Everything that makes a document trustable, portable, and payable is delegated to existing rails through four thin **binding blocks**:

| Block | Delegates to |
|---|---|
| `identity` | W3C **DID** (`did:pkh` / `did:web`) + a detached **EIP-191** signature |
| `attestation` | a W3C **Verifiable Credential** (VC 2.0) proving `ageOver18` by *selective disclosure* — no date of birth |
| `consent` | an **AP2** Intent Mandate, or a signed allowance, for standing / delegated access |
| `payment` | an **x402** quote (HTTP 402 + USDC) to read / submit / subscribe |

The same canonical bytes are designed to ride an [x402](https://x402.org) body, an [A2A](https://a2a-protocol.org) Agent-Card extension, an [MCP](https://modelcontextprotocol.io) resource, and an [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) service entry — with no transformation.

Read the full spec: **[`spec/0.1/SPEC.md`](./spec/0.1/SPEC.md)** · Schema: [`spec/0.1/heartprefs.schema.json`](./spec/0.1/heartprefs.schema.json) · Example: [`examples/minimal.json`](./examples/minimal.json).

## Why

Agent-to-agent payment (x402 / AP2), discovery (A2A), tool/context (MCP), and identity (ERC-8004 + DID/VC) are all being standardized — but none defines a **bilateral, mutual-consent matching intent**. HeartPrefs fills exactly that gap, and only that gap, by composing the rest.

## Quick look

```jsonc
{
  "kind": "heartprefs", "version": "0.1.0", "id": "urn:heartprefs:…",
  "self": { "gender": "woman", "age": 31, "languages": ["tr","en"] },
  "seek": { "genders": ["man"], "ageRange": {"min":30,"max":45},
            "dealbreakers": ["smoking","wants-no-kids"] },        // hard, ANDed
  "free": { "about": "…", "desire": "", "boundaries": "" },        // desire/boundaries are gated
  "identity": { "subject": "did:pkh:eip155:8453:0x…" },
  "attestation": { "ageOver18": true },
  "proof": { "type": "EIP191", "signature": "0x…" }                // over RFC-8785 JCS of the doc
}
```

### The flow: sign → validate → verify → match

- **Sign** — EIP-191 `personal_sign` over the RFC-8785 (JCS) canonicalization of the document with `proof.signature` removed. That single rule makes any document self-authenticating.
- **Validate** — check the document against the frozen JSON Schema (draft 2020-12).
- **Verify** — re-canonicalize, recover the signer, and assert it equals the DID in `identity.subject`. A document whose signature does not recover to its subject is invalid.
- **Match** — matching is **bilateral** (SPEC §6): `a.seek` is checked against `b.self` **and** `b.seek` against `a.self`. Dealbreakers are hard and ANDed; free text feeds ranking, not eligibility.

## SDK quickstart

The reference implementation is [`@heartprefs/sdk`](./sdk) — a TypeScript library to author, sign, verify, validate, and match v0.1 documents.

```bash
npm install @heartprefs/sdk viem
```

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
const { valid } = validate(signed);           // ajv, JSON Schema draft 2020-12
const v = await verifyDoc(signed);            // v.recovered === account.address
```

Build and test the SDK from source:

```bash
cd sdk
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # tsup -> dist (ESM + CJS + .d.ts)
```

A full copy-paste agent walkthrough is in [`sdk/SKILL.md`](./sdk/SKILL.md), and the SDK API surface is documented in [`sdk/README.md`](./sdk/README.md).

### Validate without the SDK

Any JSON-Schema 2020-12 validator works — the document format is not tied to any one implementation:

```bash
npx ajv-cli validate -s spec/0.1/heartprefs.schema.json -d examples/minimal.json --spec=draft2020
```

## Interop

HeartPrefs is a document format, not a transport. It is designed so the same canonical bytes move across the agent stack unchanged:

- **x402** — a `payment` block carries an x402 `PaymentRequirements` quote; the document advertises the price to read/submit while settlement happens out of band over the x402 wire (HTTP `402` → `X-PAYMENT` → facilitator verify/settle).
- **A2A** — the public projection of a document fits an A2A Agent-Card extension, so an agent can publish who it seeks alongside its capabilities.
- **MCP** — a document can be served as an MCP resource for context/tool exchange between agents.
- **ERC-8004 / DID / VC** — identity binds to a W3C **DID** (`did:pkh:eip155` or `did:web`); adulthood is a W3C **Verifiable Credential** (VC 2.0) disclosing only an `ageOver18` predicate; a document can be referenced from an ERC-8004 service entry.

Each of these rails is itself draft or fast-moving — implementers MUST re-verify against first-party sources before depending on a specific field, path, or ABI. See [SPEC §9](./spec/0.1/SPEC.md).

## Governance

HeartPrefs is stewarded as an **open, neutral-by-design** standard. A numbered **HIP** (HeartPrefs Improvement Proposal) process governs changes, and the standard is intended to move to a neutral home (W3C Community Group → Linux Foundation) once there are independent implementations. See **[GOVERNANCE.md](./GOVERNANCE.md)**.

Proposals, questions, and discussion go through the repository's [issue tracker](https://github.com/gokhan-vc/heartprefs/issues) (open an issue or a PR). For contact by email, use `contact@gokhan.vc`.

## Credits & third-party

The SDK builds on the following open-source projects:

| Project | Used for | License |
|---|---|---|
| [viem](https://github.com/wevm/viem) | EIP-191 signing and signer recovery | MIT |
| [ajv](https://github.com/ajv-validator/ajv) + [ajv-formats](https://github.com/ajv-validator/ajv-formats) | JSON Schema (draft 2020-12) validation | MIT |
| [canonicalize](https://github.com/erdtman/canonicalize) | RFC-8785 (JCS) canonicalization | Apache-2.0 |
| [tsup](https://github.com/egoist/tsup) | ESM/CJS/`.d.ts` bundling | MIT |
| [vitest](https://github.com/vitest-dev/vitest) | testing | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | language / typecheck | Apache-2.0 |

The standard composes onto the [x402](https://x402.org), [AP2](https://a2a-protocol.org), [A2A](https://a2a-protocol.org), [MCP](https://modelcontextprotocol.io), and [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) specifications, plus the W3C DID and Verifiable Credentials data models.

## License

- **Vocabulary, JSON Schema, and spec text** (`spec/`): **[CC-BY-4.0](./LICENSE)** — you may share, adapt, and build on HeartPrefs, including commercially, provided you give appropriate credit to "HeartPrefs (Atelier Gökhan / Numetal)" and link to the license.
- **Code** (`sdk/`): **Apache-2.0** (see [`sdk/LICENSE`](./sdk/LICENSE)).
- The name **"HeartPrefs"** and the conformance mark are protected — attribution lets you build on the standard; it does not grant the right to imply endorsement. See [GOVERNANCE.md](./GOVERNANCE.md).

## Reference implementation

[Ishtar](https://ishtar.numetal.xyz) is the reference implementation and the first venue to consume HeartPrefs.
