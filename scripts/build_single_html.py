#!/usr/bin/env python3
"""Pack the website in docs/ into one self-contained HTML file.

    python3 scripts/build_single_html.py

Reads docs/index.html and writes dist/parkinsons-voice-site.html with the
stylesheet, D3, the data and the page script all inside it. The result opens
by double-click, works offline and makes no network requests, so it can be
emailed or handed in as a single file.

Run it from anywhere; paths are worked out from this script's location.
Rebuild it after any change to docs/ (for example after `Rscript scripts/export.R`).
Needs only Python 3, no extra packages.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = ROOT / "dist" / "parkinsons-voice-site.html"


def read(rel):
    path = DOCS / rel
    if not path.is_file():
        sys.exit(f"Missing file: {path}")
    return path.read_text(encoding="utf-8")


def main():
    html = read("index.html")

    # <link rel="stylesheet" href="css/style.css">  ->  <style>…</style>
    def inline_css(match):
        return "<style>\n" + read(match.group(1)) + "\n</style>"

    html, n_css = re.subn(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)

    # <script src="…"></script>  ->  <script>…</script>
    # "</script" inside the code would end the tag early, so it is written as "<\/script".
    def inline_js(match):
        code = read(match.group(1)).replace("</script", "<\\/script")
        return "<script>\n" + code + "\n</script>"

    html, n_js = re.subn(r'<script src="([^"]+)"></script>', inline_js, html)

    if n_css != 1 or n_js != 3:
        sys.exit(f"Expected 1 stylesheet and 3 scripts in docs/index.html, found {n_css} and {n_js}.")

    # Nothing may still point at another file or at the network.
    left = re.findall(r'<(?:script|link|img|iframe|source)\b[^>]*\b(?:src|href)="(?!data:|#)[^"]*"', html)
    if left:
        sys.exit("Still refers to outside files: " + "; ".join(left))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
