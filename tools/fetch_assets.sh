#!/usr/bin/env bash
# Download the real media assets from the live WordPress site into ./assets/
# Run this once (locally, or from any machine that can reach mmendelson.com).
# After the assets are in place, run:  python3 build.py
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/images assets/files

curl -fSL "https://mmendelson.com/wp-content/uploads/2025/12/1002548606.jpg" -o "assets/images/1002548606.jpg"
curl -fSL "https://mmendelson.com/wp-content/uploads/2025/12/1002548979.png" -o "assets/images/1002548979.png"
curl -fSL "https://mmendelson.com/wp-content/uploads/2025/12/1002548990.png" -o "assets/images/1002548990.png"
curl -fSL "https://mmendelson.com/wp-content/uploads/2025/12/1002548993.jpg" -o "assets/images/1002548993.jpg"
curl -fSL "https://mmendelson.com/wp-content/uploads/2025/12/1002549032.jpg" -o "assets/images/1002549032.jpg"
curl -fSL "https://mmendelson.com/wp-content/uploads/2025/12/1002549210.jpg" -o "assets/images/1002549210.jpg"
curl -fSL "https://mmendelson.com/wp-content/uploads/2025/12/1002549240.jpg" -o "assets/images/1002549240.jpg"
curl -fSL "https://mmendelson.com/wp-content/uploads/2025/12/1002549251.jpg" -o "assets/images/1002549251.jpg"
curl -fSL "https://mmendelson.com/wp-content/uploads/2025/12/1002549254.png" -o "assets/images/1002549254.png"
curl -fSL "https://mmendelson.com/wp-content/uploads/2020/02/cropped-logomendi-favicon.png" -o "assets/images/cropped-logomendi-favicon.png"
curl -fSL "https://mmendelson.com/wp-content/uploads/2020/02/cropped-logomendi-favicon-32x32.png" -o "assets/images/cropped-logomendi-favicon-32x32.png"
curl -fSL "https://mmendelson.com/wp-content/uploads/2020/02/cropped-logomendi-favicon-192x192.png" -o "assets/images/cropped-logomendi-favicon-192x192.png"
curl -fSL "https://mmendelson.com/wp-content/uploads/2020/02/cropped-logomendi-favicon-180x180.png" -o "assets/images/cropped-logomendi-favicon-180x180.png"
curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/cropped-profile_01_cut_portrait-1.png" -o "assets/images/cropped-profile_01_cut_portrait-1.png"

curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/Caneta-e-Papel.pdf" -o "assets/files/Caneta-e-Papel.pdf"
curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/Casal-Feliz.pdf" -o "assets/files/Casal-Feliz.pdf"
curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/EVERYTHING-Alto-Sax.pdf" -o "assets/files/EVERYTHING-Alto-Sax.pdf"
curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/Ill-Wait-for-You.pdf" -o "assets/files/Ill-Wait-for-You.pdf"
curl -fSL "https://mmendelson.com/wp-content/uploads/2018/07/Não-Há-Limites.pdf" -o "assets/files/Não-Há-Limites.pdf"
echo "Done. Now run: python3 build.py"
