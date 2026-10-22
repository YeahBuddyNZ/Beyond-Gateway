// A stand-in router for previewing the app in a browser (?preview). Made-up family, made-up devices.
// ?preview=setup starts at first-run setup instead.

const now = () => Math.floor(Date.now() / 1000);
const start = now();
let setupDone = !/preview=setup/.test(location.search);
let rx = 8e9, tx = 1.2e9;
let ssid = 'Aroha Whare';
let key = 'kumara-pie-42';
// ?preview&update shows a new version waiting.
const update = { status: /update/.test(location.search) ? 'available' : 'current', auto: false, checked: start - 3600 * 5 };
const updateState = () => ({
	version: '1.141', build: 141, enabled: true, auto: update.auto, status: update.status, checked: update.checked,
	available: update.status === 'available' || update.status === 'installing' ? { version: '1.142', date: '23/10/2026', notes: 'Help inside the app, and updates that install themselves overnight.' } : null
});

// ?preview&family starts linked. Linking in the preview takes about 10 seconds, as if typed in on a phone.
const family = { linked: /family/.test(location.search), code: null, until: null, at: 0 };
const familyState = () => {
	if (family.code && now() - family.at > 10) { family.linked = true; family.code = null; family.until = null; }
	return { linked: family.linked, code: family.code, until: family.until, checked: now(), message: null };
};

// ?preview&mesh has two mesh points; ?preview&point is the view on a mesh point itself.
const isPoint = /[?&]point/.test(location.search);
const points = /[?&]mesh/.test(location.search) ? [
	{ id: '3f9a1c0b7d2e4a51', name: 'Upstairs', model: 'TP-Link Archer AX55', joined: start - 86400 * 9, seen: start - 20, online: true, ip: '10.42.0.150', clients: 3 },
	{ id: '8b21e6d4c09f7a33', name: 'Garage', model: 'GL.iNet GL-MT3000', joined: start - 86400 * 2, seen: start - 3600 * 3, online: false, ip: '10.42.0.151', clients: 0 }
] : [];
let joinAt = 0;
const meshState = () => isPoint
	? { role: 'point', name: 'Upstairs', main: '10.42.0.1', checked: now() - 30, message: null }
	: { role: points.length ? 'main' : '', points: points.map((p) => Object.assign({}, p, p.online ? { seen: now() - 20 } : {})), max: 10 };

const devices = [
	{ mac: 'a4:83:e7:11:22:01', ip: '10.42.0.101', hostname: 'Aroha-iPhone', name: "Mum's phone", online: true, wifi: true, signal: -48, first_seen: start - 86400 * 40 },
	{ mac: 'a4:83:e7:11:22:02', ip: '10.42.0.102', hostname: 'Nikau-iPad', name: "Nikau's iPad", online: true, wifi: true, signal: -63, first_seen: start - 86400 * 40 },
	{ mac: '3c:22:fb:11:22:03', ip: '10.42.0.103', hostname: 'BRAVIA-4K-GB', name: 'Lounge TV', online: true, wifi: false, first_seen: start - 86400 * 40 },
	{ mac: '7c:bb:8a:11:22:04', ip: '10.42.0.104', hostname: 'PS5-482', online: true, wifi: true, signal: -71, paused: true, first_seen: start - 86400 * 12 },
	{ mac: 'f0:18:98:11:22:05', ip: '10.42.0.105', hostname: 'MacBook-Air', name: "Dad's laptop", online: true, wifi: true, signal: -58, first_seen: start - 86400 * 40 },
	{ mac: '48:a6:b8:11:22:06', ip: '10.42.0.106', hostname: 'Sonos-Kitchen', online: false, wifi: true, first_seen: start - 86400 * 20 },
	{ mac: 'a4:83:e7:11:22:08', ip: '10.42.0.108', hostname: 'Mere-iPhone', name: "Mere's phone", online: true, wifi: true, signal: -52, point: points.length ? 'Upstairs' : undefined, first_seen: start - 86400 * 30 },
	{ mac: 'e8:9f:6d:11:22:07', ip: '10.42.0.107', hostname: 'esp32-7f3a1c', online: true, wifi: true, signal: -80, first_seen: start - 1800 }
];

const handlers = {
	setup_state: () => {
		if (joinAt && now() - joinAt > 6) { setupDone = true; joinAt = 0; }
		return { setup_done: setupDone, model: 'GL.iNet GL-MT6000', wan_mode: 'vlan10-dhcp', role: isPoint ? 'point' : '', joining: !!joinAt, mesh_message: null };
	},
	join_mesh: (a) => {
		if (setupDone) return { ok: false, error: 'This router is already set up. Reset it first to make it a mesh point.' };
		if (!a.password || a.password.length < 8) return { ok: false, error: 'Type the password of your main Beyond router.' };
		joinAt = now();
		return { ok: true };
	},
	mesh_state: meshState,
	mesh_rename: (a) => { const p = points.find((x) => x.id === a.id); if (p) p.name = a.name; return { ok: true }; },
	mesh_forget: (a) => { const i = points.findIndex((x) => x.id === a.id); if (i >= 0) points.splice(i, 1); return { ok: true }; },
	mesh_leave: () => ({ ok: true }),
	finish_setup: (a) => {
		if (setupDone) return { ok: false, error: 'Setup is already done. Sign in instead.' };
		if (!a.password || a.password.length < 8) return { ok: false, error: 'The router password needs at least 8 characters.' };
		setupDone = true; ssid = a.ssid;
		return { ok: true };
	},
	status: () => {
		rx += 2.5e6 + Math.random() * 6e6; tx += 2e5 + Math.random() * 6e5;
		return {
			model: 'GL.iNet GL-MT6000', release: '25.12.1', hostname: 'Beyond', uptime: now() - start + 86400 * 6,
			wan: { up: true, mode: 'vlan10-dhcp', ipv4: '203.0.113.42', ipv6: true, dns: ['202.180.64.10'], uptime: now() - start + 86400 * 6, device: 'wan.10', counters: { rx, tx } },
			time: now()
		};
	},
	devices: () => ({ devices: devices.map((d) => Object.assign({ paused: false, kind: null }, d)) }),
	rename: (a) => { const d = devices.find((x) => x.mac === a.mac); if (d) { d.name = a.name || undefined; if (a.kind) d.kind = a.kind; } return { ok: true }; },
	pause: (a) => { const d = devices.find((x) => x.mac === a.mac); if (d) d.paused = !!a.paused; return { ok: true }; },
	wifi_get: () => ({ ssid, bands: 2 }),
	wifi_share: () => ({ ssid, key }),
	wifi_set: (a) => { ssid = a.ssid; key = a.key; return { ok: true }; },
	find_internet: () => ({ ok: true }),
	reboot: () => ({ ok: true }),
	update_state: updateState,
	update_check: () => { update.checked = now(); return updateState(); },
	update_install: () => { update.status = 'installing'; return { ok: true }; },
	update_auto: (a) => { update.auto = !!a.on; return { ok: true }; },
	family_state: familyState,
	family_link: () => { family.code = 'KQXRMB'; family.until = now() + 600; family.at = now(); return familyState(); },
	family_unlink: () => { Object.assign(family, { linked: false, code: null, until: null }); return familyState(); }
};

export async function mockCall(object, method, args) {
	await new Promise((r) => setTimeout(r, 120));
	if (object === 'session' && method === 'login') return args.password ? { ubus_rpc_session: 'preview' } : null;
	return handlers[method] ? handlers[method](args || {}) : null;
}
