#!/bin/sh
# Mesh points: joining the main Beyond router (and putting everything back when it can't), the check-in each minute,
# and the main router's check-in page refusing anything without the point's secret. The other router, the network
# and uci are stand-ins that answer the way OpenWrt and a main Beyond router do.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d)
mkdir -p "$dir/bin" "$dir/etc" "$dir/tmp" "$dir/config" "$dir/initd"
printf 'dhcp\n' >"$dir/config/dhcp"

# jsonfilter -e for the paths the scripts use: @.a.b, @.a[1].b and @.route[@.target="0.0.0.0"].nexthop.
cat >"$dir/bin/jsonfilter" <<'STUB'
#!/bin/sh
while [ $# -gt 0 ]; do case "$1" in -e) path=$2; shift ;; -i) file=$2; shift ;; esac; shift; done
[ -n "$file" ] && exec <"$file"
exec node -e '
let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
	try {
		let v = JSON.parse(s);
		const parts = process.argv[1].slice(2).match(/\[@\.[a-z]+="[^"]*"\]|\[\d+\]|[A-Za-z_]+/g);
		for (const p of parts) {
			const f = p.match(/^\[@\.([a-z]+)="([^"]*)"\]$/);
			if (f) v = v.find((x) => x[f[1]] === f[2]);
			else if (p[0] === "[") v = v[+p.slice(1, -1)];
			else v = v[p];
			if (v === undefined) process.exit(1);
		}
		console.log(typeof v === "object" ? JSON.stringify(v) : String(v));
	} catch { process.exit(1); }
});' "$path"
STUB
# uci: a small key=value store in $dir/uci; every call logged.
cat >"$dir/bin/uci" <<STUB
#!/bin/sh
echo "uci \$*" >>"$dir/calls"
[ "\$1" = -q ] && shift
case "\$1" in
	get) v=\$(sed -n "s/^\$2=//p" "$dir/uci" 2>/dev/null | tail -1); [ -n "\$v" ] && echo "\$v" || exit 1 ;;
	set) echo "\$2" >>"$dir/uci" ;;
	show) [ "\$2" = network ] && echo "network.dev1.name='br-lan'" ;;
	commit) [ "\$2" = network ] && echo changed >"$dir/config/network" ;;
esac
exit 0
STUB
cat >"$dir/bin/ubus" <<STUB
#!/bin/sh
echo "ubus \$*" >>"$dir/calls"
case "\$2 \$3" in
	"network.interface.lan status") [ -f "$dir/no-main" ] && echo '{}' || echo '{"route":[{"target":"0.0.0.0","nexthop":"10.42.0.1"}]}' ;;
	"system board") echo '{"model":"TP-Link Archer \"AX23\""}' ;;
	"beyond mesh_report") printf '{\n\t"model": "TP-Link",\n\t"clients": [ { "mac": "a4:83:e7:11:22:01", "signal": -50 } ]\n}\n' ;;
	"beyond mesh_apply") printf '%s\n' "\$4" >>"$dir/applied" ;;
esac
STUB
# The main router: -O - --post-data=BODY URL. Answers from $dir/main-*.
cat >"$dir/fetch" <<STUB
#!/bin/sh
body=\${3#--post-data=}
printf '%s %s\n' "\$4" "\$body" >>"$dir/requests"
[ -f "$dir/offline" ] && { echo "Connection failed" >&2; exit 4; }
case "\$4 \$body" in
	*/cgi-bin/beyond-mesh*) [ -f "$dir/forgotten" ] && { echo "HTTP error 403" >&2; exit 8; }; cat "$dir/main-sync" ;;
	*setup_state*) cat "$dir/main-setup" ;;
	*'"login"'*) cat "$dir/main-login" ;;
	*mesh_join*) cat "$dir/main-join" ;;
