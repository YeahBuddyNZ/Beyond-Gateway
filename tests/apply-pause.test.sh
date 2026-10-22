#!/bin/sh
# apply-pause writes only well-formed, paused MAC addresses into the firewall file, lower case, once each.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d)
mkdir "$dir/bin"
cat >"$dir/bin/uci" <<'STUB'
#!/bin/sh
case "$*" in
"-q show beyond") printf "%s\n" "beyond.main=beyond" "beyond.d_a=device" "beyond.d_a.paused='1'" "beyond.d_b.paused='0'" "beyond.d_c.paused='1'" "beyond.d_d.paused='1'" "beyond.d_e.paused='1'" ;;
"-q get beyond.d_a.mac") echo AA:BB:CC:00:11:22 ;;
"-q get beyond.d_b.mac") echo 99:99:99:99:99:99 ;;
"-q get beyond.d_c.mac") echo 11:22:33:44:55:66 ;;
"-q get beyond.d_d.mac") echo 'nonsense; drop table' ;;
"-q get beyond.d_e.mac") echo aa:bb:cc:00:11:22 ;;
esac
STUB
printf '#!/bin/sh\necho reloaded >>"%s/reloads"\n' "$dir" >"$dir/bin/fw4"
chmod +x "$dir/bin/"*
sed "s#/etc/nftables.d#$dir#" "$ROOT/files/usr/libexec/beyond/apply-pause" >"$dir/apply-pause"
PATH="$dir/bin:$PATH" sh "$dir/apply-pause"
fails=0
grep -q 'elements = { 11:22:33:44:55:66, aa:bb:cc:00:11:22 }' "$dir/20-beyond.nft" || { echo "FAIL elements:"; cat "$dir/20-beyond.nft"; fails=1; }
grep -q '99:99' "$dir/20-beyond.nft" && { echo "FAIL an unpaused device was paused"; fails=1; }
grep -q 'nonsense' "$dir/20-beyond.nft" && { echo "FAIL a bad address reached the firewall"; fails=1; }
[ -f "$dir/reloads" ] || { echo "FAIL the firewall was not reloaded"; fails=1; }
# Nothing paused: the set is written empty, with no elements line (nft refuses "elements = { }").
printf '#!/bin/sh\n[ "$1 $2" = "-q show" ] && echo "beyond.main=beyond"\n' >"$dir/bin/uci"
PATH="$dir/bin:$PATH" sh "$dir/apply-pause" --no-reload
grep -q elements "$dir/20-beyond.nft" && { echo "FAIL empty set has an elements line"; fails=1; }
rm -rf "$dir"
[ $fails -eq 0 ] && echo "ok   apply-pause" || exit 1
