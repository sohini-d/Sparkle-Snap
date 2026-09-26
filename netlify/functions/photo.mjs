import { photos, ID_RE, isExpired } from "../lib/shared.mjs";

export default async (req, context) => {
  const id = context.params.id;
  if (!ID_RE.test(id)) return new Response("not found", { status: 404 });

  const entry = await photos().getWithMetadata(id, { type: "arrayBuffer" });
  if (!entry || isExpired(entry.metadata)) return new Response("not found", { status: 404 });

  return new Response(entry.data, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": 'inline; filename="sparkle-snap.jpg"',
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
};

export const config = { path: "/photos/:id" };
