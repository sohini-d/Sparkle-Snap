import { photos, newId } from "../lib/shared.mjs";

const MAX_BYTES = 5 * 1024 * 1024;

// No booth key (owner's choice): any device that opens the booth can print.
// Uploads are still limited to the booth page itself, to JPEGs under 5MB,
// and are rate limited; photos auto-delete after 24 hours.
export default async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // Browsers always send Origin on POST, so this blocks other websites
  // from using our storage.
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) {
    return new Response("uploads only from the booth", { status: 403 });
  }

  const data = await req.arrayBuffer();
  const head = new Uint8Array(data.slice(0, 3));
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (!isJpeg || data.byteLength > MAX_BYTES) {
    return new Response("jpeg under 5MB only", { status: 400 });
  }

  const id = newId();
  await photos().set(id, data, { metadata: { created: Date.now() } });

  // PUBLIC_BASE_URL is only set for local testing (so phones on the same Wi-Fi
  // can reach this computer). Online, the site's own address is used.
  const base = Netlify.env.get("PUBLIC_BASE_URL") || req.url;
  const url = new URL(`/p/${id}`, base).toString();
  return Response.json({ id, url });
};

export const config = {
  path: "/api/upload",
  // A booth prints about once a minute; this stops anyone flooding the storage.
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
