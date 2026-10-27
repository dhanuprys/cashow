import type { WebAuthnCredential } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

/** Encode a COSE public key (or any bytes) for storage in a text column. */
export function encodeBytes(bytes: Uint8Array): string {
  return isoBase64URL.fromBuffer(new Uint8Array(bytes));
}

export function decodeBytes(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(isoBase64URL.toBuffer(value));
}

export function parseTransports(value: string | null): string[] | undefined {
  if (value === null || value === "") return undefined;
  return value
    .split(",")
    .map((transport) => transport.trim())
    .filter((transport) => transport !== "");
}

/** Shape a stored passkey for `verifyAuthenticationResponse`. */
export function toWebAuthnCredential(row: {
  credentialId: string;
  publicKey: string;
  counter: bigint;
  transports: string | null;
}): WebAuthnCredential {
  return {
    id: row.credentialId,
    publicKey: decodeBytes(row.publicKey),
    counter: Number(row.counter),
    transports: parseTransports(row.transports),
  };
}

/** A friendly label for the passkey list, derived from the browser UA. */
export function describeDevice(userAgent: string | null, deviceType: string | null): string {
  if (userAgent !== null) {
    if (/iPhone/i.test(userAgent)) return "iPhone";
    if (/iPad/i.test(userAgent)) return "iPad";
    if (/Android/i.test(userAgent)) return "Android";
    if (/Macintosh|Mac OS X/i.test(userAgent)) return "Mac";
    if (/Windows/i.test(userAgent)) return "Windows";
    if (/Linux/i.test(userAgent)) return "Linux";
  }
  if (deviceType === "MultiDevice") return "Passkey tersinkron";
  return "Passkey";
}
