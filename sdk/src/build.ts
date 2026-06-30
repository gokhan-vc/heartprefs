import type {
  Attestation,
  Consent,
  Free,
  HeartPrefs,
  Identity,
  Payment,
  Seek,
  Self,
  UnsignedHeartPrefs,
} from "./types.js";

const SCHEMA_ID = "https://w3id.org/heartprefs/0.1/schema.json";
const DOC_VERSION = "0.1.0";

export interface BuildDocInput {
  /** stable per-document id, e.g. "urn:heartprefs:<did-or-ulid>" */
  id: string;
  self: Self;
  seek: Seek;
  free?: Free;
  /**
   * The signing subject. Either pass a full `identity` block or just a
   * `subject` DID; when `subject` is given it is used for both
   * `identity.subject` and `proof.verificationMethod`.
   */
  identity: Identity | { subject: string };
  attestation?: Attestation;
  consent?: Consent;
  payment?: Payment;
  ext?: Record<string, unknown>;
  /** doc semver; defaults to "0.1.0" */
  version?: string;
  /** override the $schema URL (defaults to the w3id permalink) */
  $schema?: string;
  /** ISO-8601 timestamp for proof.created; defaults to now */
  created?: string;
  /** proof nonce; defaults to a random UUID */
  nonce?: string;
}

function randomNonce(): string {
  // crypto.randomUUID is available in Node 18+ and modern browsers/workers.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback: RFC-4122-ish v4 from getRandomValues.
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/**
 * Assemble a HeartPrefs v0.1 document with an unsigned proof scaffold.
 *
 * The returned object is schema-shaped but the proof has an empty signature;
 * pass it to `signDoc` to fill in `proof.signature`. `proof.verificationMethod`
 * is set to `identity.subject` so the signed doc satisfies the "verification
 * method MUST equal subject" invariant by construction.
 */
export function buildDoc(input: BuildDocInput): UnsignedHeartPrefs {
  const subject = input.identity.subject;
  if (!subject) {
    throw new Error("buildDoc: identity.subject is required");
  }

  const identity: Identity = { ...input.identity, subject };

  const doc: UnsignedHeartPrefs = {
    $schema: input.$schema ?? SCHEMA_ID,
    version: input.version ?? DOC_VERSION,
    kind: "heartprefs",
    id: input.id,
    self: input.self,
    seek: input.seek,
    free: input.free ?? {},
    identity,
    proof: {
      type: "EIP191",
      verificationMethod: subject,
      created: input.created ?? new Date().toISOString(),
      nonce: input.nonce ?? randomNonce(),
    },
  };

  if (input.attestation !== undefined) doc.attestation = input.attestation;
  if (input.consent !== undefined) doc.consent = input.consent;
  if (input.payment !== undefined) doc.payment = input.payment;
  if (input.ext !== undefined) doc.ext = input.ext;

  return doc;
}

/**
 * Strip the gated keys (`free.desire`, `free.boundaries`) to produce the
 * PUBLIC projection of a document — safe to publish unpaid. The proof still
 * verifies for the full doc; the public projection is a derived view, not a
 * separately-signed object.
 */
export function publicProjection<T extends HeartPrefs | UnsignedHeartPrefs>(
  doc: T,
): T {
  const copy = JSON.parse(JSON.stringify(doc)) as T;
  if (copy.free) {
    delete (copy.free as Free).desire;
    delete (copy.free as Free).boundaries;
  }
  return copy;
}
