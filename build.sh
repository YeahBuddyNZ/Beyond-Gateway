#!/usr/bin/env bash
# Builds Beyond Gateway firmware with OpenWrt's Image Builder: OpenWrt's own image, plus our packages and files.
#
#   ./build.sh                     the default router (GL.iNet Flint 2, GL-MT6000)
#   ./build.sh openwrt_one         another supported router (see ROUTERS below)
#   ./build.sh --stage-only        just put the files together in out/stage (no download, no build)
#
# Needs Linux (x86_64), make, tar with zstd, curl, Node.js 20+ and about 2 GB free. The images land in out/<router>/.
set -euo pipefail

OPENWRT_VERSION="${OPENWRT_VERSION:-25.12.1}"
MIRROR="${OPENWRT_MIRROR:-https://downloads.openwrt.org}"

# Routers we build for: OpenWrt profile name, then its target. Add a line to support another.
declare -A ROUTERS=(
	[glinet_gl-mt6000]="mediatek/filogic"   # GL.iNet Flint 2: Wi-Fi 6, 2.5 Gb ports, the reference router
	[openwrt_one]="mediatek/filogic"        # OpenWrt One: the OpenWrt project's own router
	[glinet_gl-mt3000]="mediatek/filogic"   # GL.iNet Beryl AX: small and cheap, for flats and baches
)

ROOT="$(cd "$(dirname "$0")" && pwd)"
STAGE_ONLY=0
PROFILE=glinet_gl-mt6000
for a in "$@"; do
	case "$a" in
		--stage-only) STAGE_ONLY=1 ;;
		-h|--help) sed -n '2,9p' "$0"; exit 0 ;;
		*) PROFILE="$a" ;;
	esac
done
TARGET="${ROUTERS[$PROFILE]:-}"
if [ -z "$TARGET" ]; then
	echo "Not a router we build for: $PROFILE. One of: ${!ROUTERS[*]}" >&2
	exit 1
fi

# 1. The files that go on the router: files/ as it is, and the app under /www/beyond.
STAGE="$ROOT/out/stage"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -a "$ROOT/files/." "$STAGE/"
# The app is React with ReUI, built by Vite in "router" mode, which leaves the preview stand-in out.
(cd "$ROOT/web" && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run build:router)
mkdir -p "$STAGE/www/beyond"
cp -a "$ROOT/web/dist/." "$STAGE/www/beyond/"
# The version: BEYOND_BUILD is the build number updates compare (CI sets it); the version is what people see.
BUILD="${BEYOND_BUILD:-0}"
VER="${BEYOND_VERSION:-$(git -C "$ROOT" describe --tags --always --dirty 2>/dev/null || echo dev)}"
mkdir -p "$STAGE/etc/beyond"
echo "$VER" >"$STAGE/etc/beyond/version"
printf 'build=%s\nversion=%s\nprofile=%s\n' "$BUILD" "$VER" "$PROFILE" >"$STAGE/etc/beyond/build"
# Updates are checked against Beyond's public key. Without the key (a build of your own) the router never updates.
if [ -n "${GATEWAY_UPDATE_KEY:-}" ]; then
	node "$ROOT/tools/update-key.mjs" public >"$STAGE/etc/beyond/update.pub"
	echo "Updates on: signed releases install on this router"
else
	echo "Updates off: GATEWAY_UPDATE_KEY is not set, so this build will not update itself"
fi
echo "Staged files for $PROFILE ($VER) in out/stage"
[ "$STAGE_ONLY" = 1 ] && exit 0

# 2. OpenWrt's Image Builder for that target, checked against OpenWrt's published checksum.
BASE="$MIRROR/releases/$OPENWRT_VERSION/targets/$TARGET"
CACHE="$ROOT/out/cache"
mkdir -p "$CACHE"
curl -fsSL "$BASE/sha256sums" -o "$CACHE/sha256sums.$OPENWRT_VERSION.${TARGET//\//-}"
IB="$(grep -o 'openwrt-imagebuilder-[^ ]*Linux-x86_64\.tar\.\(zst\|xz\)' "$CACHE/sha256sums.$OPENWRT_VERSION.${TARGET//\//-}" | head -1)"
[ -n "$IB" ] || { echo "No Image Builder listed at $BASE" >&2; exit 1; }
if [ ! -f "$CACHE/$IB" ]; then
	echo "Downloading $IB"
	curl -fL "$BASE/$IB" -o "$CACHE/$IB.part" && mv "$CACHE/$IB.part" "$CACHE/$IB"
fi
(cd "$CACHE" && grep " \*\?$IB\$" "sha256sums.$OPENWRT_VERSION.${TARGET//\//-}" | sed 's/ \*/  /' | sha256sum -c -)

IBDIR="$CACHE/${IB%.tar.*}"
if [ ! -d "$IBDIR" ]; then
	case "$IB" in
		*.zst) tar --zstd -xf "$CACHE/$IB" -C "$CACHE" ;;
		*) tar -xf "$CACHE/$IB" -C "$CACHE" ;;
	esac
fi

# 3. Build.
PACKAGES="$(grep -v '^\s*#' "$ROOT/packages.txt" | xargs)"
OUT="$ROOT/out/$PROFILE"
rm -rf "$OUT"
make -C "$IBDIR" image PROFILE="$PROFILE" PACKAGES="$PACKAGES" FILES="$STAGE" BIN_DIR="$OUT" EXTRA_IMAGE_NAME="beyond"
echo
echo "Built Beyond Gateway for $PROFILE:"
ls -1 "$OUT" | grep -E 'sysupgrade|factory' || ls -1 "$OUT"
