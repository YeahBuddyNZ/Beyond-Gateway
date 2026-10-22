// Beyond Gateway's ubus object, the only thing the Beyond app talks to (through uhttpd's /ubus).
// Everything here runs as root inside rpcd; the ACL in /usr/share/rpcd/acl.d/beyond.json says who may call what.
// Before setup, anyone on the LAN may ask setup_state and call finish_setup once; after that, only a logged in session.

'use strict';

import { readfile, popen } from 'fs';
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

function set_wifi(c, ssid, key) {
	for (let name in home_ifaces(c)) {
		c.set('wireless', name, 'ssid', ssid);
		c.set('wireless', name, 'encryption', 'sae-mixed');
		c.set('wireless', name, 'key', key);
		c.set('wireless', name, 'disabled', '0');
	}
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
	let known = {};
	c.foreach('beyond', 'device', (s) => { if (s.mac) known[lc(s.mac)] = s; });

	let macs = {};
	for (let m in keys(lease)) macs[m] = true;
	for (let m in keys(neigh)) macs[m] = true;
	for (let m in keys(wifi)) macs[m] = true;
	for (let m in keys(known)) macs[m] = true;

	let out = [];
	for (let mac in keys(macs)) {
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

// key=value lines, as /etc/beyond/build and the updater's state file are written.
function keyvalues(path) {
	let out = {};
	for (let line in split(readfile(path) ?? '', '\n')) {
		let m = match(line, /^([a-z_]+)=(.*)$/);
		if (m) out[m[1]] = m[2];
	}
	return out;
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

const methods = {
	setup_state: {
		call: function() {
			let board = connect().call('system', 'board', {});
			return { setup_done: setup_done(), model: board?.model, wan_mode: cursor().get('beyond', 'main', 'wan_mode') ?? '' };
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

	reboot: {
		call: function() {
			system('(sleep 2; reboot) >/dev/null 2>&1 &');
			return { ok: true };
		}
	}
};

return { beyond: methods };
