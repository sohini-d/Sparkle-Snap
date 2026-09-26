import { photos, newId } from "../lib/shared.mjs";

const MAX_BYTES = 5 * 1024 * 1024;

export default async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // Only booths that know the secret key can upload.
  const expected = Netlify.env.get("BOOTH_KEY");
  if (!expected || req.headers.get("x-booth-key") !== expected) {
    return new Response("wrong booth key", { status: 401 });
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

export const config = { path: "/api/upload" };
