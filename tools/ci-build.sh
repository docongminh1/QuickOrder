#!/bin/bash
# Build APK release trên GitHub Actions (hoặc máy bất kỳ) — keystore lấy từ biến môi trường
# Cần: KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== prebuild android"
rm -rf android
npx expo prebuild --platform android --no-install

echo "== keystore"
echo "$KEYSTORE_BASE64" | base64 -d > android/app/catlieunhanh-release.keystore
cat > android/keystore.properties <<EOP
storeFile=catlieunhanh-release.keystore
storePassword=$KEYSTORE_PASSWORD
keyAlias=$KEY_ALIAS
keyPassword=$KEY_PASSWORD
EOP

echo "== patch android"
python3 tools/patch-android.py

echo "== gradle assembleRelease"
cd android && ./gradlew assembleRelease --console=plain --no-daemon
cd ..
VER=$(python3 -c "import json;print(json.load(open('app.json'))['expo']['version'])")
mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk "dist/CatLieuNhanh-v$VER.apk"
echo "APK_NAME=CatLieuNhanh-v$VER.apk" >> "${GITHUB_OUTPUT:-/dev/null}"
echo "APK_VERSION=$VER" >> "${GITHUB_OUTPUT:-/dev/null}"
ls -la dist/
