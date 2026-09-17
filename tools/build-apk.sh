#!/bin/bash
# Build APK release có ký (keystore riêng) — chạy từ gốc project
set -e
cd "$(dirname "$0")/.."
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

if [ ! -d android ] || [ "${1:-}" = "--prebuild" ]; then
  echo "== prebuild android"
  npx expo prebuild --platform android --no-install
fi

KS=android/app/catlieunhanh-release.keystore
mkdir -p .secrets
if [ ! -f "$KS" ] && [ -f .secrets/catlieunhanh-release.keystore ]; then
  cp .secrets/catlieunhanh-release.keystore "$KS"; cp .secrets/keystore.properties android/keystore.properties
fi
if [ ! -f "$KS" ]; then
  echo "== tạo keystore"
  PASS=$(openssl rand -hex 12)
  keytool -genkeypair -v -storetype PKCS12 -keystore "$KS" -alias catlieunhanh -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" -dname "CN=Cat Lieu Nhanh, O=basebs, C=VN"
  cat > android/keystore.properties <<EOP
storeFile=catlieunhanh-release.keystore
storePassword=$PASS
keyAlias=catlieunhanh
keyPassword=$PASS
EOP
fi
cp "$KS" .secrets/ 2>/dev/null; cp android/keystore.properties .secrets/ 2>/dev/null

python3 tools/patch-android.py

echo "== gradle assembleRelease"
cd android && ./gradlew assembleRelease --no-daemon -q
cd ..
APK=android/app/build/outputs/apk/release/app-release.apk
ls -la "$APK"
mkdir -p dist
VER=$(python3 -c "import json;print(json.load(open('app.json'))['expo']['version'])")
# soát manifest thật của APK phải khớp app.json (không tin tên file)
AAPT=$(ls -d "$ANDROID_HOME"/build-tools/*/aapt2 | sort -V | tail -1)
GOT=$("$AAPT" dump badging "$APK" | grep -o "versionName='[^']*'" | cut -d"'" -f2)
if [ "$GOT" != "$VER" ]; then echo "!! APK mang versionName $GOT, app.json là $VER — không copy"; exit 1; fi
cp "$APK" "dist/CatLieuNhanh-v$VER.apk"
echo "== DONE dist/CatLieuNhanh-v$VER.apk (manifest $GOT)"
