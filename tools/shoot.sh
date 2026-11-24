#!/bin/bash
# Install the release APK on the running emulator and capture each screen in each theme.
# Usage: bash tools/shoot.sh [themes...]   → $CALTRACK_WORK/shots/<theme>_<screen>.png
W=${CALTRACK_WORK:-$HOME/caltrack-build}  # build folder: holds tools/env.sh, the APK and screenshots; source $W/tools/env.sh
APK=$W/thali/android/app/build/outputs/apk/release/app-release.apk
OUT=$W/shots; mkdir -p $OUT
PKG=com.caltrack.app
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 3; done
adb shell settings put global window_animation_scale 0; adb shell settings put global transition_animation_scale 0; adb shell settings put global animator_duration_scale 0
adb install -r -g $APK | tail -1
open() { adb shell am start -W -a android.intent.action.VIEW -d "$1" $PKG > /dev/null; sleep ${2:-4}; }
shot() { adb exec-out screencap -p > $OUT/$1.png; }
THEMES=${@:-night caltrack}
for t in $THEMES; do
  open "caltrack://demo?theme=$t" 8
  shot ${t}_1today
  adb shell input swipe 540 1900 540 500 400; sleep 1.5; shot ${t}_2today_scroll
  adb shell input swipe 540 1900 540 300 300; sleep 0.5; adb shell input swipe 540 1900 540 300 300; sleep 1.5; shot ${t}_3suggestions
  open "caltrack://progress" 4; shot ${t}_4progress
  open "caltrack://nutrients" 4; shot ${t}_5nutrients
  open "caltrack://add" 4; adb shell input text "rajma"; sleep 2; shot ${t}_6search
  open "caltrack://profile" 4; shot ${t}_7profile
  adb shell am force-stop $PKG
done
adb logcat -d -s ReactNativeJS:E AndroidRuntime:E | tail -30 > $OUT/errors.txt
ls $OUT | wc -l
