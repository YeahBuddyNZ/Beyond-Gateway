#!/bin/sh
# Prints the path of a usign (OpenWrt's signing tool), building it from OpenWrt's source into out/usign if there is none.
command -v usign && exit 0
ROOT=$(cd "$(dirname "$0")/.." && pwd)
U="$ROOT/out/usign"
if [ ! -x "$U/b/usign" ]; then
	rm -rf "$U"
	git clone -q --depth 1 https://github.com/openwrt/usign.git "$U" >&2 && cmake -S "$U" -B "$U/b" >/dev/null && make -C "$U/b" >/dev/null || { echo "Could not build usign" >&2; exit 1; }
fi
echo "$U/b/usign"
