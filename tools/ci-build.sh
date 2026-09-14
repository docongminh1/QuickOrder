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

echo "== patch build.gradle (ký release) + chỉ build ARM"
python3 - <<'PY'
import re
p='android/app/build.gradle'; s=open(p).read()
if 'keystore.properties' not in s:
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
    s=re.sub(r"(release \{[^}]*?)signingConfig signingConfigs\.debug", r"\1signingConfig ksFile.exists() ? signingConfigs.release : signingConfigs.debug", s, count=1, flags=re.S)
    open(p,'w').write(s)
g='android/gradle.properties'; t=open(g).read()
t=re.sub(r"^reactNativeArchitectures=.*$", "reactNativeArchitectures=armeabi-v7a,arm64-v8a", t, flags=re.M)
open(g,'w').write(t)
print('gradle patched')
PY

echo "== gradle assembleRelease"
cd android && ./gradlew assembleRelease --console=plain --no-daemon
cd ..
VER=$(python3 -c "import json;print(json.load(open('app.json'))['expo']['version'])")
mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk "dist/CatLieuNhanh-v$VER.apk"
echo "APK_NAME=CatLieuNhanh-v$VER.apk" >> "${GITHUB_OUTPUT:-/dev/null}"
echo "APK_VERSION=$VER" >> "${GITHUB_OUTPUT:-/dev/null}"
ls -la dist/
