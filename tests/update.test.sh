#!/bin/sh
# The updater installs only what Beyond signed, only when it is newer, and only the file whose checksum was signed.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
USIGN=$(sh "$ROOT/tests/need-usign.sh") || { echo "FAIL usign is needed for this test"; exit 1; }
dir=$(mktemp -d)
mkdir -p "$dir/bin" "$dir/etc" "$dir/server" "$dir/tmp"
ln -s "$USIGN" "$dir/bin/usign"
printf '#!/bin/sh\necho "$@" >>"%s/sysupgrade.log"\n' "$dir" >"$dir/bin/sysupgrade"
printf '#!/bin/sh\n' >"$dir/bin/logger"
printf '#!/bin/sh\n[ "$*" = "-q get beyond.updates.auto" ] && cat "%s/auto" 2>/dev/null\n' "$dir" >"$dir/bin/uci"
# The "internet": -O dest url copies the file named at the end of url out of server/.
printf '#!/bin/sh\n[ "$1" = -O ] || exit 1\ncp "%s/server/${3##*/}" "$2" 2>/dev/null\n' "$dir" >"$dir/fetch"
chmod +x "$dir/bin/"* "$dir/fetch"
export PATH="$dir/bin:$PATH" BEYOND_ETC="$dir/etc" BEYOND_UPDATE_DIR="$dir/tmp" BEYOND_FETCH="sh $dir/fetch"
export GATEWAY_UPDATE_KEY=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')
up() { sh "$ROOT/files/usr/libexec/beyond/update" "$@" 2>/dev/null; }
state() { sed -n "s/^$1=//p" "$dir/tmp/state"; }
fails=0
fail() { echo "FAIL $1"; fails=1; }

publish() { # build file-name
	echo "firmware $1" >"$dir/server/$2"
	sum=$(sha256sum "$dir/server/$2" | cut -d' ' -f1)
	printf 'build=%s\nversion=1.%s\ndate=23/10/2026\nnotes=Faster setup\nglinet_gl-mt6000=%s %s 9\n' "$1" "$1" "$2" "$sum" >"$dir/server/latest.txt"
	node "$ROOT/tools/update-key.mjs" sign "$dir/server/latest.txt"
}

printf 'build=100\nprofile=glinet_gl-mt6000\n' >"$dir/etc/build"
publish 142 fw-142.bin

up check
[ "$(state status)" = off ] || fail "a build with no key should say updates are off"

node "$ROOT/tools/update-key.mjs" public >"$dir/etc/update.pub"
up check
[ "$(state status)" = available ] && [ "$(state version)" = 1.142 ] || fail "a newer signed version should be available: $(cat "$dir/tmp/state")"

up install
grep -q "$dir/tmp/firmware.bin" "$dir/sysupgrade.log" 2>/dev/null || fail "a signed newer version should be installed"
grep -q -- "-n" "$dir/sysupgrade.log" && fail "settings must be kept"
rm -f "$dir/sysupgrade.log"

# A firmware file that is not the one Beyond signed.
up check
echo "something else" >"$dir/server/fw-142.bin"
up install
[ -f "$dir/sysupgrade.log" ] && grep -qv -- "-T" "$dir/sysupgrade.log" && fail "a file that does not match the signed checksum was installed"
[ "$(state status)" = available ] || fail "a bad download should leave the update available to try again"
rm -f "$dir/sysupgrade.log"

# A list that someone changed after Beyond signed it.
publish 143 fw-143.bin
sed -i 's/fw-143.bin/evil.bin/' "$dir/server/latest.txt"
up check
[ "$(state status)" = error ] || fail "a list changed after signing should be refused"
[ -f "$dir/tmp/latest.txt" ] && fail "a refused list should not be kept"
up install && fail "nothing should install after a refused list"

# The same version as installed.
publish 100 fw-100.bin
up check
[ "$(state status)" = current ] || fail "the same version should be current"

# A file name that leaves the release folder.
publish 150 fw-150.bin
sed -i 's#=fw-150.bin #=../fw-150.bin #' "$dir/server/latest.txt" && node "$ROOT/tools/update-key.mjs" sign "$dir/server/latest.txt"
up check && up install
[ -f "$dir/sysupgrade.log" ] && fail "a file name with a path was installed"; rm -f "$dir/sysupgrade.log"

# Nightly: installs by itself only with the switch on.
publish 160 fw-160.bin
echo 0 >"$dir/auto"
up nightly
[ -f "$dir/sysupgrade.log" ] && grep -qv -- "-T" "$dir/sysupgrade.log" && fail "nightly installed with the switch off"
rm -f "$dir/sysupgrade.log"
echo 1 >"$dir/auto"
up nightly
grep -q "$dir/tmp/firmware.bin" "$dir/sysupgrade.log" 2>/dev/null || fail "nightly did not install with the switch on"

# What CI publishes: tools/release-list.mjs over the release folder, then signed.
rm -f "$dir/sysupgrade.log" "$dir/server/"*
echo "firmware 170" >"$dir/server/beyond-gateway-glinet_gl-mt6000-sysupgrade.bin"
echo "other router" >"$dir/server/beyond-gateway-openwrt_one-sysupgrade.itb"
node "$ROOT/tools/release-list.mjs" "$dir/server" 170 1.170 "Help inside the app" >/dev/null && node "$ROOT/tools/update-key.mjs" sign "$dir/server/latest.txt"
echo 0 >"$dir/auto"
up check && up install
grep -q "$dir/tmp/firmware.bin" "$dir/sysupgrade.log" 2>/dev/null && grep -q "firmware 170" "$dir/tmp/firmware.bin" 2>/dev/null || fail "a release made by tools/release-list.mjs should install the router's own file"

rm -rf "$dir"
[ $fails -eq 0 ] && echo "ok   update" || exit 1
