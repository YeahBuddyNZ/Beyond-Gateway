#!/bin/sh
# Every test. Usage: sh tests/run.sh
set -e
cd "$(dirname "$0")/.."
sh tests/wan-detect.test.sh
sh tests/apply-pause.test.sh
sh tests/apply-trackers.test.sh
sh tests/update.test.sh
sh tests/family.test.sh
sh tests/mesh.test.sh
for f in files/usr/libexec/beyond/* files/etc/uci-defaults/* files/etc/init.d/* files/www/cgi-bin/*; do sh -n "$f"; done
echo "ok   shell syntax"
node --test tests/*.test.mjs
