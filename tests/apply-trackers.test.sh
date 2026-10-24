#!/bin/sh
# apply-trackers points dnsmasq at Beyond's list only when the switch is on, takes it away when off, restarts DNS
# only when something changed, and never touches someone else's servers-file.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d)
mkdir "$dir/bin" "$dir/init.d"
LIST="$dir/list.conf"
: >"$LIST"
# A tiny uci: keeps beyond.privacy.block_trackers and dhcp.@dnsmasq[0].serversfile in files.
cat >"$dir/bin/uci" <<STUB
#!/bin/sh
[ "\$1" = -q ] && shift
case "\$1 \$2" in
"get beyond.privacy.block_trackers") cat "$dir/on" 2>/dev/null ;;
"get dhcp.@dnsmasq[0].serversfile") [ -f "$dir/sf" ] && cat "$dir/sf" || exit 1 ;;
"delete dhcp.@dnsmasq[0].serversfile") rm -f "$dir/sf" ;;
"commit dhcp") echo commit >>"$dir/log" ;;
set*) echo "\${2#"dhcp.@dnsmasq[0].serversfile="}" >"$dir/sf" ;;
esac
STUB
printf '#!/bin/sh\necho "dnsmasq $1" >>"%s/log"\n' "$dir" >"$dir/init.d/dnsmasq"
chmod +x "$dir/bin/"* "$dir/init.d/"*
sed "s#/etc/init.d/dnsmasq#$dir/init.d/dnsmasq#" "$ROOT/files/usr/libexec/beyond/apply-trackers" >"$dir/apply-trackers"
run() { PATH="$dir/bin:$PATH" BEYOND_TRACKERS="$LIST" sh "$dir/apply-trackers"; }
fails=0
restarts() { grep -c 'dnsmasq restart' "$dir/log" 2>/dev/null || echo 0; }

# Off and never set: nothing changes, DNS isn't restarted.
run
[ -f "$dir/sf" ] && { echo "FAIL off set a servers-file"; fails=1; }
[ "$(restarts)" = 0 ] || { echo "FAIL off restarted DNS"; fails=1; }

# On: the list goes in, and DNS restarts once.
echo 1 >"$dir/on"
run
[ "$(cat "$dir/sf" 2>/dev/null)" = "$LIST" ] || { echo "FAIL on didn't set the list"; fails=1; }
[ "$(restarts)" = 1 ] || { echo "FAIL on didn't restart DNS once"; fails=1; }
# On again (as at boot): nothing to do.
run
[ "$(restarts)" = 1 ] || { echo "FAIL a second run restarted DNS"; fails=1; }

# The list has gone (at boot after an update without it): the setting comes out, so DNS never points at nothing.
mv "$LIST" "$LIST.away"
run
[ -f "$dir/sf" ] && { echo "FAIL a missing list was left in DNS"; fails=1; }
mv "$LIST.away" "$LIST"

# Off: taken away.
run
echo 0 >"$dir/on"
run
[ -f "$dir/sf" ] && { echo "FAIL off left the list in"; fails=1; }

# Someone else's servers-file: left alone either way, and turning on says no.
echo /etc/my-adblock.servers >"$dir/sf"
run
[ "$(cat "$dir/sf")" = /etc/my-adblock.servers ] || { echo "FAIL off removed someone else's list"; fails=1; }
echo 1 >"$dir/on"
run 2>/dev/null && { echo "FAIL on didn't refuse with another list in place"; fails=1; }
[ "$(cat "$dir/sf")" = /etc/my-adblock.servers ] || { echo "FAIL on replaced someone else's list"; fails=1; }

rm -rf "$dir"
[ $fails -eq 0 ] && echo "ok   apply-trackers" || exit 1
