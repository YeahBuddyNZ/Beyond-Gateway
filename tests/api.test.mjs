// The app, the router's ubus object and its access list must name the same methods, or a button silently does nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('every method the app calls exists on the router and is in the access list', async () => {
	const app = await read('web/app.js');
	const uc = await read('files/usr/share/rpcd/ucode/beyond.uc');
	const acl = JSON.parse(await read('files/usr/share/rpcd/acl.d/beyond.json'));
	const called = new Set([...app.matchAll(/call\('beyond', '([a-z_]+)'/g)].map((m) => m[1]));
	const defined = new Set([...uc.matchAll(/^\t([a-z_]+): \{$/gm)].map((m) => m[1]));
	const app_acl = acl['beyond-app'];
	const allowed = new Set([...app_acl.read.ubus.beyond, ...app_acl.write.ubus.beyond, ...acl.unauthenticated.read.ubus.beyond, ...acl.unauthenticated.write.ubus.beyond]);
	assert.ok(called.size >= 8, 'found the calls');
	for (const m of called) {
		assert.ok(defined.has(m), `${m} is not defined in beyond.uc`);
		assert.ok(allowed.has(m), `${m} is not in the access list`);
	}
});

test('before sign in, only setup is open', async () => {
	const acl = JSON.parse(await read('files/usr/share/rpcd/acl.d/beyond.json'));
	const open = [...acl.unauthenticated.read.ubus.beyond, ...acl.unauthenticated.write.ubus.beyond].sort();
	assert.deepEqual(open, ['finish_setup', 'setup_state']);
});

test('finish_setup refuses once setup is done', async () => {
	const uc = await read('files/usr/share/rpcd/ucode/beyond.uc');
	const body = uc.slice(uc.indexOf('finish_setup: {'), uc.indexOf('status: {'));
	assert.match(body, /if \(setup_done\(\)\)\s*return \{ ok: false/);
});
