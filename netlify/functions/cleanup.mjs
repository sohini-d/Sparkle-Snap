import { photos, isExpired } from "../lib/shared.mjs";

// Runs every hour and deletes photos older than KEEP_HOURS.
export default async () => {
  const store = photos();
  const { blobs } = await store.list();
  for (const { key } of blobs) {
    const meta = await store.getMetadata(key);
    if (!meta || isExpired(meta.metadata)) await store.delete(key);
  }
};

export const config = { schedule: "@hourly" };
