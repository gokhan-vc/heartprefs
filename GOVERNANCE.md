# HeartPrefs Governance

HeartPrefs is stewarded as an **open, neutral-by-design** standard. This document pre-commits the process and the path to neutral governance, so the standard reads as a commons — not a single vendor's silo.

## Licensing
- **Vocabulary + JSON Schema + spec text** (`spec/`): **CC-BY-4.0**. Anyone may share, adapt, and build on HeartPrefs — including commercially — **provided they attribute "HeartPrefs (Atelier Gökhan / Numetal)"** and link to the license. Attribution (not public-domain release) is deliberate: it keeps provenance and credit with the standard's stewards as it spreads. No share-alike — adopters can borrow freely as long as they credit.
- **Code** (`sdk/`, `tools/`, `validator/`, reference servers): **Apache-2.0** — explicit patent grant + retaliation, added alongside the code.
- **Name + conformance mark:** "HeartPrefs" and the "HeartPrefs-compliant" mark are protected (trademark). The license lets you implement the standard; it does not grant use of the name to imply endorsement or certification — conformance is asserted via the validator/badge, not by self-claim.

## Change process — HIP (HeartPrefs Improvement Proposal)
Changes to the spec go through a numbered HIP process modeled on EIP-1 and the MCP SEP process:

- **Lifecycle:** Draft → Review → Last Call (14 days) → Final, plus Stagnant / Withdrawn / Living.
- **Editor role is format and completeness ONLY — never merit.** Editors check that a proposal is well-formed and complete; they do not gate on whether the idea is good. (This neutrality is load-bearing: merit-gating by a single steward is what stalls the move to a neutral standards body.)
- `hips/hip-0001.md` defines the process itself. Substantive changes (new fields, binding-block changes, breaking changes) require a HIP; permissionless additions belong in the `ext` namespace and need no HIP.

## Path to neutral governance
1. **Launch** under Atelier Gökhan / Numetal, with [Ishtar](https://ishtar.numetal.xyz) as the reference implementation.
2. **File a W3C Community Group** ("HeartPrefs CG") under open, royalty-free / CC0 IPR terms.
3. **Donate to a neutral foundation (Linux Foundation) once there are ≥ 3 independent implementations** — a neutral technical steering committee, Apache-2.0 IP for the code. This mirrors the path A2A and OpenAPI took.

## Compatibility & stability
The schema `$id` is version-pathed (`/0.1/`, `/0.2/`, …) so newer versions never break existing holders. Consumers MUST ignore unknown members rather than reject them. v0.1 is **draft** — field names and bindings may change until v1.0.

## Contact
Open an issue or PR. Maintainer contact: degenerous@protonmail.com.
