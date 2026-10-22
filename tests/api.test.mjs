// The app, the router's ubus object and its access list must name the same methods, or a button silently does nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('every method the app calls exists on the router and is in the access list', async () => {
	const app = await read('web/src/api.ts');
	const uc = await read('files/usr/share/rpcd/ucode/beyond.uc');
	const acl = JSON.parse(await read('files/usr/share/rpcd/acl.d/beyond.json'));
	const called = new Set([...app.matchAll(/call\("beyond", "([a-z_]+)"/g)].map((m) => m[1]));
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
	assert.deepEqual(open, ['finish_setup', 'join_mesh', 'setup_state']);
});

test('finish_setup and join_mesh refuse once setup is done', async () => {
	const uc = await read('files/usr/share/rpcd/ucode/beyond.uc');
	for (const [from, to] of [['finish_setup: {', 'status: {'], ['join_mesh: {', 'mesh_state: {']]) {
		const body = uc.slice(uc.indexOf(from), uc.indexOf(to));
		assert.ok(body.length > 50, from);
		assert.match(body, /if \(setup_done\(\)\)\s*return \{ ok: false/, from);
	}
});

// The mesh check-in is the main router's page (/cgi-bin/beyond-mesh) and the point's script, never the app.
test('the mesh check-in is not open to the app, and the mesh state holds no secret', async () => {
	const uc = await read('files/usr/share/rpcd/ucode/beyond.uc');
	const acl = JSON.stringify(JSON.parse(await read('files/usr/share/rpcd/acl.d/beyond.json')));
	for (const m of ['mesh_sync', 'mesh_report', 'mesh_apply']) {
		assert.match(uc, new RegExp(`^\\t${m}: \\{$`, 'm'), m);
		assert.doesNotMatch(acl, new RegExp(m), m);
	}
	const state = uc.slice(uc.indexOf('function mesh_points()'), uc.indexOf('function roam('));
	assert.doesNotMatch(state, /secret/);
	const cgi = await read('files/www/cgi-bin/beyond-mesh');
	assert.match(cgi, /ubus call beyond mesh_sync/);
	assert.match(cgi, /403 Forbidden/);
});

// Screens must go through api.ts, so the check above sees every call the app makes.
test('only api.ts talks to the router', async () => {
	const { readdir } = await import('node:fs/promises');
	const files = (await readdir(new URL('../web/src/', import.meta.url), { recursive: true })).filter((f) => /\.(tsx?|js)$/.test(f) && f !== 'api.ts');
	for (const f of files) {
		const src = await read('web/src/' + f);
		assert.doesNotMatch(src, /\/ubus|\bcall\(\s*["']/, `${f} talks to the router directly`);
	}
});

test('the router build leaves the preview stand-in out', async () => {
	const api = await read('web/src/api.ts');
	assert.match(api, /import\.meta\.env\.MODE !== "router" &&/);
	const build = await read('build.sh');
	assert.match(build, /npm run build:router/);
});

test('the kinds the app offers are the kinds the router accepts', async () => {
	const uc = await read('files/usr/share/rpcd/ucode/beyond.uc');
	const app = await read('web/src/components/device-icon.tsx');
	const router = JSON.parse(uc.match(/const KINDS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
	const offered = [...app.matchAll(/^\s*\["([a-z]+)", "/gm)].map((m) => m[1]);
	assert.deepEqual(offered.sort(), router.sort());
});

// The Beyond Family link: the report is the family script's, not the app's, and the card never sees the secret.
test('the Beyond Family report is not open to the app, and its state holds no secret', async () => {
	const uc = await read('files/usr/share/rpcd/ucode/beyond.uc');
	const acl = JSON.stringify(JSON.parse(await read('files/usr/share/rpcd/acl.d/beyond.json')));
	assert.doesNotMatch(acl, /family_report/);
	const state = uc.slice(uc.indexOf('function family_state()'), uc.indexOf('const methods = {'));
	assert.doesNotMatch(state.slice(state.indexOf('return {')), /secret/);
	const report = uc.slice(uc.indexOf('function family_report()'), uc.indexOf('function family_state()'));
	assert.doesNotMatch(report, /\b(mac|ip|hostname|signal):/, 'no device address leaves the house');
});
