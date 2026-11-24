#!/bin/bash
# Gemini features end-to-end on the emulator. The API key is read from stdin (never an argument or a file)
# and the app is uninstalled at the end so the key does not stay on the emulator.
# Usage (from the laptop): <print key> | ssh hpc 'bash .../tools/ai_flow.sh'
W=${CALTRACK_WORK:-$HOME/caltrack-build}  # build folder: holds tools/env.sh, the APK and screenshots; source $W/tools/env.sh
PKG=com.caltrack.app; OUT=$W/aiflow; rm -rf $OUT; mkdir -p $OUT
read -r KEY
step=0
dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml; }
shot() { step=$((step+1)); adb exec-out screencap -p > $OUT/$(printf %02d $step)_$1.png; }
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
  echo "FAIL: text not found: $1"; shot fail_$step; return 1
}
waitFor() { for i in $(seq 1 ${2:-30}); do dump | grep -qiE -- "$1" && return 0; sleep 2; done; echo "FAIL: timed out waiting for '$1'"; shot timeout; return 1; }
texts() { dump | python3 -c "import sys,re,html; print(' | '.join(t for t in (html.unescape(x) for x in re.findall(r'text=\"([^\"]+)\"', sys.stdin.read())) if t.strip())[:1500])"; }
open() { adb shell am start -W -a android.intent.action.VIEW -d "$1" $PKG >/dev/null 2>&1; sleep ${2:-3}; }

adb uninstall $PKG >/dev/null 2>&1; adb install -g $W/Caltrack.apk | tail -1
adb logcat -c
open "caltrack://demo?theme=night" 9

echo "== 1. key: save & test"
open "caltrack://profile" 4
adb shell input swipe 540 1700 540 900 300; sleep 1
tapText "AIza" && printf '%s\n' "$KEY" | adb shell 'read k; input text "$k"'
adb shell input keyevent 111; sleep 1
tapText "Save & test"
waitFor "Gemini works|Key or model problem" 30 && { shot key_test; texts | grep -oE "(Gemini works|Key or model problem)[^|]*\|[^|]*"; tapText "OK"; }

echo "== 2. coach: plan the rest of my day"
open "caltrack://coach" 4
tapText "Plan the rest of my day"
sleep 5; waitFor "kcal|protein|katori" 45; sleep 3; shot coach
texts | cut -c1-700

echo "== 3. new food: fill with AI"
open "caltrack://custom-food" 4
tapText "Mom's aloo" && adb shell input text "Bhindi%smasala"
adb shell input keyevent 111; sleep 1
tapText "Fill with AI"
sleep 18; shot ai_fill
texts | cut -c1-600
dump | grep -q 'text="OK"' && tapText "OK" >/dev/null   # close an error popup so the next step can run
adb shell input keyevent 4; sleep 1

echo "== 4. meal photo from gallery"
curl -sL -A "caltrack-test/1.0" "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=File:North%20Indian%20thali%20dal%20roti%20rice&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime&iiurlwidth=1024" \
 | python3 -c "import json,sys; p=json.load(sys.stdin)['query']['pages'].values(); u=[x['imageinfo'][0] for x in p if x['imageinfo'][0]['mime']=='image/jpeg']; print(u[0]['thumburl']); print(u[0]['descriptionurl'], file=sys.stderr)" > $OUT/url.txt 2> $OUT/source.txt
curl -sL -A "caltrack-test/1.0" -o $OUT/meal.jpg "$(cat $OUT/url.txt)"; echo "photo: $(cat $OUT/source.txt) ($(stat -c %s $OUT/meal.jpg) bytes)"
adb push $OUT/meal.jpg /sdcard/Pictures/meal.jpg >/dev/null
adb shell content call --uri content://media --method scan_volume --arg external_primary >/dev/null 2>&1; sleep 3
open "caltrack://add" 4
tapText "From gallery"; sleep 4; shot picker
# first photo tile in the system picker
tapText "Photo taken" || tapText "meal" || adb shell input tap 180 700
sleep 3; tapText "Done" >/dev/null 2>&1
waitFor "Log [0-9]+ item" 60; sleep 2; shot photo_result
texts | cut -c1-900

echo "== app errors in logcat"
adb logcat -d | grep -E "FATAL|ReactNativeJS.*(Error|Warn)|AndroidRuntime" | head -15 || true
echo "== storage on device"
adb root >/dev/null 2>&1; sleep 2
adb shell 'du -sh /data/app/*/com.caltrack.app-* /data/data/com.caltrack.app 2>/dev/null; du -sh /data/data/com.caltrack.app/files/SQLite /data/data/com.caltrack.app/databases 2>/dev/null'
adb uninstall $PKG >/dev/null 2>&1; echo "app uninstalled (key removed from emulator)"
echo AI_FLOW_DONE
