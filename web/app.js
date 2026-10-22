// The Beyond app: what a family sees instead of OpenWrt's own screens.
// It speaks only to the router's "beyond" ubus object (files/usr/share/rpcd/ucode/beyond.uc) through uhttpd's /ubus.

import * as lib from './lib.js';

const PREVIEW = /[?&]preview/.test(location.search);
const NOBODY = '00000000000000000000000000000000';
let sid = sessionStorage.getItem('beyond.sid') || NOBODY;
let mock = null;

// ---------- talking to the router ----------

async function call(object, method, args = {}) {
	if (PREVIEW) {
		mock = mock || (await import('./mock.js'));
		return mock.mockCall(object, method, args);
	}
	const res = await fetch('/ubus', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'call', params: [sid, object, method, args] })
	});
	const body = await res.json();
	if (body.error) {
		// -32002 is "access denied": the session has run out, so ask to sign in again.
		if (body.error.code === -32002 && sid !== NOBODY) { signOut(); throw new Error('signed out'); }
		throw new Error(body.error.message);
	}
	const [code, data] = body.result;
	if (code !== 0) throw new Error('The router said no (' + code + ').');
	return data || {};
}

function signOut() {
	sid = NOBODY;
	sessionStorage.removeItem('beyond.sid');
	route();
}

// ---------- drawing ----------

function h(tag, attrs = {}, ...kids) {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (v == null || v === false) continue;
		if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
		else if (k === 'class') el.className = v;
		else el.setAttribute(k, v === true ? '' : v);
	}
	for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
	return el;
}

const ICONS = {
	phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
	tablet: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
	laptop: '<rect x="4" y="4.5" width="16" height="11" rx="1.5"/><path d="M2 19.5h20"/>',
	tv: '<rect x="2.5" y="4" width="19" height="12.5" rx="1.5"/><path d="M8 20.5h8"/>',
	console: '<path d="M7 7.5h10a4 4 0 0 1 4 4.5l-.6 4.2a2.5 2.5 0 0 1-4.4 1.2L14.5 15h-5L8 17.4a2.5 2.5 0 0 1-4.4-1.2L3 12a4 4 0 0 1 4-4.5z"/><path d="M8 10.5v3M6.5 12h3"/>',
	speaker: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><circle cx="12" cy="14" r="3.2"/><circle cx="12" cy="6.8" r="1"/>',
	camera: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>',
	watch: '<rect x="6.5" y="6" width="11" height="12" rx="3"/><path d="M9 6l.6-3.5h4.8L15 6M9 18l.6 3.5h4.8L15 18"/>',
	printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
	computer: '<rect x="2.5" y="3.5" width="19" height="13" rx="1.5"/><path d="M9 20.5h6M12 16.5v4"/>',
	other: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>',
	home: '<path d="M3.5 11L12 4l8.5 7v9a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
	devices: '<rect x="2.5" y="4" width="13" height="10" rx="1.5"/><path d="M6 18h6"/><rect x="16.5" y="8" width="5" height="12" rx="1.5"/>',
	wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
	settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
	globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
	router: '<rect x="2.5" y="13" width="19" height="7" rx="2"/><path d="M7 16.5h.01M10.5 16.5h.01M6 13l-2-6M18 13l2-6"/>'
};

function icon(name, cls = 'icon') {
	const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	s.setAttribute('viewBox', '0 0 24 24');
	s.setAttribute('class', cls);
	s.setAttribute('aria-hidden', 'true');
	s.innerHTML = ICONS[name] || ICONS.other;
	return s;
}

function dots() {
	return h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
}

function bars(n) {
	return h('span', { class: 'bars', title: n ? n + ' of 4 bars' : 'No signal reading' },
		[1, 2, 3, 4].map((i) => h('i', { class: i <= n ? 'on' : '' })));
}

function toggle(on, label, onchange) {
	const b = h('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label });
	b.addEventListener('click', () => onchange(!on));
	return b;
}

function field(label, input, hint) {
	return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint && h('span', { class: 'hint' }, hint));
}

