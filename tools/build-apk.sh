#!/bin/bash
# Build APK release có ký (keystore riêng) — chạy từ gốc project
set -e
cd "$(dirname "$0")/.."
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

if [ ! -d android ]; then
  echo "== prebuild android"
  npx expo prebuild --platform android --no-install
fi

KS=android/app/catlieunhanh-release.keystore
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

# nối signing release vào build.gradle (1 lần)
if ! grep -q "keystore.properties" android/app/build.gradle; then
  echo "== patch build.gradle"
  python3 - <<'PY'
p='android/app/build.gradle'; s=open(p).read()
s=s.replace("android {", """def ksProps = new Properties()
def ksFile = rootProject.file('keystore.properties')
if (ksFile.exists()) { ksProps.load(new FileInputStream(ksFile)) }

android {""",1)
s=s.replace("""    signingConfigs {
        debug {""","""    signingConfigs {
        release {
            if (ksFile.exists()) {
                storeFile file(ksProps['storeFile'])
                storePassword ksProps['storePassword']
                keyAlias ksProps['keyAlias']
                keyPassword ksProps['keyPassword']
            }
        }
        debug {""",1)
import re
s=re.sub(r"(release \{[^}]*?)signingConfig signingConfigs\.debug", r"\1signingConfig ksFile.exists() ? signingConfigs.release : signingConfigs.debug", s, count=1, flags=re.S)
open(p,'w').write(s); print('gradle patched')
PY
fi

echo "== gradle assembleRelease"
cd android && ./gradlew assembleRelease --no-daemon -q
cd ..
APK=android/app/build/outputs/apk/release/app-release.apk
ls -la "$APK"
mkdir -p dist
VER=$(python3 -c "import json;print(json.load(open('app.json'))['expo']['version'])")
cp "$APK" "dist/CatLieuNhanh-v$VER.apk"
echo "== DONE dist/CatLieuNhanh-v$VER.apk"
