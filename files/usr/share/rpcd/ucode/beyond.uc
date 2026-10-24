// Beyond Gateway's ubus object, the only thing the Beyond app talks to (through uhttpd's /ubus).
// Everything here runs as root inside rpcd; the ACL in /usr/share/rpcd/acl.d/beyond.json says who may call what.
// Before setup, anyone on the LAN may ask setup_state and call finish_setup once; after that, only a logged in session.

'use strict';

import { readfile, writefile, popen, readdir, unlink, mkdir } from 'fs';
import { cursor } from 'uci';
import { connect } from 'ubus';

const MAC = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;
const KINDS = ['phone', 'laptop', 'tablet', 'tv', 'console', 'speaker', 'camera', 'watch', 'printer', 'computer', 'other'];

function shellquote(s) {
	return `'${replace(s, "'", "'\\''")}'`;
}

function section_for(mac) {
	return 'd_' + replace(mac, ':', '');
}

function setup_done() {
	return cursor().get('beyond', 'main', 'setup_done') == '1';
}

// The Wi-Fi networks people join: access points on the LAN (not a guest network, which comes later).
function home_ifaces(c) {
	let out = [];
	c.foreach('wireless', 'wifi-iface', (s) => {
		if ((s.mode ?? 'ap') == 'ap' && (s.network ?? 'lan') == 'lan' && s.beyond_guest != '1')
			push(out, s['.name']);
	});
	return out;
}

// key=value lines, as /etc/beyond/build and the updater's state file are written.
function keyvalues(path) {
	let out = {};
	for (let line in split(readfile(path) ?? '', '\n')) {
		let m = match(line, /^([a-z_]+)=(.*)$/);
		if (m) out[m[1]] = m[2];
	}
	return out;
}

// Mesh: one main Beyond router and up to MAX_POINTS more as mesh points. A point is any router running Beyond
// Gateway, of any make: it hands its own internet and addresses over to the main router, joins its network by cable,
// and puts out the same Wi-Fi. The main router keeps the list; each point asks it once a minute for the Wi-Fi
// (files/usr/libexec/beyond/mesh, through /cgi-bin/beyond-mesh) and says which phones are on it.
const MAX_POINTS = 10;
const POINT_ID = /^[0-9a-f]{16}$/;
const POINT_SECRET = /^[A-Za-z0-9_-]{43}$/;
const MESH_ETC = '/etc/beyond/mesh.d';
const MESH_TMP = '/tmp/beyond-mesh';

// '' on its own, 'main' with points, 'point' when it is one.
function mesh_role() {
	return cursor().get('beyond', 'mesh', 'role') ?? '';
}

function set_role(c, role) {
	if (!c.get('beyond', 'mesh')) c.set('beyond', 'mesh', 'mesh');
	c.set('beyond', 'mesh', 'role', role);
	c.commit('beyond');
}

// 32 random bytes, URL-safe base64 without padding: 43 characters.
function new_secret() {
	let raw = readfile('/dev/urandom', 32);
	if (length(raw) != 32) return null;
	return replace(replace(replace(b64enc(raw), '+', '-'), '/', '_'), '=', '');
}

// Written by the shell with its umask, so the file is root's only from the first byte.
function write_private(path, text) {
	let p = popen(`umask 077; cat > ${shellquote(path)}`, 'w');
	if (!p) return false;
	p.write(text);
	return p.close() == 0;
}

// What a point last said, kept in /tmp so a minute's check never writes to the flash.
function point_live(id) {
	let s = null;
	try { s = json(readfile(`${MESH_TMP}/points/${id}.json`) ?? 'null'); } catch (e) { s = null; }
	return type(s) == 'object' ? s : null;
}

function mesh_points() {
	let c = cursor(), out = [];
	c.foreach('beyond', 'mesh_point', (s) => {
		if (!match(s.id ?? '', POINT_ID)) return;
		let live = point_live(s.id);
		push(out, {
			id: s.id,
			name: s.name ?? 'Mesh point',
			model: s.model ?? '',
			joined: +(s.joined ?? 0),
			seen: live?.seen ?? 0,
			online: !!live && time() - live.seen < 150,
			ip: live?.ip ?? null,
			clients: length(live?.clients ?? [])
		});
	});
	return out;
}

