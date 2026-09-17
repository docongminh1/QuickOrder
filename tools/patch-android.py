# Vá lại android/ sau mỗi lần `expo prebuild`: ký release bằng keystore.properties + chỉ build ARM
import re, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(root, 'android/app/build.gradle'); s = open(p).read()
if 'keystore.properties' not in s:
    s = s.replace("android {", """def ksProps = new Properties()
def ksFile = rootProject.file('keystore.properties')
if (ksFile.exists()) { ksProps.load(new FileInputStream(ksFile)) }

android {""", 1)
    s = s.replace("""    signingConfigs {
        debug {""", """    signingConfigs {
        release {
            if (ksFile.exists()) {
                storeFile file(ksProps['storeFile'])
                storePassword ksProps['storePassword']
                keyAlias ksProps['keyAlias']
                keyPassword ksProps['keyPassword']
            }
        }
        debug {""", 1)
    s = re.sub(r"(release \{[^}]*?)signingConfig signingConfigs\.debug", r"\1signingConfig ksFile.exists() ? signingConfigs.release : signingConfigs.debug", s, count=1, flags=re.S)
    open(p, 'w').write(s); print('build.gradle: đã vá ký release')
else:
    print('build.gradle: đã có')
g = os.path.join(root, 'android/gradle.properties'); t = open(g).read()
t2 = re.sub(r"^reactNativeArchitectures=.*$", "reactNativeArchitectures=armeabi-v7a,arm64-v8a", t, flags=re.M)
if t2 != t: open(g, 'w').write(t2); print('gradle.properties: chỉ ARM')

# Đồng bộ version từ app.json vào build.gradle — prebuild chỉ chạy lần đầu, nên nếu không làm bước này
# APK build local mang versionName/versionCode cũ (từng xảy ra: file tên v1.0.9 nhưng manifest 1.0.6/7).
import json
cfg = json.load(open(os.path.join(root, 'app.json'), encoding='utf-8'))['expo']
ver, code = cfg['version'], int(cfg['android']['versionCode'])
s = open(p).read()
s2 = re.sub(r'^(\s*)versionCode \d+$', rf'\1versionCode {code}', s, count=1, flags=re.M)
s2 = re.sub(r'^(\s*)versionName "[^"]*"$', rf'\1versionName "{ver}"', s2, count=1, flags=re.M)
if s2 != s: open(p, 'w').write(s2); print(f'build.gradle: version → {ver} ({code})')
else: print(f'build.gradle: version đã đúng {ver} ({code})')
