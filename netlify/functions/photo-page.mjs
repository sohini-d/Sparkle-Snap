import { photos, ID_RE, KEEP_HOURS, isExpired } from "../lib/shared.mjs";

const STYLE = `
  body { margin:0; min-height:100vh; font-family:'Sniglet',sans-serif; color:#5a2a4d; text-align:center;
    background-color:#ffd6ec; padding:24px 16px 48px; box-sizing:border-box;
    background-image:linear-gradient(45deg,#ffc4e4 25%,transparent 25%,transparent 75%,#ffc4e4 75%),
      linear-gradient(45deg,#ffc4e4 25%,transparent 25%,transparent 75%,#ffc4e4 75%);
    background-size:40px 40px; background-position:0 0,20px 20px; }
  h1 { font-weight:800; font-size:40px; margin:0; color:#fff; text-shadow:3px 3px 0 #ff4fa3,5px 5px 0 #8f6bff; }
  p { font-family:'Gochi Hand',cursive; font-size:21px; margin:8px 0 18px; }
  img { max-width:100%; max-height:70vh; border-radius:4px; transform:rotate(-1.5deg);
    box-shadow:6px 8px 0 rgba(90,42,77,.35); background:#fff; }
  .btns { display:flex; flex-direction:column; gap:12px; max-width:320px; margin:24px auto 0; }
  .btn { font-family:'Sniglet',sans-serif; font-weight:800; font-size:20px; text-decoration:none;
    padding:14px 20px; border-radius:999px; border:3px solid #5a2a4d; box-shadow:4px 4px 0 #5a2a4d;
    background:#ff4fa3; color:#fff; cursor:pointer; }
  button.btn { background:#b8f5e0; color:#5a2a4d; }
  small { display:block; margin-top:18px; font-size:14px; opacity:.75; }`;

const shell = (title, body) => `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Sniglet:wght@400;800&family=Gochi+Hand&display=swap" rel="stylesheet">
<style>${STYLE}</style></head>
<body>${body}</body></html>`;

const html = (body, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });

export default async (req, context) => {
  const id = context.params.id;
  const meta = ID_RE.test(id) ? await photos().getMetadata(id) : null;

  if (!meta || isExpired(meta.metadata)) {
    return html(shell("Photo gone", `
      <h1>🥺 oh no!</h1>
      <p>this photo has expired ~ photos are only kept for ${KEEP_HOURS} hours.</p>`), 404);
  }

  const src = `/photos/${id}`;
  return html(shell("Your Sparkle Snap", `
  <h1>✿ your pics! ✿</h1>
  <p>tap save, or press &amp; hold the photo ♡</p>
  <img src="${src}" alt="Your photobooth strip">
  <div class="btns">
    <button class="btn" id="share" hidden>💬 send to whatsapp / share</button>
    <a class="btn" href="${src}" download="sparkle-snap.jpg">💾 save to phone</a>
  </div>
  <small>this photo disappears in ${KEEP_HOURS} hours ✧</small>
<script>
  const btn = document.getElementById('share');
  if (navigator.canShare) {
    fetch('${src}').then(r => r.blob()).then(blob => {
      const file = new File([blob], 'sparkle-snap.jpg', { type: 'image/jpeg' });
      if (!navigator.canShare({ files: [file] })) return;
      btn.hidden = false;
      btn.onclick = () => navigator.share({ files: [file] }).catch(() => {});
    });
  }
</script>`));
};

export const config = { path: "/p/:id" };
