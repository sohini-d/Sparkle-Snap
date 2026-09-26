import { getStore } from "@netlify/blobs";

export const KEEP_HOURS = 24;
export const ID_RE = /^[a-z0-9]{10}$/;

export const photos = () => getStore({ name: "photos", consistency: "strong" });

export function newId() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

export function isExpired(metadata) {
  return !metadata?.created || Date.now() - metadata.created > KEEP_HOURS * 3600 * 1000;
}
