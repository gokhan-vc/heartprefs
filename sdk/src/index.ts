/**
 * @heartprefs/sdk — author, sign, verify, validate, and match HeartPrefs v0.1
 * matching-intent documents.
 *
 * Signing rule (the one rule): EIP-191 `personal_sign` over the RFC-8785 (JCS)
 * canonicalization of the document with `proof.signature` removed; verify by
 * re-canonicalizing, recovering the signer, and asserting it equals the EVM
 * address in `identity.subject`.
 *
 * @license Apache-2.0
 */

export { buildDoc, publicProjection, type BuildDocInput } from "./build.js";
export { signDoc, verifyDoc, recoverSigner, type Signer, type VerifyResult } from "./sign.js";
export { validate, heartprefsSchema, type ValidationResult } from "./validate.js";
export { matches, type MatchResult } from "./match.js";
export { canonicalForSigning } from "./canonical.js";
export { addressFromDidPkh, didPkhFromAddress } from "./did.js";

export type {
  HeartPrefs,
  UnsignedHeartPrefs,
  Self,
  Seek,
  Free,
  Identity,
  Attestation,
  Consent,
  Payment,
  Proof,
  UnsignedProof,
  AgeRange,
} from "./types.js";