function passwordInput(attrs) {
	const input = h('input', Object.assign({ type: 'password', autocomplete: 'new-password' }, attrs));
	const show = h('button', { type: 'button', class: 'show', onclick: () => {
		input.type = input.type === 'password' ? 'text' : 'password';
		show.textContent = input.type === 'password' ? 'Show' : 'Hide';
	} }, 'Show');
	return { input, el: h('span', { class: 'with-show' }, input, show) };
}

const root = document.getElementById('app');
let timers = [];
function clearTimers() { timers.forEach(clearInterval); timers = []; }
function every(ms, fn) { fn(); timers.push(setInterval(fn, ms)); }

function render(...nodes) {
	root.replaceChildren(...nodes);
	window.scrollTo(0, 0);
}

function toast(text, bad) {
	const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, text);
	document.body.append(t);
	setTimeout(() => t.remove(), 3200);
}

// ---------- first run ----------

async function setupScreen() {
	const state = await call('beyond', 'setup_state');
	let step = 0;
	const answers = { ssid: '', key: '', password: '' };

	const draw = () => {
		clearTimers();
		const steps = [welcome, wifi, password];
		render(h('main', { class: 'setup' },
			h('div', { class: 'setup-card' },
				h('div', { class: 'brand' }, dots(), h('span', {}, 'Beyond', h('sup', {}, '™'), ' Gateway')),
				h('ol', { class: 'progress', 'aria-label': 'Setup steps' }, steps.map((_, i) => h('li', { class: i <= step ? 'done' : '' }))),
				steps[step]())));
	};

	const welcome = () => {
		const net = h('p', { class: 'net-line' }, icon('globe'), h('span', {}, 'Looking for the internet...'));
		const help = h('p', { class: 'hint' }, 'Not found yet? Check the cable from the fibre box on the wall goes into the port marked WAN. It keeps looking by itself.');
		every(3000, async () => {
			const s = await call('beyond', 'setup_state').catch(() => null);
			if (s && s.wan_mode) { net.replaceChildren(icon('globe'), h('span', {}, 'Found it: ', h('b', {}, lib.wanWords(s.wan_mode)))); help.hidden = true; }
		});
		return h('div', {},
			h('h1', {}, 'Kia ora. Let’s set up your home network.'),
			h('p', { class: 'lead' }, 'Three quick steps. Nothing on your other devices changes until the last one.'),
			net,
			help,
			h('button', { class: 'primary', onclick: () => { step = 1; draw(); } }, 'Start'));
	};

	const wifi = () => {
		const name = h('input', { value: answers.ssid, maxlength: 32, autocomplete: 'off', placeholder: 'Our Whare' });
		const pw = passwordInput({ value: answers.key, maxlength: 63 });
		const err = h('p', { class: 'error', role: 'alert' });
		return h('form', { onsubmit: (e) => {
			e.preventDefault();
			const bad = lib.checkWifi(name.value.trim(), pw.input.value);
			if (bad) { err.textContent = bad; return; }
			answers.ssid = name.value.trim(); answers.key = pw.input.value; step = 2; draw();
		} },
			h('h1', {}, 'Name your Wi-Fi'),
			h('p', { class: 'lead' }, 'Tip: use the same name and password as your old router, and every phone and TV in the house joins by itself.'),
			field('Wi-Fi name', name),
			field('Wi-Fi password', pw.el, 'At least 8 characters.'),
			err,
			h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', onclick: () => { step = 0; draw(); } }, 'Back'), h('button', { class: 'primary' }, 'Next')));
	};

	const password = () => {
		const pw = passwordInput({ maxlength: 128 });
		const again = passwordInput({ maxlength: 128 });
		const err = h('p', { class: 'error', role: 'alert' });
		return h('form', { onsubmit: async (e) => {
			e.preventDefault();
			if (pw.input.value.length < 8) { err.textContent = 'The router password needs at least 8 characters.'; return; }
			if (pw.input.value !== again.input.value) { err.textContent = 'Those two don’t match.'; return; }
			answers.password = pw.input.value;
			err.textContent = '';
			const r = await call('beyond', 'finish_setup', answers).catch((x) => ({ ok: false, error: x.message }));
			if (!r.ok) { err.textContent = r.error || 'That didn’t work. Try again.'; return; }
			done();
		} },
			h('h1', {}, 'A password for the router'),
			h('p', { class: 'lead' }, 'This is for changing settings, not for joining the Wi-Fi. Keep it somewhere safe.'),
			field('Router password', pw.el),
			field('Type it again', again.el),
			err,
			h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', onclick: () => { step = 1; draw(); } }, 'Back'), h('button', { class: 'primary' }, 'Finish')));
	};

	const done = () => clearTimers() || render(h('main', { class: 'setup' }, h('div', { class: 'setup-card' },
		h('div', { class: 'brand' }, dots(), h('span', {}, 'Beyond', h('sup', {}, '™'), ' Gateway')),
		h('h1', {}, 'All set. Ka pai!'),
		h('p', { class: 'lead' }, 'The Wi-Fi is changing to ', h('b', {}, answers.ssid), '. Join it on this device, then open ', h('b', {}, 'beyond.lan'), ' to see your home.'),
		h('button', { class: 'primary', onclick: () => { location.href = PREVIEW ? location.pathname + '?preview' : '/beyond/'; } }, 'I’ve joined it'))));

	if (state.setup_done) return route();
	draw();
}

// ---------- sign in ----------

function signInScreen() {
	const pw = passwordInput({ autocomplete: 'current-password', autofocus: true });
	const err = h('p', { class: 'error', role: 'alert' });
	render(h('main', { class: 'setup' }, h('form', { class: 'setup-card', onsubmit: async (e) => {
		e.preventDefault();
		const r = await call('session', 'login', { username: 'root', password: pw.input.value, timeout: 3600 }).catch(() => null);
		if (!r || !r.ubus_rpc_session) { err.textContent = 'That password didn’t work.'; return; }
		sid = r.ubus_rpc_session;
		sessionStorage.setItem('beyond.sid', sid);
		route();
	} },
		h('div', { class: 'brand' }, dots(), h('span', {}, 'Beyond', h('sup', {}, '™'), ' Gateway')),
		h('h1', {}, 'Welcome home'),
		field('Router password', pw.el),
		err,
		h('button', { class: 'primary' }, 'Sign in'))));
}

// ---------- the app ----------

const TABS = [
	['home', 'Home'],
	['devices', 'Devices'],
	['wifi', 'Wi-Fi'],
	['settings', 'Settings']
];

function shell(tab, ...content) {
	const nav = (cls) => h('nav', { class: cls, 'aria-label': 'Sections' },
		TABS.map(([id, label]) => h('a', { href: '#' + id, class: id === tab ? 'active' : '', 'aria-current': id === tab ? 'page' : null }, icon(id), h('span', {}, label))));
	return h('div', { class: 'shell' },
		h('aside', { class: 'side' }, h('div', { class: 'brand' }, dots(), h('span', {}, 'Beyond', h('sup', {}, '™'), ' Gateway')), nav('side-nav')),
		h('main', { class: 'content' }, h('header', { class: 'top' }, h('div', { class: 'brand small' }, dots(), h('span', {}, 'Gateway'))), ...content),
		nav('tab-bar'));
}

async function homeScreen() {
	const down = h('b', {}, '...'), up = h('b', {}, '...');
	const internet = h('span', { class: 'node-state' }, 'Checking');
	const online = h('b', {}, '...'), paused = h('b', {}, '...'), uptime = h('b', {}, '...'), how = h('b', {}, '...');
	const deviceCount = h('span', { class: 'node-state' }, '...');
	const wanNode = h('div', { class: 'node' }, h('div', { class: 'node-dot' }, icon('globe')), h('span', { class: 'node-name' }, 'Internet'), internet);
	const recent = h('ul', { class: 'mini-list' });
	let prev = null;

	render(shell('home',
		h('h1', { class: 'page-title' }, 'Your home'),
		h('section', { class: 'map' },
			h('div', { class: 'map-row' },
				wanNode,
				h('div', { class: 'link' }),
				h('div', { class: 'node' }, h('div', { class: 'node-dot gw' }, icon('router')), h('span', { class: 'node-name' }, 'Beyond Gateway'), h('span', { class: 'node-state' }, 'Running')),
				h('div', { class: 'link' }),
				h('a', { class: 'node', href: '#devices' }, h('div', { class: 'node-dot' }, icon('devices')), h('span', { class: 'node-name' }, 'Devices'), deviceCount)),
			h('div', { class: 'speeds' },
				h('div', {}, h('span', { class: 'label' }, 'Down now'), down),
				h('div', {}, h('span', { class: 'label' }, 'Up now'), up))),
		h('section', { class: 'tiles' },
			h('div', { class: 'tile' }, h('span', { class: 'label' }, 'Online now'), online),
			h('div', { class: 'tile' }, h('span', { class: 'label' }, 'Paused'), paused),
			h('div', { class: 'tile' }, h('span', { class: 'label' }, 'Internet up for'), uptime),
			h('div', { class: 'tile' }, h('span', { class: 'label' }, 'Connected by'), how)),
		h('section', { class: 'card' }, h('h2', {}, 'Just joined'), recent)));

	every(2000, async () => {
		const s = await call('beyond', 'status').catch(() => null);
		if (!s) return;
		const cur = { time: s.time, rx: s.wan.counters.rx, tx: s.wan.counters.tx };
		const r = lib.rateBetween(prev, cur);
		prev = cur;
		down.textContent = lib.formatRate(r.down);
		up.textContent = lib.formatRate(r.up);
		internet.textContent = s.wan.up ? 'Connected' : 'Not connected';
		wanNode.classList.toggle('down', !s.wan.up);
		uptime.textContent = s.wan.up ? lib.formatDuration(s.wan.uptime) : 'Not connected';
		how.textContent = lib.wanWords(s.wan.mode);
	});
	every(10000, async () => {
		const r = await call('beyond', 'devices').catch(() => null);
		if (!r) return;
		const list = r.devices;
		const on = list.filter((d) => d.online).length;
		online.textContent = on;
		deviceCount.textContent = on + ' online';
		paused.textContent = list.filter((d) => d.paused).length;
		const now = Date.now() / 1000;
		const fresh = list.filter((d) => lib.isNew(d, now));
		recent.replaceChildren(...(fresh.length ? fresh.map((d) => h('li', {}, icon(lib.kindOf(d)), h('span', {}, lib.deviceName(d)), h('span', { class: 'when' }, lib.formatDuration(now - d.first_seen) + ' ago')))
			: [h('li', { class: 'empty' }, 'Nothing new today. When a new phone, tablet or gadget joins, it shows here.')]));
	});
}

async function devicesScreen() {
	const list = h('ul', { class: 'device-list' });
	const filters = ['All', 'Online', 'Paused'];
	let filter = 'All', latest = [];
	const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Show' });
	const drawChips = () => chips.replaceChildren(...filters.map((f) => h('button', { class: 'chip' + (f === filter ? ' on' : ''), 'aria-pressed': f === filter ? 'true' : 'false', onclick: () => { filter = f; drawChips(); draw(); } }, f)));

	const draw = () => {
		const now = Date.now() / 1000;
		const shown = lib.sortDevices(latest).filter((d) => filter === 'All' || (filter === 'Online' ? d.online : d.paused));
		list.replaceChildren(...(shown.length ? shown.map((d) => h('li', { class: 'device' + (d.online ? '' : ' offline') + (d.paused ? ' paused' : '') },
			h('button', { class: 'device-main', onclick: () => editDevice(d, load), 'aria-label': 'Edit ' + lib.deviceName(d) },
				h('div', { class: 'device-icon' }, icon(lib.kindOf(d))),
				h('div', { class: 'device-text' },
					h('span', { class: 'device-name' }, lib.deviceName(d)),
					h('span', { class: 'device-sub' },
						lib.isNew(d, now) && h('span', { class: 'badge' }, 'New'),
						d.paused ? 'Paused' : d.online ? (d.wifi ? 'Wi-Fi' : 'Cable') : 'Away',
						d.ip && d.online ? ' · ' + d.ip : ''))),
			d.wifi && d.online ? bars(lib.signalBars(d.signal)) : h('span', { class: 'bars-gap' }),
			toggle(!d.paused, (d.paused ? 'Unpause ' : 'Pause ') + lib.deviceName(d), async (on) => {
				d.paused = !on; draw();
				const r = await call('beyond', 'pause', { mac: d.mac, paused: !on }).catch(() => ({ ok: false }));
				if (!r.ok) { d.paused = on; draw(); toast('That didn’t go through. Try again.', true); }
				else toast(on ? lib.deviceName(d) + ' is back online.' : lib.deviceName(d) + ' is paused.');
			})))
			: [h('li', { class: 'empty' }, filter === 'Paused' ? 'Nothing is paused. Flick a switch to pause a device’s internet.' : 'No devices yet. They show up here as soon as they join.')]));
	};

	const load = async () => {
		const r = await call('beyond', 'devices').catch(() => null);
		if (r) { latest = r.devices; draw(); }
	};

	drawChips();
	render(shell('devices',
		h('h1', { class: 'page-title' }, 'Devices'),
		h('p', { class: 'lead' }, 'Everything on your network. The switch pauses a device’s internet; it can still see the router.'),
		chips,
		h('section', { class: 'card flush' }, list)));
	every(8000, load);
}

function editDevice(d, reload) {
	const name = h('input', { value: d.name || '', maxlength: 40, placeholder: lib.deviceName(d) });
	const kind = h('select', {}, Object.keys(ICONS).filter((k) => !['home', 'devices', 'wifi', 'settings', 'globe', 'router'].includes(k))
		.map((k) => h('option', { value: k, selected: lib.kindOf(d) === k }, k[0].toUpperCase() + k.slice(1))));
	const dlg = h('dialog', { class: 'sheet' }, h('form', { method: 'dialog', onsubmit: async (e) => {
		e.preventDefault();
		const r = await call('beyond', 'rename', { mac: d.mac, name: name.value.trim(), kind: kind.value }).catch(() => ({ ok: false }));
		dlg.close(); dlg.remove();
		if (r.ok) reload(); else toast(r.error || 'That didn’t save.', true);
	} },
		h('h2', {}, lib.deviceName(d)),
		field('Name', name, 'Like "Nikau’s iPad". Only you see this.'),
		field('What it is', kind),
		h('dl', { class: 'facts' },
			h('dt', {}, 'Address'), h('dd', {}, d.ip || 'Not right now'),
			h('dt', {}, 'Hardware ID'), h('dd', {}, d.mac),
			d.hostname && h('dt', {}, 'Calls itself'), d.hostname && h('dd', {}, d.hostname)),
		h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', onclick: () => { dlg.close(); dlg.remove(); } }, 'Cancel'), h('button', { class: 'primary' }, 'Save'))));
	document.body.append(dlg);
	dlg.showModal();
}

async function wifiScreen() {
	const w = await call('beyond', 'wifi_get').catch(() => ({}));
	const name = h('input', { value: w.ssid || '', maxlength: 32 });
	const pw = passwordInput({ maxlength: 63, placeholder: 'Leave blank to keep it' });
	const err = h('p', { class: 'error', role: 'alert' });
	render(shell('wifi',
		h('h1', { class: 'page-title' }, 'Wi-Fi'),
		h('form', { class: 'card', onsubmit: async (e) => {
			e.preventDefault();
			if (!pw.input.value) { err.textContent = 'Type the password too (the old one is fine), so every band gets the same.'; return; }
			const bad = lib.checkWifi(name.value.trim(), pw.input.value);
			if (bad) { err.textContent = bad; return; }
			const r = await call('beyond', 'wifi_set', { ssid: name.value.trim(), key: pw.input.value }).catch(() => ({ ok: false }));
			if (!r.ok) { err.textContent = r.error || 'That didn’t save.'; return; }
			err.textContent = '';
			toast('Saved. Devices reconnect in a few seconds.');
		} },
			h('h2', {}, 'Your Wi-Fi'),
			h('p', { class: 'hint' }, (w.bands || 1) > 1 ? 'One name for every band. Devices pick the fastest by themselves.' : ''),
			field('Wi-Fi name', name),
			field('Wi-Fi password', pw.el, 'Changing it means every device has to join again.'),
			err,
			h('button', { class: 'primary' }, 'Save')),
		h('section', { class: 'card soon' }, h('h2', {}, 'Guest Wi-Fi'), h('p', { class: 'hint' }, 'Coming next: a separate network for visitors, with a QR code to put on the TV or the fridge.'))));
}

async function settingsScreen() {
	const s = await call('beyond', 'status').catch(() => ({ wan: {} }));
	render(shell('settings',
		h('h1', { class: 'page-title' }, 'Settings'),
		h('section', { class: 'card' },
			h('h2', {}, 'Internet'),
			h('dl', { class: 'facts' },
				h('dt', {}, 'Connected by'), h('dd', {}, lib.wanWords(s.wan.mode)),
				h('dt', {}, 'Address'), h('dd', {}, s.wan.ipv4 || 'None yet'),
				h('dt', {}, 'IPv6'), h('dd', {}, s.wan.ipv6 ? 'Yes' : 'No')),
			h('button', { class: 'ghost', onclick: async () => {
				await call('beyond', 'find_internet').catch(() => null);
				toast('Looking for the internet again. It takes about a minute.');
			} }, 'Find the internet again'),
			h('p', { class: 'hint' }, 'Use this after changing ISP, or if the fibre box was swapped.')),
		h('section', { class: 'card' },
			h('h2', {}, 'This router'),
			h('dl', { class: 'facts' },
				h('dt', {}, 'Model'), h('dd', {}, s.model || 'Unknown'),
				h('dt', {}, 'Running for'), h('dd', {}, lib.formatDuration(s.uptime)),
				h('dt', {}, 'OpenWrt'), h('dd', {}, s.release || 'Unknown')),
			h('div', { class: 'row' },
				h('button', { class: 'ghost', onclick: async () => {
					if (!confirm('Restart the router? The internet drops for about a minute.')) return;
					await call('beyond', 'reboot').catch(() => null);
					toast('Restarting. Back in about a minute.');
				} }, 'Restart'),
				h('button', { class: 'ghost', onclick: signOut }, 'Sign out'))),
		h('section', { class: 'card' },
			h('h2', {}, 'The way back'),
			h('p', {}, 'Want your old router back? Unplug the cable from Beyond’s WAN port and plug it into your old router instead. That’s all: nothing about your internet plan changed.'),
			h('p', { class: 'hint' }, 'For people who know networks: OpenWrt’s own screens are still here.'),
			h('a', { class: 'ghost button', href: '/cgi-bin/luci/' }, 'Advanced settings'))));
}

// ---------- routing ----------

async function route() {
	clearTimers();
	try {
		const state = await call('beyond', 'setup_state');
		if (!state.setup_done) return setupScreen();
		if (sid === NOBODY) return signInScreen();
		const tab = (location.hash || '#home').slice(1);
		await ({ home: homeScreen, devices: devicesScreen, wifi: wifiScreen, settings: settingsScreen }[tab] || homeScreen)();
	} catch (e) {
		if (e.message === 'signed out') return;
		render(h('main', { class: 'setup' }, h('div', { class: 'setup-card' },
			h('div', { class: 'brand' }, dots(), h('span', {}, 'Beyond', h('sup', {}, '™'), ' Gateway')),
			h('h1', {}, 'Can’t reach the router'),
			h('p', { class: 'lead' }, 'Check you’re on its Wi-Fi or plugged into it, then try again.'),
			h('button', { class: 'primary', onclick: route }, 'Try again'))));
	}
}

window.addEventListener('hashchange', route);
route();
