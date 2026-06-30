import {
  recoverMessageAddress,
  type Account,
  type Address,
  type Hex,
  type LocalAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { canonicalForSigning } from "./canonical.js";
import { addressFromDidPkh } from "./did.js";
import type { HeartPrefs, Proof, UnsignedHeartPrefs } from "./types.js";

/** A signer is either a 0x-prefixed private key or a viem local account. */
export type Signer = Hex | string | LocalAccount | Account;

function toLocalAccount(signer: Signer): LocalAccount {
  if (typeof signer === "string") {
    const key = (signer.startsWith("0x") ? signer : `0x${signer}`) as Hex;
    return privateKeyToAccount(key);
  }
  const acct = signer as LocalAccount;
  if (typeof acct.signMessage !== "function") {
    throw new Error(
      "signDoc: account does not support signMessage (needs a LocalAccount or a private key)",
    );
  }
  return acct;
}

/**
 * Sign a HeartPrefs document with EIP-191 `personal_sign` over the RFC-8785
 * (JCS) canonicalization of the document with `proof.signature` removed.
 *
 * Returns a new fully-signed document; the input is not mutated. The proof
 * scaffold ({type, verificationMethod, created, nonce}) is taken from the
 * input doc (as produced by `buildDoc`); any missing scaffold fields are
 * defaulted. `proof.verificationMethod` is forced to equal `identity.subject`.
 */
export async function signDoc(
  doc: UnsignedHeartPrefs | HeartPrefs,
  privateKeyOrViemAccount: Signer,
): Promise<HeartPrefs> {
  const account = toLocalAccount(privateKeyOrViemAccount);

  const subject = doc.identity?.subject;
  if (!subject) {
    throw new Error("signDoc: identity.subject is required before signing");
  }

  // Guard: if the subject is a did:pkh, the signing key MUST match it.
  const subjectAddr = addressFromDidPkh(subject);
  if (subjectAddr && subjectAddr.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(
      `signDoc: signing key ${account.address} does not match identity.subject ${subjectAddr}`,
    );
  }

  const existing = (doc.proof ?? {}) as Partial<Proof>;
  const proof: Proof = {
    type: existing.type ?? "EIP191",
    verificationMethod: subject,
    created: existing.created ?? new Date().toISOString(),
    nonce: existing.nonce ?? "",
    signature: "",
  };
  // Carry forward any extra proof fields a caller may have set at runtime.
  const proofRecord = proof as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(existing)) {
    if (!(k in proof)) proofRecord[k] = v;
  }

  // Assemble the doc-with-proof-scaffold, then canonicalize minus signature.
  const draft: HeartPrefs = { ...(doc as HeartPrefs), proof };
  const message = canonicalForSigning(draft);
  const signature = await account.signMessage({ message });

  return { ...draft, proof: { ...proof, signature } };
}

export interface VerifyResult {
  /** true iff the recovered signer equals identity.subject (when did:pkh) */
  valid: boolean;
  /** the recovered EIP-191 signer address */
  recovered: Address;
  /** the address parsed out of identity.subject, if it is a did:pkh */
  subject: Address | null;
  /** populated when valid === false */
  reason?: string;
}

/**
 * Re-canonicalize the document (JCS, `proof.signature` removed), recover the
 * EIP-191 signer, and assert it equals the address in `identity.subject`.
 *
 * Returns the recovered address plus a validity flag. Throws only on
 * malformed input (missing proof/signature); a signature that simply does not
 * recover to the subject yields `{ valid: false, reason }`.
 */
export async function verifyDoc(doc: HeartPrefs): Promise<VerifyResult> {
  const signature = doc.proof?.signature;
  if (!signature) {
    throw new Error("verifyDoc: doc.proof.signature is missing");
  }
  const subject = doc.identity?.subject;
  if (!subject) {
    throw new Error("verifyDoc: doc.identity.subject is missing");
  }

  const message = canonicalForSigning(doc);
  const recovered = await recoverMessageAddress({
    message,
    signature: signature as Hex,
  });

  // proof.verificationMethod MUST equal identity.subject.
  if (
    doc.proof.verificationMethod &&
    doc.proof.verificationMethod !== subject
  ) {
    return {
      valid: false,
      recovered,
      subject: addressFromDidPkh(subject),
      reason: `proof.verificationMethod (${doc.proof.verificationMethod}) != identity.subject (${subject})`,
    };
  }

  const subjectAddr = addressFromDidPkh(subject);
  if (!subjectAddr) {
    // Non-did:pkh subject (e.g. did:web). We can recover the signer but cannot
    // assert equality against an EVM address here.
    return {
      valid: false,
      recovered,
      subject: null,
      reason: `identity.subject is not a did:pkh:eip155 address: ${subject}`,
    };
  }

  const valid = recovered.toLowerCase() === subjectAddr.toLowerCase();
  return {
    valid,
    recovered,
    subject: subjectAddr,
    ...(valid
      ? {}
      : {
          reason: `recovered signer ${recovered} != subject ${subjectAddr}`,
        }),
  };
}

/**
 * Convenience wrapper: returns the recovered signer address and throws if the
 * signature does not recover to `identity.subject`.
 */
export async function recoverSigner(doc: HeartPrefs): Promise<Address> {
  const result = await verifyDoc(doc);
  if (!result.valid) {
    throw new Error(`verifyDoc failed: ${result.reason ?? "invalid signature"}`);
  }
  return result.recovered;
}
