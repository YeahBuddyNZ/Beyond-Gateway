#!/bin/sh
# The Beyond Family link: a code to link, a report a minute, the secret kept to root, and forgetting the link when
# Beyond Family says it no longer knows this router. The internet is a stub that answers like Beyond Family does.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d)
mkdir -p "$dir/bin" "$dir/etc" "$dir/tmp"
# jsonfilter -e @.key, as OpenWrt's does for the simple answers Beyond Family sends.
cat >"$dir/bin/jsonfilter" <<'STUB'
#!/bin/sh
key=${2#@.}
exec node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s)[process.argv[1]];if(v===undefined)process.exit(1);console.log(String(v))}catch{process.exit(1)}})' "$key"
STUB
cat >"$dir/bin/ubus" <<'STUB'
#!/bin/sh
[ "$*" = "call beyond family_report" ] || exit 1
printf '{\n\t"version": "1.150",\n\t"devices": [ { "name": "Lounge TV", "online": true } ]\n}\n'
STUB
# The stub server: -O - --post-data=BODY URL. It logs each request and answers from $dir/answer-<path>.
cat >"$dir/fetch" <<STUB
#!/bin/sh
body=\${3#--post-data=}
path=\${4##*/api}
printf '%s %s\n' "\$path" "\$body" >>"$dir/requests"
f="$dir/answer\$(echo "\$path" | tr / -)"
[ -f "$dir/offline" ] && { echo "Connection failed" >&2; exit 4; }
[ -f "$dir/unknown" ] && [ "\$path" != /gateway/hello ] && { echo "HTTP error 401" >&2; exit 8; }
cat "\$f"
STUB
chmod +x "$dir/bin/"* "$dir/fetch"
export PATH="$dir/bin:$PATH" BEYOND_ETC="$dir/etc" BEYOND_FAMILY_DIR="$dir/tmp" BEYOND_FETCH="sh $dir/fetch" BEYOND_FAMILY_URL="https://example.test/api"
fam() { sh "$ROOT/files/usr/libexec/beyond/family" "$@" 2>/dev/null; }
fails=0
fail() { echo "FAIL $1"; fails=1; }
answer() { printf '%s' "$2" >"$dir/answer$(echo "$1" | tr / -)"; }

ID=0b9d3c1e-2f4a-4b6c-8d7e-9f0a1b2c3d4e
SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde
answer /gateway/hello "{\"id\":\"$ID\",\"secret\":\"$SECRET\",\"code\":\"KQXRMB\",\"minutes\":10}"
answer /gateway/report '{"linked":false,"waiting":true}'

fam report
[ -f "$dir/requests" ] && fail "a router that was never linked should not call out"

fam link
[ "$(head -1 "$dir/tmp/code")" = KQXRMB ] || fail "linking should show the code"
grep -q "^secret=$SECRET$" "$dir/etc/family" || fail "the secret should be kept"
[ "$(stat -c %a "$dir/etc/family")" = 600 ] || fail "only root may read the link file"

fam report
grep -q "^/gateway/report {\"id\":\"$ID\",\"secret\":\"$SECRET\",.*\"Lounge TV\"" "$dir/requests" || fail "the report should carry the link and the devices: $(tail -1 "$dir/requests")"
grep -q '^linked=0$' "$dir/etc/family" || fail "not linked yet"

answer /gateway/report '{"linked":true}'
before=$(stat -c %Y "$dir/etc/family")
fam report
grep -q '^linked=1$' "$dir/etc/family" || fail "a linked answer should be remembered"
[ -f "$dir/tmp/code" ] && fail "the code should go once linked"
touch -d '2000-01-01' "$dir/etc/family"
fam report
[ "$(stat -c %Y "$dir/etc/family")" = "$(date -d 2000-01-01 +%s)" ] || fail "an unchanged state should not be written again"

touch "$dir/offline"
fam report
grep -q '^linked=1$' "$dir/etc/family" || fail "no internet should keep the link"
fam link
grep -q "Couldn't reach" "$dir/tmp/message" || fail "linking with no internet should say so"
rm "$dir/offline"

# Unlinked on Beyond Family's side: the router forgets and goes quiet.
touch "$dir/unknown"
fam report
[ -f "$dir/etc/family" ] && fail "a router Beyond Family no longer knows should forget the link"
rm "$dir/unknown" "$dir/requests"
fam report
[ -f "$dir/requests" ] && fail "a forgotten router should stop calling out"

# A strange answer never goes into the file.
answer /gateway/hello '{"id":"x\nlinked=1","secret":"no","code":"KQXRMB"}'
fam link
[ -f "$dir/etc/family" ] && fail "a bad id or secret should be refused"

answer /gateway/hello "{\"id\":\"$ID\",\"secret\":\"$SECRET\",\"code\":\"KQXRMB\",\"minutes\":10}"
answer /gateway/bye '{"linked":false}'
fam link
fam unlink
grep -q "^/gateway/bye {\"id\":\"$ID\"" "$dir/requests" || fail "unlinking should tell Beyond Family"
[ -f "$dir/etc/family" ] && fail "unlinking should forget the link"

rm -rf "$dir"
[ $fails -eq 0 ] && echo "ok   family" || exit 1
