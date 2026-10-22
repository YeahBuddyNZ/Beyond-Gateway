#!/bin/sh
# Runs wan-detect against stand-in commands for each way an ISP can hand out the internet, and checks what it writes.
# Usage: sh tests/wan-detect.test.sh

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT="$ROOT/files/usr/libexec/beyond/wan-detect"
fails=0

run_case() {
	name=$1 answers=$2 expect=$3
	dir=$(mktemp -d)
	mkdir "$dir/bin"
	log="$dir/calls"
	# Each stand-in records its call; ANSWERS lists which "kind:port" combinations reply.
	for cmd in udhcpc pppoe-discovery; do
		cat >"$dir/bin/$cmd" <<EOF
#!/bin/sh
echo "$cmd \$*" >>"$log"
kind=$cmd
port=""
while [ \$# -gt 0 ]; do case "\$1" in -i|-I) port=\$2; shift ;; esac; shift; done
case " $answers " in *" \$kind:\$port "*) exit 0 ;; esac
exit 1
EOF
	done
	cat >"$dir/bin/ubus" <<EOF
#!/bin/sh
case " $answers " in *" online "*) echo '{"ipv4-address":[{"address":"192.168.1.20"}]}' ;; *) echo '{}' ;; esac
EOF
	cat >"$dir/bin/jsonfilter" <<'EOF'
#!/bin/sh
# -i /etc/board.json gives the WAN port name; otherwise read the address out of stdin.
case "$*" in *board.json*) echo wan ;; *) sed -n 's/.*"address":"\([^"]*\)".*/\1/p' ;; esac
EOF
	for cmd in uci ip ifup logger date sleep; do
		printf '#!/bin/sh\necho "%s $*" >>"%s"\n' "$cmd" "$log" >"$dir/bin/$cmd"
	done
	chmod +x "$dir/bin/"*
	out=$(PATH="$dir/bin:$PATH" sh "$SCRIPT" 2>&1)
	code=$?
	got=$(grep -o 'beyond.main.wan_mode=[a-z0-9-]*' "$log" 2>/dev/null | cut -d= -f2)
	if [ "$expect" = none ]; then
		if [ $code -ne 0 ] && [ -z "$got" ]; then echo "ok   $name"; else echo "FAIL $name: expected nothing written, got '$got' ($out)"; fails=$((fails + 1)); fi
	elif [ "$got" = "$expect" ]; then
		echo "ok   $name"
		check_writes "$name" "$expect" "$log"
	else
		echo "FAIL $name: expected $expect, got '$got' ($out)"; fails=$((fails + 1))
	fi
	# The test VLAN must never be left behind once a mode is chosen without it.
	adds=$(grep -c 'ip link add' "$log")
	dels=$(grep -c 'ip link del' "$log")
	if [ "$adds" -ne "$dels" ]; then echo "FAIL $name: left the test VLAN behind"; fails=$((fails + 1)); fi
	rm -rf "$dir"
}

check_writes() {
	name=$1 mode=$2 log=$3
	case "$mode" in
		vlan10-dhcp) want='uci set network.wan.device=wan.10' ;;
		dhcp) want='uci set network.wan.device=wan' ;;
		vlan10-pppoe) want='uci set network.wan.proto=pppoe' ;;
		pppoe) want='uci set network.wan.proto=pppoe' ;;
	esac
	if ! grep -qx "$want" "$log"; then echo "FAIL $name: missing '$want'"; fails=$((fails + 1)); fi
}

run_case "NZ fibre, DHCP on VLAN 10" "udhcpc:wan.10" vlan10-dhcp
run_case "behind another router" "udhcpc:wan" dhcp
run_case "already online from netifd" "online" dhcp
run_case "PPPoE on VLAN 10" "pppoe-discovery:wan.10" vlan10-pppoe
run_case "PPPoE untagged" "pppoe-discovery:wan" pppoe
run_case "VLAN 10 wins over untagged" "udhcpc:wan udhcpc:wan.10" vlan10-dhcp
run_case "nothing plugged in" "" none

[ $fails -eq 0 ] && echo "All good." || { echo "$fails failed."; exit 1; }
