#!/bin/bash
# typecheck → selftest → APK → screenshots → contact sheets. Run on HPC from thali/.
set -e
W=${CALTRACK_WORK:-$HOME/caltrack-build}  # build folder: holds tools/env.sh, the APK and screenshots; source $W/tools/env.sh; cd $W/thali
npx tsc --noEmit
npx -y tsx tools/selftest.ts
CI=1 npx expo prebuild --platform android --clean --no-install > $W/prebuild.log 2>&1
/opt/anaconda3/bin/python3 tools/sign.py
(cd android && ./gradlew assembleRelease --no-daemon -q -Dorg.gradle.jvmargs=-Xmx8g --max-workers=24 -PreactNativeArchitectures=arm64-v8a,x86_64 > $W/gradle.log 2>&1) || { tail -40 $W/gradle.log; exit 1; }
adb uninstall com.caltrack.app >/dev/null 2>&1 || true
rm -rf $W/shots; bash tools/shoot.sh
/opt/anaconda3/bin/python3 tools/sheet.py $W/shots $W/sheets
cp android/app/build/outputs/apk/release/app-release.apk $W/Caltrack.apk
echo PIPELINE_OK