// Phones on the points, for the device list: mac -> { signal, point }. Only from points heard from lately.
function point_clients() {
	let out = {};
	for (let p in mesh_points()) {
		if (!p.online) continue;
		for (let cl in (point_live(p.id)?.clients ?? []))
			out[cl.mac] = { signal: cl.signal, point: p.name };
	}
	return out;
}

// The points' own addresses, so a point doesn't show up as a "device" on the main router.
function point_macs() {
	let out = {};
	for (let p in mesh_points()) {
		let m = point_live(p.id)?.mac;
		if (m) out[m] = true;
	}
	return out;
}

function clean_clients(list) {
	let out = [];
	if (type(list) != 'array') return out;
	for (let cl in list) {
		let mac = lc(cl?.mac ?? '');
		if (match(mac, MAC) && length(out) < 256)
			push(out, { mac, signal: type(cl.signal) == 'int' ? cl.signal : null });
	}
	return out;
}

function home_wifi(c) {
	let names = home_ifaces(c);
	if (!length(names)) return null;
	let radio = c.get('wireless', names[0], 'device');
	return {
		ssid: c.get('wireless', names[0], 'ssid'),
		key: c.get('wireless', names[0], 'key'),
		country: (radio ? c.get('wireless', radio, 'country') : null) ?? 'NZ'
	};
}

function mesh_state() {
	let role = mesh_role();
	if (role == 'point') {
		let st = keyvalues(`${MESH_TMP}/state`);
		return {
			role,
			name: cursor().get('beyond', 'mesh', 'name') ?? 'Mesh point',
			main: st.main ?? null,
			checked: +(st.checked ?? 0),
			message: trim(readfile(`${MESH_TMP}/message`) ?? '') || null
		};
	}
	return { role, points: mesh_points(), max: MAX_POINTS };
}
// With mesh points, each Beyond router tells phones about the others (802.11k) and nudges a phone to the nearer one
// (802.11v, and usteer on the LAN). Same name and password everywhere, so a phone moves on without asking.
// Fast hand-over (802.11r) stays off: some older phones and smart plugs drop off with it.
function roam(c) {
	let on = mesh_role() != '';
	for (let name in home_ifaces(c)) {
		c.set('wireless', name, 'ieee80211k', on ? '1' : '0');
		c.set('wireless', name, 'bss_transition', on ? '1' : '0');
	}
	if (on) system('[ -x /etc/init.d/usteer ] && { /etc/init.d/usteer enable; /etc/init.d/usteer start; } >/dev/null 2>&1');
}


function set_wifi(c, ssid, key) {
	for (let name in home_ifaces(c)) {
		c.set('wireless', name, 'ssid', ssid);
		c.set('wireless', name, 'encryption', 'sae-mixed');
		c.set('wireless', name, 'key', key);
		c.set('wireless', name, 'disabled', '0');
	}
	roam(c);
	c.commit('wireless');
	system('wifi reload >/dev/null 2>&1 &');
}

function check_wifi(ssid, key) {
	if (type(ssid) != 'string' || length(ssid) < 1 || length(ssid) > 32)
		return 'The Wi-Fi name needs 1 to 32 characters.';
	if (type(key) != 'string' || length(key) < 8 || length(key) > 63)
		return 'The Wi-Fi password needs 8 to 63 characters.';
	return null;
}

function counters(dev) {
	if (!dev || !match(dev, /^[A-Za-z0-9._-]+$/))
		return { rx: 0, tx: 0 };
	return {
		rx: +trim(readfile(`/sys/class/net/${dev}/statistics/rx_bytes`) ?? '0'),
		tx: +trim(readfile(`/sys/class/net/${dev}/statistics/tx_bytes`) ?? '0')
	};
}

function leases() {
	let out = {};
	for (let line in split(readfile('/tmp/dhcp.leases') ?? '', '\n')) {
		let f = split(line, ' ');
		if (length(f) >= 4 && match(lc(f[1]), MAC))
			out[lc(f[1])] = { ip: f[2], hostname: f[3] == '*' ? null : f[3], expires: +f[0] };
	}
	return out;
}

function neighbours() {
	let out = {};
	let p = popen('ip -4 neigh show dev br-lan 2>/dev/null');
	if (!p) return out;
	for (let line = p.read('line'); length(line); line = p.read('line')) {
		let m = match(trim(line), /^(\S+) lladdr (\S+) (\S+)/);
		if (m && match(lc(m[2]), MAC))
			out[lc(m[2])] = { ip: m[1], state: m[3] };
	}
	p.close();
	return out;
}

