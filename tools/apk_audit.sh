#!/bin/bash
# Security checks on the built APK (not the source). Run on HPC from thali/: bash tools/apk_audit.sh [apk]
W=${CALTRACK_WORK:-$HOME/caltrack-build}  # build folder: holds tools/env.sh, the APK and screenshots; source $W/tools/env.sh
APK=${1:-$W/Caltrack.apk}
BT=$(ls -d $ANDROID_HOME/build-tools/*/ | sort -V | tail -1)
T=$(mktemp -d); trap 'rm -rf $T' EXIT
echo "== signature"; ${BT}apksigner verify -v --print-certs "$APK" | grep -E "Verified using|Signer #1 certificate DN|SHA-256" | head -6
echo "== package"; ${BT}aapt2 dump badging "$APK" | grep -E "^package:|sdkVersion|targetSdkVersion|application-debuggable|uses-permission"
echo "== manifest flags"
${BT}aapt2 dump xmltree --file AndroidManifest.xml "$APK" > $T/m.txt
grep -E "allowBackup|usesCleartextTraffic|networkSecurityConfig|debuggable|fullBackupContent|dataExtractionRules" $T/m.txt | sed 's/^ *//' | sort -u
echo "== exported components"
awk '/E: (activity|service|receiver|provider|activity-alias)/{c=$2} /android:name/{if(c){n=$0}} /android:exported/{if(c){print c, n, $0; c=""}}' $T/m.txt | sed 's/  */ /g; s/(0x[0-9a-f]*)//g' | sort -u
echo "== deep-link schemes"; grep -E 'android:scheme' $T/m.txt | sed 's/^ *//' | sort -u
echo "== files that should not ship"
unzip -l "$APK" | grep -Ei '\.(env|jks|keystore|pem|p12|map)$|\.git/|google-services' || echo none
echo "== secrets / plain http in the JS bundle"
unzip -p "$APK" assets/index.android.bundle > $T/b.js 2>/dev/null
grep -aoE 'AIza[0-9A-Za-z_-]{35}' $T/b.js | sort -u || true
grep -aoE 'http://[a-zA-Z0-9./_-]+' $T/b.js | grep -vE 'http://(www\.w3\.org|localhost|127\.0\.0\.1|10\.0\.2\.2|schemas\.android)' | sort -u | head -20
grep -aoE 'https://[a-z0-9.-]+\.(googleapis|google)\.com' $T/b.js | sort -u
echo "bundle bytes: $(stat -c %s $T/b.js)"
echo "== dependency advisories (production only)"
npm audit --omit=dev --json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); m=d.get('metadata',{}).get('vulnerabilities',{}); print(m); [print(k, v.get('severity'), (v.get('via') or [{}])[0] if isinstance((v.get('via') or [''])[0], str) else (v.get('via') or [{}])[0].get('title')) for k,v in d.get('vulnerabilities',{}).items()]"
echo AUDIT_DONE
