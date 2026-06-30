import { getAddress, isAddress, type Address } from "viem";

/**
 * Parse the EVM address out of a `did:pkh:eip155:<chainId>:<address>` DID.
 * Returns the EIP-55 checksummed address, or null if the DID is not a
 * did:pkh eip155 identifier (e.g. did:web).
 */
export function addressFromDidPkh(did: string): Address | null {
  // did:pkh:eip155:<chainId>:<address>
  const parts = did.split(":");
  if (parts.length !== 5) return null;
  const [scheme, method, namespace, , address] = parts;
  if (scheme !== "did" || method !== "pkh" || namespace !== "eip155") {
    return null;
  }
  if (!address || !isAddress(address)) return null;
  return getAddress(address);
}

/** Build a `did:pkh:eip155:<chainId>:<address>` DID for an EVM wallet. */
export function didPkhFromAddress(address: string, chainId: number): string {
  if (!isAddress(address)) {
    throw new Error(`Not a valid EVM address: ${address}`);
  }
  return `did:pkh:eip155:${chainId}:${getAddress(address)}`;
}
