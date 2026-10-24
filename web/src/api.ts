// Talking to the router: only its "beyond" ubus object (files/usr/share/rpcd/ucode/beyond.uc), through uhttpd's /ubus.
// ?preview swaps the router for the stand-in in mock.js, so the app can be looked at in a browser.

// A build for the router (vite build --mode router) leaves the stand-in out altogether.
export const PREVIEW = import.meta.env.MODE !== "router" && /[?&]preview/.test(location.search)
const NOBODY = "00000000000000000000000000000000"

let sid = sessionStorage.getItem("beyond.sid") || NOBODY
const listeners = new Set<() => void>()

export const signedIn = () => sid !== NOBODY
export function onSessionChange(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export function setSession(next: string | null) {
  sid = next || NOBODY
  if (next) sessionStorage.setItem("beyond.sid", next)
  else sessionStorage.removeItem("beyond.sid")
  listeners.forEach((fn) => fn())
}

export const signOut = () => setSession(null)

export class SignedOut extends Error {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Answer = Record<string, any>

export async function call(object: string, method: string, args: Answer = {}): Promise<Answer> {
  if (PREVIEW) {
    const mock = await import("./mock.js")
    return (await mock.mockCall(object, method, args)) || {}
  }
  const res = await fetch("/ubus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "call", params: [sid, object, method, args] }),
  })
  const body = await res.json()
  if (body.error) {
    // -32002 is "access denied": the session has run out, so ask to sign in again.
    if (body.error.code === -32002 && signedIn()) {
      signOut()
      throw new SignedOut("signed out")
    }
    throw new Error(body.error.message)
  }
  const [code, data] = body.result
  if (code !== 0) throw new Error("The router said no (" + code + ").")
  return data || {}
}

// The ways a family uses the router, one name each, so tests/api.test.mjs can check every one is allowed.
export const beyond = {
  setupState: () => call("beyond", "setup_state"),
  finishSetup: (a: { ssid: string; key: string; password: string }) => call("beyond", "finish_setup", a),
  status: () => call("beyond", "status"),
  devices: () => call("beyond", "devices"),
  rename: (a: { mac: string; name: string; kind: string }) => call("beyond", "rename", a),
  pause: (a: { mac: string; paused: boolean }) => call("beyond", "pause", a),
  wifiGet: () => call("beyond", "wifi_get"),
  wifiShare: () => call("beyond", "wifi_share"),
  wifiSet: (a: { ssid: string; key: string }) => call("beyond", "wifi_set", a),
  findInternet: () => call("beyond", "find_internet"),
  reboot: () => call("beyond", "reboot"),
  updateState: () => call("beyond", "update_state"),
  updateCheck: () => call("beyond", "update_check"),
  updateInstall: () => call("beyond", "update_install"),
  updateAuto: (a: { on: boolean }) => call("beyond", "update_auto", a),
  familyState: () => call("beyond", "family_state"),
  familyLink: () => call("beyond", "family_link"),
  familyUnlink: () => call("beyond", "family_unlink"),
  joinMesh: (a: { password: string }) => call("beyond", "join_mesh", a),
  meshState: () => call("beyond", "mesh_state"),
  meshRename: (a: { id: string; name: string }) => call("beyond", "mesh_rename", a),
  meshForget: (a: { id: string }) => call("beyond", "mesh_forget", a),
  meshLeave: () => call("beyond", "mesh_leave"),
  privacyState: () => call("beyond", "privacy_state"),
  privacySet: (a: { on: boolean }) => call("beyond", "privacy_set", a),
}

export async function signIn(password: string) {
  const r = await call("session", "login", { username: "root", password, timeout: 3600 }).catch(() => null)
  if (!r || !r.ubus_rpc_session) return false
  setSession(r.ubus_rpc_session)
  return true
}
