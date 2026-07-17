#!/usr/bin/env bash
# Download the real media assets from the live WordPress site into ./assets/.
# The favicon and portrait are now real, checked-in assets (assets/images/
# favicon*, assets/images/profile.jpg) — only the music-sheet PDFs still come
# from the old site. Run this once (locally, or from any machine that can
# reach mmendelson.com). After the assets are in place, run: python3 build.py
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/files

curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/Caneta-e-Papel.pdf" -o "assets/files/Caneta-e-Papel.pdf"
curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/Casal-Feliz.pdf" -o "assets/files/Casal-Feliz.pdf"
curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/EVERYTHING-Alto-Sax.pdf" -o "assets/files/EVERYTHING-Alto-Sax.pdf"
curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/Ill-Wait-for-You.pdf" -o "assets/files/Ill-Wait-for-You.pdf"
curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/Não-Há-Limites.pdf" -o "assets/files/Não-Há-Limites.pdf"
echo "Done. Now run: python3 build.py"