function wifi_clients(u) {
	let out = {};
	for (let obj in (u.list('hostapd.*') ?? [])) {
		let r = u.call(obj, 'get_clients', {});
		for (let mac, info in (r?.clients ?? {}))
			out[lc(mac)] = { signal: info.signal, iface: replace(obj, 'hostapd.', '') };
	}
	return out;
}

function device_list() {
	let c = cursor();
	let u = connect();
	let lease = leases(), neigh = neighbours(), wifi = wifi_clients(u);
	let away = mesh_role() == 'main' ? point_clients() : {}, hide = mesh_role() == 'main' ? point_macs() : {};
	for (let m, w in away) if (!wifi[m]) wifi[m] = w;
	let known = {};
	c.foreach('beyond', 'device', (s) => { if (s.mac) known[lc(s.mac)] = s; });

	let macs = {};
	for (let m in keys(lease)) macs[m] = true;
	for (let m in keys(neigh)) macs[m] = true;
	for (let m in keys(wifi)) macs[m] = true;
	for (let m in keys(known)) macs[m] = true;

	let out = [];
	for (let mac in keys(macs)) {
		if (hide[mac]) continue;
		let n = neigh[mac], l = lease[mac], w = wifi[mac], k = known[mac];
		let online = !!w || (n && index(['REACHABLE', 'STALE', 'DELAY', 'PROBE'], n.state) >= 0);
		push(out, {
			mac,
			ip: n?.ip ?? l?.ip,
			hostname: l?.hostname,
			name: k?.name,
			kind: k?.kind,
			paused: k?.paused == '1',
			online,
			wifi: !!w,
			signal: w?.signal,
			point: w?.point,
			first_seen: +(k?.first_seen ?? 0)
		});
	}
	return out;
}

// Remember devices the first time they turn up, so "new device joined" has something to compare against.
function remember(list) {
	let c = cursor(), changed = false;
	for (let d in list) {
		let s = section_for(d.mac);
		if (!c.get('beyond', s)) {
			c.set('beyond', s, 'device');
			c.set('beyond', s, 'mac', d.mac);
			c.set('beyond', s, 'first_seen', '' + time());
			d.first_seen = time();
			changed = true;
		}
	}
	if (changed) c.commit('beyond');
}

function update_state() {
	let build = keyvalues('/etc/beyond/build');
	let st = keyvalues('/tmp/beyond-update/state');
	return {
		version: trim(readfile('/etc/beyond/version') ?? '') || build.version,
		build: +(build.build ?? 0),
		enabled: !!readfile('/etc/beyond/update.pub'),
		auto: cursor().get('beyond', 'updates', 'auto') == '1',
		status: st.status ?? 'unknown',
		checked: +(st.checked ?? 0),
		message: st.message,
		available: st.status == 'available' || st.status == 'installing' ? { version: st.version, date: st.date, notes: st.notes } : null
	};
}

// What the router tells Beyond Family each minute once linked (files/usr/libexec/beyond/family). Names and states
// only: no MAC, IP address or hostname leaves the house. Beyond Family's kinds are fewer, so a few are folded in.
const FAMILY_KINDS = { laptop: 'computer', watch: 'other', printer: 'other' };
const FAMILY_UPDATE = ['current', 'available', 'installing', 'off', 'error'];

function family_report() {
	let u = connect();
	let wan = u.call('network.interface.wan', 'status', {}) ?? {};
	let wan6 = u.call('network.interface.wan6', 'status', {}) ?? {};
	let board = u.call('system', 'board', {}) ?? {};
	let up = update_state(), cnt = counters(wan.l3_device);
	let list = device_list();
	remember(list);
	let day = time() - 86400, devices = [];
	for (let d in list)
		push(devices, {
			name: d.name ?? '',
			kind: d.kind ? (FAMILY_KINDS[d.kind] ?? d.kind) : null,
			online: !!d.online,
			paused: !!d.paused,
			wifi: !!d.wifi,
			isNew: d.first_seen > day
		});
	// Online first, so the cap drops the long-gone ones.
	devices = slice(sort(devices, (a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)), 0, 250);
	return {
		version: up.version ?? '',
		model: board.model ?? '',
		wan: {
			up: !!wan.up,
			mode: cursor().get('beyond', 'main', 'wan_mode') ?? '',
			ipv6: length(wan6['ipv6-address'] ?? []) > 0 || length(wan6['ipv6-prefix'] ?? []) > 0,
			uptime: wan.uptime ?? 0,
			rx: cnt.rx,
			tx: cnt.tx
		},
		devices,
		update: index(FAMILY_UPDATE, up.status) >= 0 ? up.status : ''
	};
}

