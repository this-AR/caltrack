"""After `expo prebuild`, point the release build at the private keystore (kept outside the repo in $W/keys)."""
import os, re, sys
W = os.environ.get('CALTRACK_WORK', os.path.expanduser('~/caltrack-build'))  # keystore lives in $W/keys, never in the repo
p = 'android/app/build.gradle'
s = open(p).read()
pw = open(f'{W}/keys/pass.txt').read().strip()
rel = f"""        release {{
            storeFile file('{W}/keys/caltrack.jks')
            storePassword '{pw}'
            keyAlias 'caltrack'
            keyPassword '{pw}'
        }}
"""
s = s.replace('    signingConfigs {\n', '    signingConfigs {\n' + rel, 1)
# the release buildType is the second "signingConfig signingConfigs.debug"
i = s.index('buildTypes')
head, tail = s[:i], s[i:]
tail = re.sub(r'(release \{[^}]*?)signingConfig signingConfigs\.debug', r'\1signingConfig signingConfigs.release', tail, count=1, flags=re.S)
assert 'signingConfig signingConfigs.release' in tail, 'release buildType not found'
open(p, 'w').write(head + tail)
print('signed with private key')
