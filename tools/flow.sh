#!/bin/bash
# End-to-end flow on the emulator: fresh install → onboarding → quick log → food detail → water → weight.
# Fails loudly if an expected text never appears. Screens saved to $W/flow/.
W=${CALTRACK_WORK:-$HOME/caltrack-build}  # build folder: holds tools/env.sh, the APK and screenshots; source $W/tools/env.sh
PKG=com.caltrack.app; OUT=$W/flow; rm -rf $OUT; mkdir -p $OUT
APK=$W/Caltrack.apk
step=0
dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml; }
shot() { step=$((step+1)); adb exec-out screencap -p > $OUT/$(printf %02d $step)_$1.png; }
# tap the centre of the first node whose text or content-desc contains $1
tapText() {
  for i in 1 2 3 4 5 6; do
    b=$(dump | python3 -c "
import sys,re,html
x=sys.stdin.read(); q=sys.argv[1].lower()
for m in re.finditer(r'<node [^>]*>', x):
    n=m.group(0); t=html.unescape(re.search(r'text=\"([^\"]*)\"',n).group(1)+' '+re.search(r'content-desc=\"([^\"]*)\"',n).group(1)).lower()
    if q in t:
        a=list(map(int,re.findall(r'\d+',re.search(r'bounds=\"([^\"]*)\"',n).group(1)))); print((a[0]+a[2])//2,(a[1]+a[3])//2); break
" "$1")
    [ -n "$b" ] && { adb shell input tap $b; sleep 1.2; return 0; }
    sleep 1.5
  done
  echo "FAIL: text not found: $1"; shot fail; exit 1
}
expect() { for i in 1 2 3 4 5 6; do dump | grep -qi -- "$1" && return 0; sleep 1.5; done; echo "FAIL: expected '$1'"; shot fail; exit 1; }

adb uninstall $PKG >/dev/null 2>&1; adb install -g $APK | tail -1
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 6
expect "set your targets"; shot onboarding
adb shell input swipe 540 1900 540 300 300; sleep 1; adb shell input swipe 540 1900 540 300 300; sleep 1
expect "kcal/day"; shot plan
tapText "Start tracking"
expect "kcal left"; shot today_empty
# quick log by text
tapText "Quick log what you ate"; adb shell input text "2%sroti,%s1%skatori%srajma"; adb shell input keyevent 66; sleep 3
expect "Check"; expect "Rajma curry"; shot quick
tapText "Log 2 items"
adb shell input swipe 540 1800 540 900 300; sleep 1; expect "Chapati"; expect "Rajma curry"; shot today_logged; adb shell input swipe 540 900 540 1900 300; sleep 1
# water
tapText "Add a glass, 250 ml"; tapText "Add a bottle, 500 ml"; expect "Water"; shot water
# open nutrients
tapText "All 30 nutrients"; expect "Keep under"; shot nutrients
adb shell input keyevent 4; sleep 1
# search + food detail + add
tapText "Log food"; sleep 1; adb shell input text "paneer"; sleep 2; shot search
tapText "Paneer butter masala"; expect "Portion"; shot food
tapText "Add to"; sleep 2; adb shell input swipe 540 1900 540 600 300; sleep 1; expect "Paneer butter masala"; shot today_after
echo FLOW_OK; ls $OUT