// What the Settings card shows. Never the secret.
function family_state() {
	let link = keyvalues('/etc/beyond/family');
	let code = split(trim(readfile('/tmp/beyond-family/code') ?? ''), '\n');
	let until = +(code[1] ?? 0), checked = +trim(readfile('/tmp/beyond-family/checked') ?? '0');
	let waiting = !!link.id && link.linked != '1' && length(code[0]) > 0 && until > time();
	// While a code is up, ask sooner than the minute cron does, so the card turns to "Linked" soon after.
	if (waiting && time() - checked > 10)
		system('/usr/libexec/beyond/family report >/dev/null 2>&1 &');
	return {
		linked: link.linked == '1',
		code: waiting ? code[0] : null,
		until: waiting ? until : null,
		checked,
		message: trim(readfile('/tmp/beyond-family/message') ?? '') || null
	};
}


// Block Big Tech trackers: on or off, how many domains the list blocks, and whether someone else's list is in the way.
const TRACKERS = '/usr/share/beyond/big-tech-trackers.conf';

function privacy_state() {
	let c = cursor();
	// The first dnsmasq, as apply-trackers' dhcp.@dnsmasq[0].
	let have = null;
	c.foreach('dhcp', 'dnsmasq', (s) => {
		if (have == null) have = s.serversfile ?? '';
	});
	if (have == null) have = '';
	let blocked = 0;
	for (let line in split(readfile(TRACKERS) ?? '', '\n'))
		if (match(line, /^server=\/[^\/#]+\/$/)) blocked++;
	return {
		on: c.get('beyond', 'privacy', 'block_trackers') == '1' && have == TRACKERS,
		blocked,
		other: have != '' && have != TRACKERS
	};
}

const methods = {
	setup_state: {
		call: function() {
			let board = connect().call('system', 'board', {});
			return {
				setup_done: setup_done(),
				model: board?.model,
				wan_mode: cursor().get('beyond', 'main', 'wan_mode') ?? '',
				role: mesh_role(),
				joining: !!readfile(`${MESH_TMP}/joining`),
				mesh_message: trim(readfile(`${MESH_TMP}/message`) ?? '') || null
			};
		}
	},

	finish_setup: {
		args: { password: '', ssid: '', key: '' },
		call: function(req) {
			if (setup_done())
				return { ok: false, error: 'Setup is already done. Sign in instead.' };
			let a = req.args;
			if (type(a.password) != 'string' || length(a.password) < 8)
				return { ok: false, error: 'The router password needs at least 8 characters.' };
			let bad = check_wifi(a.ssid, a.key);
			if (bad) return { ok: false, error: bad };

			let p = shellquote(a.password);
			if (system(`(echo ${p}; sleep 1; echo ${p}) | /bin/busybox passwd root >/dev/null 2>&1`) != 0)
				return { ok: false, error: 'The router password could not be set.' };

			let c = cursor();
			c.set('beyond', 'main', 'setup_done', '1');
			c.commit('beyond');
			set_wifi(c, a.ssid, a.key);
			return { ok: true };
		}
	},

	status: {
		call: function() {
			let u = connect();
			let wan = u.call('network.interface.wan', 'status', {}) ?? {};
			let wan6 = u.call('network.interface.wan6', 'status', {}) ?? {};
			let info = u.call('system', 'info', {}) ?? {};
			let board = u.call('system', 'board', {}) ?? {};
			let c = cursor();
			return {
				model: board.model,
				release: board.release?.version,
				hostname: board.hostname,
				uptime: info.uptime,
				memory: info.memory,
				load: info.load,
				wan: {
					up: !!wan.up,
					mode: c.get('beyond', 'main', 'wan_mode') ?? '',
					ipv4: wan['ipv4-address']?.[0]?.address,
					ipv6: length(wan6['ipv6-address'] ?? []) > 0 || length(wan6['ipv6-prefix'] ?? []) > 0,
					dns: wan['dns-server'] ?? [],
					uptime: wan.uptime ?? 0,
					device: wan.l3_device,
					counters: counters(wan.l3_device)
				},
				time: time()
			};
		}
	},

	devices: {
		call: function() {
			let list = device_list();
			remember(list);
			return { devices: list };
		}
	},

	rename: {
		args: { mac: '', name: '', kind: '' },
		call: function(req) {
			let mac = lc(req.args.mac ?? '');
			if (!match(mac, MAC)) return { ok: false, error: 'Not a device address.' };
			let name = trim(req.args.name ?? '');
			if (length(name) > 40) return { ok: false, error: 'Names can be up to 40 characters.' };
			let c = cursor(), s = section_for(mac);
			if (!c.get('beyond', s)) { c.set('beyond', s, 'device'); c.set('beyond', s, 'mac', mac); }
			if (length(name)) c.set('beyond', s, 'name', name); else c.delete('beyond', s, 'name');
			if (index(KINDS, req.args.kind) >= 0) c.set('beyond', s, 'kind', req.args.kind);
			c.commit('beyond');
			return { ok: true };
		}
	},

	pause: {
		args: { mac: '', paused: true },
		call: function(req) {
			let mac = lc(req.args.mac ?? '');
			if (!match(mac, MAC)) return { ok: false, error: 'Not a device address.' };
			let c = cursor(), s = section_for(mac);
			if (!c.get('beyond', s)) { c.set('beyond', s, 'device'); c.set('beyond', s, 'mac', mac); }
			c.set('beyond', s, 'paused', req.args.paused ? '1' : '0');
			c.commit('beyond');
			return { ok: system('/usr/libexec/beyond/apply-pause') == 0 };
		}
	},

	wifi_get: {
		call: function() {
			let c = cursor(), names = home_ifaces(c);
			if (!length(names)) return { ssid: null };
			return { ssid: c.get('wireless', names[0], 'ssid'), bands: length(names) };
		}
	},

	// The name and password for the join QR code and the printed card. Signed in only: it is the house's password.
	wifi_share: {
		call: function() {
			let c = cursor(), names = home_ifaces(c);
			if (!length(names)) return { ssid: null, key: null };
			return { ssid: c.get('wireless', names[0], 'ssid'), key: c.get('wireless', names[0], 'key') };
		}
	},

	wifi_set: {
		args: { ssid: '', key: '' },
		call: function(req) {
			let bad = check_wifi(req.args.ssid, req.args.key);
			if (bad) return { ok: false, error: bad };
			set_wifi(cursor(), req.args.ssid, req.args.key);
			return { ok: true };
		}
	},

	find_internet: {
		call: function() {
			let c = cursor();
			c.set('beyond', 'main', 'wan_mode', '');
			c.commit('beyond');
			system('/usr/libexec/beyond/wan-detect --until-found >/dev/null 2>&1 &');
			return { ok: true };
		}
	},

	update_state: {
		call: function() {
			return update_state();
		}
	},

	update_check: {
		call: function() {
			system('/usr/libexec/beyond/update check >/dev/null 2>&1');
			return update_state();
		}
	},

	update_install: {
		call: function() {
			if (update_state().status != 'available')
				return { ok: false, error: 'There is no update to install. Check again first.' };
			// In the background: the router restarts into the new version, so the answer has to go first.
			system('(sleep 1; /usr/libexec/beyond/update install) >/dev/null 2>&1 &');
			return { ok: true };
		}
	},

	update_auto: {
		args: { on: false },
		call: function(req) {
			let c = cursor();
			if (!c.get('beyond', 'updates')) c.set('beyond', 'updates', 'updates');
			c.set('beyond', 'updates', 'auto', req.args.on ? '1' : '0');
			c.commit('beyond');
			return { ok: true };
		}
	},

	// Block Big Tech trackers (files/usr/libexec/beyond/apply-trackers). "other" is a servers-file someone set up
	// themselves in Advanced settings, which Beyond leaves alone.
	privacy_state: {
		call: function() {
			return privacy_state();
		}
	},

	privacy_set: {
		args: { on: false },
		call: function(req) {
			let c = cursor();
			if (!c.get('beyond', 'privacy')) c.set('beyond', 'privacy', 'privacy');
			c.set('beyond', 'privacy', 'block_trackers', req.args.on ? '1' : '0');
			c.commit('beyond');
			if (system('/usr/libexec/beyond/apply-trackers >/dev/null 2>&1') != 0) {
				c.set('beyond', 'privacy', 'block_trackers', '0');
				c.commit('beyond');
				return { ok: false, error: 'Another blocker is already set up in Advanced settings, so this one stays off.' };
			}
			let st = privacy_state();
			st.ok = true;
			return st;
		}
	},

	// Internal: for the family script, run as root. Not in the access list, so the app cannot call it.
	family_report: {
		call: function() {
			return family_report();
		}
	},

	family_state: {
		call: function() {
			return family_state();
		}
	},

	family_link: {
		call: function() {
			system('/usr/libexec/beyond/family link >/dev/null 2>&1');
			return family_state();
		}
	},

	family_unlink: {
		call: function() {
			system('/usr/libexec/beyond/family unlink >/dev/null 2>&1');
			return family_state();
		}
	},

	// Before setup: make this router a mesh point of the Beyond router already in the house, using that router's
	// password (it becomes this one's too). Refuses once set up, like finish_setup. The network changes under the
	// browser, so the work happens in the background; setup_state says how it went.
	join_mesh: {
		args: { password: '' },
		call: function(req) {
			if (setup_done())
				return { ok: false, error: 'This router is already set up. Reset it first to make it a mesh point.' };
			let pw = req.args.password;
			if (type(pw) != 'string' || length(pw) < 8 || length(pw) > 128)
				return { ok: false, error: 'Type the password of your main Beyond router.' };
			mkdir(MESH_TMP);
			unlink(`${MESH_TMP}/message`);
			let login = { jsonrpc: '2.0', id: 1, method: 'call',
				params: ['00000000000000000000000000000000', 'session', 'login', { username: 'root', password: pw, timeout: 120 }] };
			if (!write_private(`${MESH_TMP}/login.json`, sprintf('%J', login)) || !write_private(`${MESH_TMP}/password`, pw + '\n'))
				return { ok: false, error: 'Something went wrong on this router. Try again.' };
			writefile(`${MESH_TMP}/joining`, '' + time());
			system('(sleep 2; /usr/libexec/beyond/mesh join) >/dev/null 2>&1 &');
			return { ok: true };
		}
	},

	mesh_state: {
		call: function() {
			return mesh_state();
		}
	},

	// Called by a new point, signed in to this router with its password (files/usr/libexec/beyond/mesh join).
	mesh_join: {
		args: { id: '', model: '' },
		call: function(req) {
			let id = req.args.id ?? '';
			if (!match(id, POINT_ID)) return { ok: false, error: 'Not a mesh point.' };
			if (mesh_role() == 'point') return { ok: false, error: 'This router is a mesh point itself. Join the main one instead.' };
			let c = cursor(), s = 'p_' + id;
			if (!c.get('beyond', s) && length(mesh_points()) >= MAX_POINTS)
				return { ok: false, error: `Your Beyond network already has ${MAX_POINTS} mesh points.` };
			let secret = new_secret();
			if (!secret) return { ok: false, error: 'Something went wrong on the main router. Try again.' };
			mkdir('/etc/beyond');
			mkdir(MESH_ETC);
			if (!write_private(`${MESH_ETC}/${id}`, secret + '\n')) return { ok: false, error: 'Something went wrong on the main router. Try again.' };
			let model = substr(replace(req.args.model ?? '', /[^A-Za-z0-9 ._()+-]/g, ''), 0, 60);
			if (!c.get('beyond', s)) {
				c.set('beyond', s, 'mesh_point');
				c.set('beyond', s, 'id', id);
				c.set('beyond', s, 'name', 'Mesh point ' + (length(mesh_points()) + 1));
				c.set('beyond', s, 'joined', '' + time());
			}
			c.set('beyond', s, 'model', model);
			c.commit('beyond');
			if (mesh_role() != 'main') {
				set_role(c, 'main');
				roam(c);
				c.commit('wireless');
				system('wifi reload >/dev/null 2>&1 &');
			}
			return { ok: true, secret };
		}
	},

	mesh_rename: {
		args: { id: '', name: '' },
		call: function(req) {
			let id = req.args.id ?? '', name = trim(req.args.name ?? '');
			let c = cursor();
			if (!match(id, POINT_ID) || !c.get('beyond', 'p_' + id)) return { ok: false, error: 'No such mesh point.' };
			if (length(name) < 1 || length(name) > 30) return { ok: false, error: 'Names can be 1 to 30 characters.' };
			c.set('beyond', 'p_' + id, 'name', name);
			c.commit('beyond');
			return { ok: true };
		}
	},

	// The point stops getting the Wi-Fi from here. It keeps the one it has until somebody resets it.
	mesh_forget: {
		args: { id: '' },
		call: function(req) {
			let id = req.args.id ?? '';
			if (!match(id, POINT_ID)) return { ok: false, error: 'No such mesh point.' };
			let c = cursor();
			c.delete('beyond', 'p_' + id);
			c.commit('beyond');
			unlink(`${MESH_ETC}/${id}`);
			unlink(`${MESH_TMP}/points/${id}.json`);
			if (!length(mesh_points())) {
				set_role(c, '');
				roam(c);
				c.commit('wireless');
				system('wifi reload >/dev/null 2>&1 &');
			}
			return { ok: true };
		}
	},

	// Internal: what /cgi-bin/beyond-mesh hands over from a point each minute. Not in the access list.
	mesh_sync: {
		args: { id: '', secret: '', from: '', mac: '', model: '', uptime: 0, clients: [] },
		call: function(req) {
			let a = req.args, id = a.id ?? '';
			if (mesh_role() != 'main' || !match(id, POINT_ID) || !match(a.secret ?? '', POINT_SECRET))
				return { ok: false };
			if (trim(readfile(`${MESH_ETC}/${id}`) ?? '') != a.secret) return { ok: false };
			let c = cursor();
			if (!c.get('beyond', 'p_' + id)) return { ok: false };
			mkdir(MESH_TMP);
			mkdir(`${MESH_TMP}/points`);
			let mac = lc(a.mac ?? '');
			writefile(`${MESH_TMP}/points/${id}.json`, sprintf('%J', {
				seen: time(),
				ip: match(a.from ?? '', /^[0-9.]{7,15}$/) ? a.from : null,
				mac: match(mac, MAC) ? mac : null,
				uptime: type(a.uptime) == 'int' ? a.uptime : 0,
				clients: clean_clients(a.clients)
			}));
			let wifi = home_wifi(c);
			if (!wifi) return { ok: false };
			return { ok: true, name: c.get('beyond', 'p_' + id, 'name') ?? 'Mesh point', wifi };
		}
	},

	// Internal, on a point: what it tells the main router (the mesh script adds who it is).
	mesh_report: {
		call: function() {
			let board = connect().call('system', 'board', {}) ?? {}, info = connect().call('system', 'info', {}) ?? {};
			let clients = [];
			for (let mac, w in wifi_clients(connect())) push(clients, { mac, signal: w.signal });
			return {
				model: board.model ?? '',
				mac: lc(trim(readfile('/sys/class/net/br-lan/address') ?? '')),
				uptime: info.uptime ?? 0,
				clients
			};
		}
	},

	// Internal, on a point: the main router's answer. Changes the Wi-Fi only when it differs, so a minute's check
	// doesn't restart the radios.
	mesh_apply: {
		args: { ok: false, name: '', wifi: {} },
		call: function(req) {
			if (mesh_role() != 'point') return { ok: false };
			let w = req.args.wifi ?? {};
			if (check_wifi(w.ssid, w.key)) return { ok: false };
			let c = cursor(), have = home_wifi(c), changed = false;
			let name = trim(req.args.name ?? '');
			if (length(name) && length(name) <= 30 && c.get('beyond', 'mesh', 'name') != name) {
				c.set('beyond', 'mesh', 'name', name);
				c.commit('beyond');
			}
			if (match(w.country ?? '', /^[A-Z]{2}$/) && have?.country != w.country) {
				c.foreach('wireless', 'wifi-device', (r) => c.set('wireless', r['.name'], 'country', w.country));
				changed = true;
			}
			if (changed || !have || have.ssid != w.ssid || have.key != w.key) {
				set_wifi(c, w.ssid, w.key);
				changed = true;
			}
			return { ok: true, changed };
		}
	},

	// On a point: back to a fresh router, as it was before it joined.
	mesh_leave: {
		call: function() {
			if (mesh_role() != 'point') return { ok: false, error: 'This router isn’t a mesh point.' };
			system('(sleep 2; /usr/libexec/beyond/mesh leave) >/dev/null 2>&1 &');
			return { ok: true };
		}
	},

	reboot: {
		call: function() {
			system('(sleep 2; reboot) >/dev/null 2>&1 &');
			return { ok: true };
		}
	}
};

return { beyond: methods };
