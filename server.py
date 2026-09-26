"""Sparkle Snap booth server.

Serves the booth page, stores uploaded photo strips, and serves a cute
download page per photo so guests can scan a QR code and grab their pics.

Run:  python server.py
Booth: http://localhost:8765/photobooth.html
"""
import html
import json
import os
import re
import secrets
import socket
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))
PHOTO_DIR = os.path.join(ROOT, "photos")
KEEP_HOURS = 24
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ID_RE = re.compile(r"^[a-z0-9]{8}$")

os.makedirs(PHOTO_DIR, exist_ok=True)


def lan_ip():
    """The address phones on the same Wi-Fi can reach this computer at."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # no packets are sent; just picks the outbound interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def cleanup_loop():
    while True:
        cutoff = time.time() - KEEP_HOURS * 3600
        for name in os.listdir(PHOTO_DIR):
            path = os.path.join(PHOTO_DIR, name)
            if os.path.getmtime(path) < cutoff:
                os.remove(path)
        time.sleep(600)


DOWNLOAD_PAGE = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your Sparkle Snap</title>
<link href="https://fonts.googleapis.com/css2?family=Sniglet:wght@400;800&family=Gochi+Hand&display=swap" rel="stylesheet">
<style>
  body {{ margin:0; min-height:100vh; font-family:'Sniglet',sans-serif; color:#5a2a4d; text-align:center;
    background-color:#ffd6ec; padding:24px 16px 48px; box-sizing:border-box;
    background-image:linear-gradient(45deg,#ffc4e4 25%,transparent 25%,transparent 75%,#ffc4e4 75%),
      linear-gradient(45deg,#ffc4e4 25%,transparent 25%,transparent 75%,#ffc4e4 75%);
    background-size:40px 40px; background-position:0 0,20px 20px; }}
  h1 {{ font-weight:800; font-size:40px; margin:0; color:#fff; text-shadow:3px 3px 0 #ff4fa3,5px 5px 0 #8f6bff; }}
  p {{ font-family:'Gochi Hand',cursive; font-size:21px; margin:8px 0 18px; }}
  img {{ max-width:100%; max-height:70vh; border-radius:4px; transform:rotate(-1.5deg);
    box-shadow:6px 8px 0 rgba(90,42,77,.35); background:#fff; }}
  .btns {{ display:flex; flex-direction:column; gap:12px; max-width:320px; margin:24px auto 0; }}
  a.btn, button.btn {{ font-family:'Sniglet',sans-serif; font-weight:800; font-size:20px; text-decoration:none;
    padding:14px 20px; border-radius:999px; border:3px solid #5a2a4d; box-shadow:4px 4px 0 #5a2a4d;
    background:#ff4fa3; color:#fff; cursor:pointer; }}
  button.btn {{ background:#b8f5e0; color:#5a2a4d; }}
  small {{ display:block; margin-top:18px; font-size:14px; opacity:.75; }}
</style></head>
<body>
  <h1>✿ your pics! ✿</h1>
  <p>tap save, or press &amp; hold the photo ♡</p>
  <img src="/photos/{id}.png" alt="Your photobooth strip">
  <div class="btns">
    <a class="btn" href="/photos/{id}.png" download="sparkle-snap.png">💾 save to phone</a>
    <button class="btn" id="share" hidden>💬 share</button>
  </div>
  <small>this photo disappears in {hours} hours ✧</small>
<script>
  const btn = document.getElementById('share');
  if (navigator.canShare) {{
    fetch('/photos/{id}.png').then(r => r.blob()).then(blob => {{
      const file = new File([blob], 'sparkle-snap.png', {{ type: 'image/png' }});
      if (!navigator.canShare({{ files: [file] }})) return;
      btn.hidden = false;
      btn.onclick = () => navigator.share({{ files: [file] }}).catch(() => {{}});
    }});
  }}
</script>
</body></html>"""

NOT_FOUND_PAGE = """<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Photo gone</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px 16px;background:#ffd6ec;color:#5a2a4d">
<h1>🥺 this photo has expired</h1><p>photos are only kept for {hours} hours.</p></body></html>"""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_body(self, status, content_type, body):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]

        # Only the booth page, fonts-free static assets, and photos are public.
        if path == "/" or path == "/photobooth.html":
            self.path = "/photobooth.html"
            return super().do_GET()

        if path.startswith("/p/"):
            photo_id = path[3:]
            if ID_RE.match(photo_id) and os.path.exists(os.path.join(PHOTO_DIR, photo_id + ".png")):
                page = DOWNLOAD_PAGE.format(id=html.escape(photo_id), hours=KEEP_HOURS)
                return self.send_body(200, "text/html; charset=utf-8", page.encode())
            return self.send_body(404, "text/html; charset=utf-8", NOT_FOUND_PAGE.format(hours=KEEP_HOURS).encode())

        if path.startswith("/photos/") and path.endswith(".png"):
            photo_id = path[len("/photos/"):-4]
            if ID_RE.match(photo_id):
                return super().do_GET()

        self.send_body(404, "text/plain", b"not found")

    def do_POST(self):
        if self.path != "/upload":
            return self.send_body(404, "text/plain", b"not found")
        # Only the booth computer itself may upload.
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            return self.send_body(403, "text/plain", b"uploads only from the booth")

        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_UPLOAD_BYTES:
            return self.send_body(413, "text/plain", b"bad size")
        data = self.rfile.read(length)
        if not data.startswith(b"\x89PNG"):
            return self.send_body(400, "text/plain", b"png only")

        photo_id = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(8))
        with open(os.path.join(PHOTO_DIR, photo_id + ".png"), "wb") as f:
            f.write(data)

        url = f"http://{lan_ip()}:{PORT}/p/{photo_id}"
        self.send_body(200, "application/json", json.dumps({"id": photo_id, "url": url}).encode())

    def log_message(self, fmt, *args):
        print("[booth]", fmt % args)


if __name__ == "__main__":
    threading.Thread(target=cleanup_loop, daemon=True).start()
    print("Sparkle Snap running!")
    print(f"  Booth (open on this computer): http://localhost:{PORT}/photobooth.html")
    print(f"  Phones on the same Wi-Fi reach it at: http://{lan_ip()}:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