esac
STUB
for c in logger sleep firstboot reboot; do printf '#!/bin/sh\necho "%s $*" >>"%s"\n' "$c" "$dir/calls" >"$dir/bin/$c"; done
printf '#!/bin/sh\ncat >"%s"\n' "$dir/passwd-input" >"$dir/bin/passwd"
for c in network beyond; do printf '#!/bin/sh\necho "%s $*" >>"%s"\n' "$c" "$dir/calls" >"$dir/initd/$c"; done
chmod +x "$dir/bin/"* "$dir/fetch" "$dir/initd/"*
export PATH="$dir/bin:$PATH" BEYOND_ETC="$dir/etc" BEYOND_MESH_DIR="$dir/tmp" BEYOND_CONFIG="$dir/config" \
	BEYOND_INITD="$dir/initd" BEYOND_FETCH="sh $dir/fetch" BEYOND_WAIT=6
mesh() { sh "$ROOT/files/usr/libexec/beyond/mesh" "$@" 2>/dev/null; }
fails=0
fail() { echo "FAIL $1"; fails=1; }
SID=0123456789abcdef0123456789abcdef
SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde
starting() {
	printf 'network\n' >"$dir/config/network"
	rm -f "$dir/uci" "$dir/calls" "$dir/requests" "$dir/applied" "$dir/tmp/message" "$dir/etc/mesh"
	printf '{"login":1}' >"$dir/tmp/login.json"
	printf 'main-router-pw\n' >"$dir/tmp/password"
	touch "$dir/tmp/joining"
	printf '{"result":[0,{"setup_done":true,"role":"main"}]}' >"$dir/main-setup"
	printf '{"result":[0,{"ubus_rpc_session":"%s"}]}' "$SID" >"$dir/main-login"
	printf '{"result":[0,{"ok":true,"secret":"%s"}]}' "$SECRET" >"$dir/main-join"
	printf '{"ok":true,"name":"Upstairs","wifi":{"ssid":"Aroha Whare","key":"kumara-pie-42","country":"NZ"}}' >"$dir/main-sync"
}

# Joining.
starting
mesh join
grep -q '^id=[0-9a-f]\{16\}$' "$dir/etc/mesh" || fail "a joined point should keep its id"
grep -q "^secret=$SECRET$" "$dir/etc/mesh" || fail "a joined point should keep its secret"
[ "$(stat -c %a "$dir/etc/mesh")" = 600 ] || fail "only root may read the mesh file"
grep -q '^beyond.mesh.role=point$' "$dir/uci" || fail "it should become a point"
grep -q '^beyond.main.setup_done=1$' "$dir/uci" || fail "a point is set up"
grep -q "^uci add_list network.dev1.ports=wan$" "$dir/calls" || fail "the WAN port should join the other ports"
grep -q '^dhcp.lan.ignore=1$' "$dir/uci" || fail "a point stops handing out addresses"
grep -q '"mesh_join",{"id":"[0-9a-f]\{16\}","model":"TP-Link Archer AX23"}' "$dir/requests" || fail "the join should carry the id and a tidy model: $(grep mesh_join "$dir/requests")"
grep -q "\"$SID\",\"beyond\",\"mesh_join\"" "$dir/requests" || fail "the join should be signed in to the main router"
[ "$(sed -n 1p "$dir/passwd-input")" = main-router-pw ] || fail "the main router's password should become this one's"
[ -f "$dir/tmp/password" ] || [ -f "$dir/tmp/login.json" ] && fail "the password should not be left lying around"
grep -q '"ssid":"Aroha Whare"' "$dir/applied" || fail "joining should take the main router's Wi-Fi straight away"

# Checking in.
rm -f "$dir/applied" "$dir/requests"
mesh sync
grep -q "^http://10.42.0.1/cgi-bin/beyond-mesh {\"id\":\"[0-9a-f]*\",\"secret\":\"$SECRET\", *\"model\": \"TP-Link\"" "$dir/requests" ||
	fail "the check-in should carry the secret and the report: $(cat "$dir/requests")"
