// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as lib from '../web/src/lib.js';

test('the ways in read as plain words', () => {
	assert.equal(lib.wanWords('vlan10-dhcp'), 'Fibre (VLAN 10)');
	assert.equal(lib.wanWords('dhcp'), 'Through another router');
	assert.equal(lib.wanWords(''), 'Still looking');
});

test('speeds are in bits, the way plans are sold', () => {
	assert.equal(lib.formatRate(0), '0 kbps');
	assert.equal(lib.formatRate(125000), '1.0 Mbps');
	assert.equal(lib.formatRate(12.5e6), '100 Mbps');
	assert.equal(lib.formatRate(125e6), '1.0 Gbps');
});

test('a counter going backwards is not a spike', () => {
	assert.deepEqual(lib.rateBetween({ time: 10, rx: 5000, tx: 100 }, { time: 12, rx: 100, tx: 300 }), { down: 0, up: 100 });
	assert.deepEqual(lib.rateBetween({ time: 10, rx: 0, tx: 0 }, { time: 10, rx: 5, tx: 5 }), { down: 0, up: 0 });
	assert.deepEqual(lib.rateBetween(null, { time: 1, rx: 1, tx: 1 }), { down: 0, up: 0 });
});

test('durations', () => {
	assert.equal(lib.formatDuration(30), 'just now');
	assert.equal(lib.formatDuration(60), '1 minute');
	assert.equal(lib.formatDuration(7200), '2 hours');
	assert.equal(lib.formatDuration(86400 * 3 + 5), '3 days');
});

test('kinds are guessed from names, and a chosen kind wins', () => {
	assert.equal(lib.guessKind('Leos-iPhone'), 'phone');
	assert.equal(lib.guessKind('BRAVIA-4K-GB'), 'tv');
	assert.equal(lib.guessKind('PS5-123'), 'console');
	assert.equal(lib.guessKind('MacBook-Air'), 'laptop');
	assert.equal(lib.guessKind('esp32-a1b2'), 'other');
	assert.equal(lib.guessKind(null), 'other');
	assert.equal(lib.kindOf({ hostname: 'Leos-iPhone', kind: 'tablet' }), 'tablet');
});

test('names', () => {
	assert.equal(lib.deviceName({ name: "Leo's phone", hostname: 'x' }), "Leo's phone");
	assert.equal(lib.deviceName({ hostname: 'Living-Room_TV.lan' }), 'Living Room TV');
	assert.equal(lib.deviceName({ wifi: true }), 'Unnamed Wi-Fi device');
});

test('signal bars', () => {
	assert.equal(lib.signalBars(-50), 4);
	assert.equal(lib.signalBars(-70), 2);
	assert.equal(lib.signalBars(-90), 1);
	assert.equal(lib.signalBars(undefined), 0);
});

test('new means the last day', () => {
	assert.equal(lib.isNew({ first_seen: 1000 }, 1000 + 3600), true);
	assert.equal(lib.isNew({ first_seen: 1000 }, 1000 + 90000), false);
	assert.equal(lib.isNew({ first_seen: 0 }, 5), false);
});

test('online first, then paused, then by name', () => {
	const out = lib.sortDevices([
		{ name: 'b', online: false, paused: false },
		{ name: 'z', online: true, paused: false },
		{ name: 'c', online: false, paused: true },
		{ name: 'a', online: true, paused: false }
	]).map((d) => d.name);
	assert.deepEqual(out, ['a', 'z', 'c', 'b']);
});

test('the browser checks Wi-Fi the same way the router does', () => {
	assert.ok(lib.checkWifi('', 'password1'));
	assert.ok(lib.checkWifi('Home', 'short'));
	assert.equal(lib.checkWifi('Home', 'longenough'), null);
});

// beyond.uc must check the same limits, or the browser and the router disagree about what is allowed.
test('router and browser agree on the Wi-Fi limits', async () => {
	const { readFile } = await import('node:fs/promises');
	const uc = await readFile(new URL('../files/usr/share/rpcd/ucode/beyond.uc', import.meta.url), 'utf8');
	assert.match(uc, /length\(ssid\) > 32/);
	assert.match(uc, /length\(key\) < 8 \|\| length\(key\) > 63/);
});

test('update words say what is happening, and a build without the key says updates are off', () => {
	assert.equal(lib.updateWords({ enabled: false, status: 'available' }).badge, 'Off');
	assert.equal(lib.updateWords({ enabled: true, status: 'available', available: { version: '1.142', notes: 'Faster' } }).title, 'Beyond Gateway 1.142');
	assert.equal(lib.updateWords({ enabled: true, status: 'current' }).badge, 'Up to date');
	assert.equal(lib.updateWords({ enabled: true, status: 'error', message: 'No internet' }).detail, 'No internet');
	assert.equal(lib.updateWords({ enabled: true, status: 'unknown' }).badge, 'Not checked');
});

test('how long ago, in words', () => {
	assert.equal(lib.agoWords(0, 100), 'not yet');
	assert.equal(lib.agoWords(1000, 1030), 'just now');
	assert.equal(lib.agoWords(0 + 1, 1 + 600), '10 minutes ago');
	assert.equal(lib.agoWords(1, 1 + 3600), 'an hour ago');
	assert.equal(lib.agoWords(1, 1 + 5 * 3600), '5 hours ago');
	assert.equal(lib.agoWords(1, 1 + 3 * 86400), '3 days ago');
});

test('the join QR code escapes what would break it', () => {
	assert.equal(lib.wifiQrText('Aroha Whare', 'kumara-pie-42'), 'WIFI:T:WPA;S:Aroha Whare;P:kumara-pie-42;;');
	assert.equal(lib.wifiQrText('Bach; upstairs', 'a:b,c"d\\e'), 'WIFI:T:WPA;S:Bach\\; upstairs;P:a\\:b\\,c\\"d\\\\e;;');
});
