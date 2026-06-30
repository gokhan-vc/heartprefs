import canonicalizeFn from "canonicalize";
import type { HeartPrefs, UnsignedHeartPrefs } from "./types.js";

/**
 * The `canonicalize` package's CJS default export does not always survive
 * ESM interop cleanly, so normalize to a callable here.
 */
const jcs = ((canonicalizeFn as unknown as { default?: typeof canonicalizeFn })
  .default ?? canonicalizeFn) as (input: unknown) => string;

/** Deep structured clone that works on plain JSON values across runtimes. */
function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Produce the exact bytes that are signed/verified: the RFC-8785 (JCS)
 * canonicalization of the document with `proof.signature` removed.
 *
 * Every other field of `proof` (type, verificationMethod, created, nonce) is
 * KEPT and contributes to the signed payload — only the signature itself is
 * stripped. This is the one rule from the spec; both `signDoc` and `verifyDoc`
 * route through here so they can never diverge.
 */
export function canonicalForSigning(
  doc: HeartPrefs | UnsignedHeartPrefs,
): string {
  const copy = jsonClone(doc) as Record<string, unknown>;
  const proof = copy["proof"];
  if (proof && typeof proof === "object") {
    delete (proof as Record<string, unknown>)["signature"];
  }
  const canonical = jcs(copy);
  if (typeof canonical !== "string") {
    throw new Error(
      "JCS canonicalization failed: document is not valid JSON-serializable data",
    );
  }
  return canonical;
}