grep -q '"key":"kumara-pie-42"' "$dir/applied" || fail "the check-in should hand the answer over"
grep -q '^main=10.42.0.1$' "$dir/tmp/state" || fail "it should remember where the main router is"
touch "$dir/offline"
mesh sync
grep -q "Can't reach" "$dir/tmp/message" || fail "no main router should say so"
rm "$dir/offline"
mesh sync
[ -f "$dir/tmp/message" ] && fail "the message should go once it's back"
touch "$dir/forgotten"
rm -f "$dir/applied"
mesh sync
grep -q "no longer has this one" "$dir/tmp/message" || fail "a forgotten point should say so"
[ -f "$dir/applied" ] && fail "a forgotten point should keep the Wi-Fi it has"
rm "$dir/forgotten"
mesh leave
grep -q '^firstboot -y' "$dir/calls" || fail "leaving should reset the router"

# Not joining: the old settings come back each time.
check_undo() {
	grep -q "$1" "$dir/tmp/message" || fail "$2: $(cat "$dir/tmp/message")"
	[ "$(cat "$dir/config/network")" = network ] || fail "$2: the network settings should come back"
	grep -q '^beyond start' "$dir/calls" || fail "$2: it should look for the internet again"
	[ -f "$dir/etc/mesh" ] && fail "$2: nothing should be kept"
	[ -f "$dir/tmp/password" ] && fail "$2: the password should go"
}
starting; touch "$dir/no-main"
mesh join
check_undo "Couldn't find your main" "no router upstream"
rm "$dir/no-main"
starting; printf '{"result":[0,{"setup_done":false}]}' >"$dir/main-setup"
mesh join
check_undo "isn't a Beyond router" "an ISP router upstream"
starting; printf '{"result":[6]}' >"$dir/main-login"
mesh join
check_undo "isn't the main router's password" "a wrong password"
starting; printf '{"result":[0,{"ok":false,"error":"Your Beyond network already has 10 mesh points."}]}' >"$dir/main-join"
mesh join
check_undo "already has 10" "a full network"
starting; printf 'beyond.main.setup_done=1\n' >"$dir/uci"
mesh join
grep -q "already set up" "$dir/tmp/message" || fail "a set up router should not join"
grep -q '^network restart' "$dir/calls" 2>/dev/null && fail "a set up router should not touch the network"

# The main router's check-in page.
cat >"$dir/bin/ubus" <<STUB
#!/bin/sh
printf '%s\n' "\$4" >"$dir/sync-args"
case "\$4" in *'"secret":"good"'*) printf '{\n\t"ok": true,\n\t"wifi": { "ssid": "Aroha Whare" }\n}\n' ;; *) echo '{ "ok": false }' ;; esac
STUB
chmod +x "$dir/bin/ubus"
cgi() { printf '%s' "$2" | REQUEST_METHOD=$1 CONTENT_LENGTH=${3:-${#2}} REMOTE_ADDR=10.42.0.150 sh "$ROOT/files/www/cgi-bin/beyond-mesh"; }
cgi POST '{"id":"x","secret":"good"}' | grep -q '^Status: 200' || fail "a good secret should be answered"
cgi POST '{"id":"x","secret":"good"}' | grep -q '"ssid": "Aroha Whare"' || fail "the answer should carry the Wi-Fi"
grep -q '"from":"10.42.0.150"}$' "$dir/sync-args" || fail "the address should be added last: $(cat "$dir/sync-args")"
cgi POST '{"id":"x","secret":"good","from":"1.2.3.4"}' >/dev/null
grep -q '"from":"1.2.3.4","from":"10.42.0.150"}$' "$dir/sync-args" || fail "a point can't say it's somewhere else"
cgi POST '{"id":"x","secret":"bad"}' | grep -q '^Status: 403' || fail "a wrong secret should get a 403"
cgi POST '{"id":"x","secret":"bad"}' | grep -q 'Aroha' && fail "a wrong secret should learn nothing"
cgi GET '' | grep -q '^Status: 405' || fail "only POST"
cgi POST 'nope' | grep -q '^Status: 400' || fail "not JSON should be refused"
cgi POST '{}' 99999 | grep -q '^Status: 413' || fail "a huge body should be refused"

rm -rf "$dir"
[ "$fails" = 0 ] && echo "ok   mesh points" || exit 1
