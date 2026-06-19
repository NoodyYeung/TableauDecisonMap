#!/usr/bin/env python3
"""Local dev server for the Decision Map Tableau extension.

Serves this folder over HTTP so Tableau Desktop can load the extension from
http://localhost:8080/index.html. Sends no-cache headers so edits to the
JS/CSS/HTML are picked up on reload (no stale Tableau cache).

Usage:
    python3 serve.py           # http://localhost:8080
    python3 serve.py 8090      # custom port
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching so extension changes show on reload.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


def main():
    handler = partial(Handler, directory=DIRECTORY)
    # ThreadingHTTPServer handles Tableau's parallel requests; reuses the
    # address so quick restarts don't hit "Address already in use".
    with ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
        print(f"Decision Map dev server -> http://localhost:{PORT}/index.html")
        print(f"Serving {DIRECTORY}  (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
