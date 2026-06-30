# HeartPrefs

**An open, portable, signed matching-intent document for agent-mediated matching.**

> **Status: v0.1 — DRAFT / experimental.** Field names and bindings may change until v1.0.

A HeartPrefs document says who someone is, who and what they seek, and on what terms an agent may act for them — in one JSON object that any agent, at any venue, can read, verify, and act on. You write it once; your agent can court anywhere that speaks HeartPrefs.

It invents only the **matching vocabulary** (`self` / `seek` / `free`). Everything that makes a document trustable, portable, and payable is delegated to existing rails through four thin **binding blocks**:

| Block | Delegates to |
|---|---|
| `identity` | W3C **DID** (`did:pkh` / `did:web`) + a detached **EIP-191** signature |
| `attestation` | a W3C **Verifiable Credential** (VC 2.0) proving `ageOver18` by *selective disclosure* — no date of birth |
| `consent` | an **AP2** Intent Mandate, or a signed allowance, for standing/delegated access |
| `payment` | an **x402** quote (HTTP 402 + USDC) to read / submit / subscribe |

The same canonical bytes are designed to ride an [x402](https://x402.org) body, an [A2A](https://a2a-protocol.org) Agent-Card extension, an [MCP](https://modelcontextprotocol.io) resource, and an [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) service entry — no transformation.

## Quick look
```jsonc
{
  "kind": "heartprefs", "version": "0.1.0", "id": "urn:heartprefs:…",
  "self": { "gender": "woman", "age": 31, "languages": ["tr","en"], … },
  "seek": { "genders": ["man"], "ageRange": {"min":30,"max":45},
            "dealbreakers": ["smoking","wants-no-kids"] },        // hard, ANDed
  "free": { "about": "…", "desire": "", "boundaries": "" },         // desire/boundaries are gated
  "identity": { "subject": "did:pkh:eip155:8453:0x…" },
  "attestation": { "ageOver18": true },
  "proof": { "type": "EIP191", "signature": "0x…" }                 // over RFC-8785 JCS of the doc
}
```
Full example: [`examples/minimal.json`](./examples/minimal.json) · Schema: [`spec/0.1/heartprefs.schema.json`](./spec/0.1/heartprefs.schema.json) · Spec: [`spec/0.1/SPEC.md`](./spec/0.1/SPEC.md).

## Why
Agent-to-agent payment (x402/AP2), discovery (A2A), tool/context (MCP), and identity (ERC-8004 + DID/VC) are all being standardized — but none defines a **bilateral, mutual-consent matching intent**. HeartPrefs fills exactly that gap, and only that gap, by composing the rest.

## Validate
```bash
# any JSON-Schema 2020-12 validator, e.g. ajv
npx ajv-cli validate -s spec/0.1/heartprefs.schema.json -d examples/minimal.json --spec=draft2020
```
A hosted validator, badge, and renderer, plus a signing/matching SDK, are on the roadmap (see [GOVERNANCE.md](./GOVERNANCE.md)).

## License
- **Vocabulary, JSON Schema, and spec text** (`spec/`): **CC-BY-4.0** — you may copy, embed, adapt, and redistribute (including commercially) **provided you give appropriate credit to "HeartPrefs (Atelier Gökhan / Numetal)"** and link to the license. See [LICENSE](./LICENSE).
- **Code** (future `sdk/`, `tools/`, `validator/`): **Apache-2.0** (added with the code).
- The name **"HeartPrefs"** and the conformance mark are protected (trademark + [GOVERNANCE.md](./GOVERNANCE.md)) — attribution lets you build on the standard; it does not grant the right to imply endorsement.

## Governance
Open, neutral-by-design. A numbered **HIP** (HeartPrefs Improvement Proposal) process governs changes; the standard is intended to move to a neutral home (W3C Community Group → Linux Foundation) once there are independent implementations. See [GOVERNANCE.md](./GOVERNANCE.md).

## Reference implementation
[Ishtar](https://ishtar.numetal.xyz) (Atelier Gökhan / Numetal) is the reference implementation and the first venue to consume HeartPrefs.
