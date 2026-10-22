// The parts of the Beyond app that are plain decisions, kept apart so they can be tested (tests/web.test.mjs).

// How the router found the internet, in words a family can read.
export function wanWords(mode) {
	switch (mode) {
		case 'vlan10-dhcp': return 'Fibre (VLAN 10)';
		case 'dhcp': return 'Through another router';
		case 'vlan10-pppoe': return 'Fibre (PPPoE on VLAN 10)';
		case 'pppoe': return 'PPPoE';
		default: return 'Still looking';
	}
}

// Bytes a second into the unit internet plans are sold in.
export function formatRate(bytesPerSec) {
	const bits = Math.max(0, bytesPerSec || 0) * 8;
	if (bits >= 1e9) return (bits / 1e9).toFixed(bits >= 1e10 ? 0 : 1) + ' Gbps';
	if (bits >= 1e6) return (bits / 1e6).toFixed(bits >= 1e8 ? 0 : 1) + ' Mbps';
	if (bits >= 1e3) return Math.round(bits / 1e3) + ' kbps';
	return '0 kbps';
}

export function formatDuration(sec) {
	sec = Math.max(0, Math.floor(sec || 0));
	const day = 86400, hour = 3600, min = 60;
	const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
	if (sec >= day) return plural(Math.floor(sec / day), 'day');
	if (sec >= hour) return plural(Math.floor(sec / hour), 'hour');
	if (sec >= min) return plural(Math.floor(sec / min), 'minute');
	return 'just now';
}

// The speed between two status readings. A counter that went backwards (a reconnect) reads as nothing, not a spike.
export function rateBetween(prev, cur) {
	if (!prev || !cur || !(cur.time > prev.time)) return { down: 0, up: 0 };
	const secs = cur.time - prev.time;
	const d = cur.rx - prev.rx, u = cur.tx - prev.tx;
	return { down: d > 0 ? d / secs : 0, up: u > 0 ? u / secs : 0 };
}

// A first guess at what a device is, from the name it gives itself. Only ever a guess: the person can change it.
const KIND_WORDS = [
	['phone', /iphone|android|galaxy|pixel|oneplus|oppo|xiaomi|redmi|huawei|motorola|moto[ -]?g|nokia/i],
	['tablet', /ipad|tab[ -]?s|kindle|fire[ -]?hd|surface go/i],
	['laptop', /macbook|laptop|thinkpad|xps|chromebook|surface/i],
	['tv', /tv|bravia|roku|chromecast|firetv|fire-tv|apple-?tv|shield|webos|tizen|samsung-?tv|lg-?tv/i],
	['console', /xbox|playstation|ps[45]|nintendo|switch/i],
	['speaker', /sonos|echo|alexa|homepod|google-?home|nest-?(mini|audio|hub)/i],
	['camera', /cam|doorbell|ring-|arlo|wyze|reolink/i],
	['watch', /watch/i],
	['printer', /printer|epson|brother|canon|hp[a-f0-9]{6}/i],
	['computer', /desktop|imac|mac-?mini|pc-|-pc$/i]
];

export function guessKind(hostname) {
	if (!hostname) return 'other';
	for (const [kind, re] of KIND_WORDS) if (re.test(hostname)) return kind;
	return 'other';
}

export function kindOf(d) {
	return d.kind || guessKind(d.hostname);
}

// The name shown: what the family called it, else what it calls itself, tidied, else a plain description.
export function deviceName(d) {
	if (d.name) return d.name;
	if (d.hostname) return d.hostname.replace(/[-_]+/g, ' ').replace(/\.(lan|local)$/i, '').trim();
	return 'Unnamed ' + (d.wifi ? 'Wi-Fi device' : 'device');
}

// Wi-Fi signal (dBm) as 0 to 4 bars.
export function signalBars(dbm) {
	if (typeof dbm !== 'number' || dbm === 0) return 0;
	if (dbm >= -55) return 4;
	if (dbm >= -65) return 3;
	if (dbm >= -75) return 2;
	return 1;
}

// New means it first joined in the last day.
export function isNew(d, now) {
	return !!d.first_seen && now - d.first_seen < 86400;
}

// Online first, then paused, then by name, so the list leads with what is happening now.
export function sortDevices(list) {
	return list.slice().sort((a, b) =>
		(b.online - a.online) || (b.paused - a.paused) || deviceName(a).localeCompare(deviceName(b), 'en-NZ'));
}

export function checkWifi(ssid, key) {
	if (!ssid || ssid.length > 32) return 'The Wi-Fi name needs 1 to 32 characters.';
	if (!key || key.length < 8 || key.length > 63) return 'The Wi-Fi password needs 8 to 63 characters.';
	return null;
}
