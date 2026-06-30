/**
 * HeartPrefs v0.1 document types.
 *
 * These mirror `spec/0.1/heartprefs.schema.json`. The schema is the source of
 * truth; these types are a convenience surface and intentionally permissive
 * (open `ext`, open binding blocks) to match `additionalProperties: true`.
 */

/** The matching vocabulary — the only invented surface (CC-BY-4.0). */
export interface Self {
  /** open string; no enum lock-in */
  gender?: string;
  /** required; 18..120 */
  age: number;
  ethnicity?: string[];
  /** suggested vocab: none-want-none | none-want-some | none-unsure | have-want-more | have-done */
  kids?: string;
  /** value vocab: no | sometimes | yes */
  substances?: Record<string, string>;
  /** BCP-47 / ISO 639-1 */
  languages?: string[];
}

export interface AgeRange {
  min?: number;
  max?: number;
}

export interface Seek {
  genders?: string[];
  ageRange?: AgeRange;
  languages?: string[];
  /** empty = no constraint */
  ethnicities?: string[];
  /** hard, ANDed exclusion terms */
  dealbreakers?: string[];
}

export interface Free {
  about?: string;
  seeking?: string;
  values?: string;
  interests?: string;
  logistics?: string;
  /** GATED key — omitted from the public projection */
  desire?: string;
  /** GATED key — omitted from the public projection */
  boundaries?: string;
}

/** Binding block 1 — who controls the document. */
export interface Identity {
  /** DID of the signing key; MUST equal proof.verificationMethod. */
  subject: string;
  /** optional ERC-8004 agent token id */
  agentId?: number;
  /** optional CAIP-10 of the ERC-8004 IdentityRegistry */
  agentRegistry?: string;
  /** optional ERC-8004 registration file listing this doc as a service */
  registrationUri?: string;
}

/** Binding block 2 — proof of adulthood by selective disclosure (no DOB). */
export interface Attestation {
  ageOver18?: boolean;
  /** a W3C Verifiable Presentation (VC Data Model 2.0) */
  credential?: Record<string, unknown>;
}

/** Binding block 3 — standing/delegated access (choose ONE scheme). */
export interface Consent {
  scheme?: "ap2-intent" | "eip191-allowance";
  intentMandate?: Record<string, unknown>;
  allowance?: Record<string, unknown>;
}

/** Binding block 4 — an x402 PaymentRequirements quote. */
export interface Payment {
  x402Version?: number;
  accepts?: Array<Record<string, unknown>>;
}

/** Detached signature over JCS(doc minus proof.signature). */
export interface Proof {
  /** e.g. "EIP191" */
  type: string;
  /** MUST equal identity.subject */
  verificationMethod: string;
  created?: string;
  nonce?: string;
  signature: string;
}

/** Proof shape before signing — everything but the signature is known. */
export type UnsignedProof = Omit<Proof, "signature"> & { signature?: string };

export interface HeartPrefs {
  $schema?: string;
  /** semver of the document, e.g. "0.1.0" */
  version: string;
  kind: "heartprefs";
  /** stable per-document id, e.g. urn:heartprefs:<did-or-ulid> */
  id: string;
  self: Self;
  seek: Seek;
  free: Free;
  identity: Identity;
  attestation?: Attestation;
  consent?: Consent;
  payment?: Payment;
  /** permissionless extension bag; consumers MUST ignore unknown keys */
  ext?: Record<string, unknown>;
  proof: Proof;
}

/** A HeartPrefs that has been assembled but not yet signed. */
export type UnsignedHeartPrefs = Omit<HeartPrefs, "proof"> & { proof?: UnsignedProof };
