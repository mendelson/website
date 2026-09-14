#!/usr/bin/env python3
"""Serve the three family sites over HTTPS on one port, routed by Host header.

    python3 serve_family.py <cert.pem> [port]

Paired with Chromium's --host-resolver-rules (see verify.js), this is what lets
a browser visit https://mmendelson.com/ and https://apps.mmendelson.com/ for
real. Nothing else can answer the question the check exists for: whether the
GA4 cookies are shared across the subdomains. Same-origin tricks cannot fake
it — the browser decides by hostname.

It also answers for Google:

  * www.googletagmanager.com serves ./tagmanager/gtag/js, a real copy of
    gtag.js fetched by run.sh — so the browser runs Google's actual tag;
  * every collection host answers 204 and appends the request to collected.log,
    so a hit can be *observed* without ever reaching the live property.

Site roots come from MM_SITE_ROOTS (host=path, comma separated) or default to
the three repos checked out side by side.
"""
import http.server
import os
import ssl
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SIBLINGS = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))

DEFAULT_ROOTS = {
    "mmendelson.com": os.path.join(SIBLINGS, "website", "public"),
    "apps.mmendelson.com": os.path.join(SIBLINGS, "apps-website"),
    "run.mmendelson.com": os.path.join(SIBLINGS, "corridas", "web"),
}

ROOTS = dict(DEFAULT_ROOTS)
for pair in filter(None, os.environ.get("MM_SITE_ROOTS", "").split(",")):
    host, _, path = pair.partition("=")
    ROOTS[host.strip()] = path.strip()
ROOTS["www.googletagmanager.com"] = os.path.join(HERE, "tagmanager")

# Hosts that would be a real hit. They answer 204 and are logged instead, so
# the tag behaves normally and nothing reaches Google.
COLLECTORS = ("google-analytics.com", "analytics.google.com", "doubleclick.net",
              "googleadservices.com", "google.com")
COLLECTED_LOG = os.path.join(HERE, "collected.log")


class Handler(http.server.SimpleHTTPRequestHandler):
    def _host(self):
        return (self.headers.get("Host") or "").split(":")[0]

    def _collector(self):
        host = self._host()
        if not any(host == c or host.endswith("." + c) for c in COLLECTORS):
            return False
        with open(COLLECTED_LOG, "a", encoding="utf-8") as f:
            f.write(self.command + " " + host + self.path + "\n")
        self.send_response(204)
        self.end_headers()
        return True

    def do_GET(self):
        if not self._collector():
            http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        if not self._collector():
            self.send_response(204)
            self.end_headers()

    def translate_path(self, path):
        root = ROOTS.get(self._host(), ROOTS["mmendelson.com"])
        rel = path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
        full = os.path.normpath(os.path.join(root, rel))
        if not full.startswith(root):
            return root
        return os.path.join(full, "index.html") if os.path.isdir(full) else full

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    cert = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8443
    missing = [h for h, p in ROOTS.items() if not os.path.isdir(p)]
    if missing:
        sys.exit("no directory for: %s (set MM_SITE_ROOTS)" % ", ".join(missing))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    httpd.serve_forever()
