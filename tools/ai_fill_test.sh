#!/bin/bash
# Re-test "Fill with AI" with a long wait. Key from stdin; app uninstalled at the end.
W=${CALTRACK_WORK:-$HOME/caltrack-build}  # build folder: holds tools/env.sh, the APK and screenshots; source $W/tools/env.sh
PKG=com.caltrack.app; OUT=$W/aiflow
read -r KEY
dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml; }
tap() { b=$(dump | python3 -c "
import sys,re,html
x=sys.stdin.read(); q=sys.argv[1].lower()
for m in re.finditer(r'<node [^>]*>', x):
    n=m.group(0); t=html.unescape(re.search(r'text=\"([^\"]*)\"',n).group(1)+' '+re.search(r'content-desc=\"([^\"]*)\"',n).group(1)).lower()
    if q in t:
        a=list(map(int,re.findall(r'\d+',re.search(r'bounds=\"([^\"]*)\"',n).group(1)))); print((a[0]+a[2])//2,(a[1]+a[3])//2); break
" "$1"); [ -n "$b" ] && adb shell input tap $b; sleep 1.2; }
open() { adb shell am start -W -a android.intent.action.VIEW -d "$1" $PKG >/dev/null 2>&1; sleep ${2:-3}; }
adb install -g $W/Caltrack.apk | tail -1
open "caltrack://demo?theme=night" 9
open "caltrack://profile" 4; adb shell input swipe 540 1700 540 900 300; sleep 1
tap "AIza"; printf '%s\n' "$KEY" | adb shell 'read k; input text "$k"'; adb shell input keyevent 111; sleep 1
tap "Save & test"; for i in $(seq 1 40); do dump | grep -q 'text="OK"' && break; sleep 2; done; tap "OK"
open "caltrack://custom-food" 4
tap "Mom's aloo"; adb shell input text "Bhindi%smasala"; adb shell input keyevent 111; sleep 1
tap "Fill with AI"; t0=$(date +%s)
# done when an error popup shows or the Energy field is no longer 0 (the button keeps its label while loading)
sleep 3; for i in $(seq 1 60); do x=$(dump); echo "$x" | grep -q 'text="OK"' && break
  echo "$x" | python3 -c "import sys,re; t=re.findall(r'text=\"([^\"]*)\"[^>]*class=\"android.widget.EditText\"', sys.stdin.read()); sys.exit(0 if len(t)>3 and t[3] not in ('','0') else 1)" && break; sleep 2; done
echo "answered after $(( $(date +%s) - t0 )) s"
adb exec-out screencap -p > $OUT/06_ai_fill_done.png
dump | python3 -c "import sys,re,html; print(' | '.join(t for t in (html.unescape(x) for x in re.findall(r'text=\"([^\"]+)\"', sys.stdin.read())) if t.strip())[:700])"
adb uninstall $PKG >/dev/null; echo "uninstalled"
