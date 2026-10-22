// Beyond Gateway's update key: makes it once, and signs each release with it.
// The format is usign's (OpenWrt's own signing tool, the same as OpenBSD's signify), so the router checks a release
// with the usign it already has. Plain Node, no packages.
//
//   node tools/update-key.mjs new                 make a key: prints the secret to paste into GitHub, once
//   node tools/update-key.mjs public  > key.pub   the public key, which goes into the image (needs GATEWAY_UPDATE_KEY)
//   node tools/update-key.mjs sign FILE           writes FILE.sig (needs GATEWAY_UPDATE_KEY)
//
// GATEWAY_UPDATE_KEY is the key's 32-byte seed in base64. It lives only in the repo's Actions secrets.

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"

// Ed25519 keys in DER, with the 32 raw bytes on the end.
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex")

function fromSeed(seedB64) {
  const seed = Buffer.from(seedB64.trim(), "base64")
  if (seed.length !== 32) throw new Error("GATEWAY_UPDATE_KEY is not a 32-byte key in base64.")
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: "der", type: "pkcs8" })
  const pub = createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32)
  // usign's key number: any 8 bytes, the same on the key and every signature. Taken from the public key so it never changes.
  const keynum = createHash("sha512").update(pub).digest().subarray(0, 8)
  return { priv, pub, keynum }
}

/** usign's public key file. */
export function publicKeyFile(seedB64) {
  const { pub, keynum } = fromSeed(seedB64)
  const body = Buffer.concat([Buffer.from("Ed"), keynum, pub]).toString("base64")
  return `untrusted comment: Beyond Gateway updates ${keynum.toString("hex")}\n${body}\n`
}

/** usign's signature file for these bytes. */
export function signatureFile(seedB64, data) {
  const { priv, keynum } = fromSeed(seedB64)
  const sig = sign(null, data, priv)
  const body = Buffer.concat([Buffer.from("Ed"), keynum, sig]).toString("base64")
  return `untrusted comment: signed by Beyond Gateway updates ${keynum.toString("hex")}\n${body}\n`
}

function key() {
  const k = process.env.GATEWAY_UPDATE_KEY
  if (!k) {
    console.error("GATEWAY_UPDATE_KEY is not set.")
    process.exit(1)
  }
  return k
}

const [cmd, file] = process.argv.slice(2)
if (import.meta.url === `file://${process.argv[1]}`) {
  if (cmd === "new") {
    const { privateKey } = generateKeyPairSync("ed25519")
    const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32).toString("base64")
    console.log("Your Beyond Gateway update key. Keep it secret: anyone with it can send updates to every router.\n")
    console.log(seed)
    console.log("\nIn GitHub: Beyond-Gateway > Settings > Secrets and variables > Actions > New repository secret.")
    console.log("Name it GATEWAY_UPDATE_KEY, paste the line above, and save. Then close this window.")
  } else if (cmd === "public") {
    process.stdout.write(publicKeyFile(key()))
  } else if (cmd === "sign" && file) {
    writeFileSync(`${file}.sig`, signatureFile(key(), readFileSync(file)))
  } else {
    console.error("Use: node tools/update-key.mjs new | public | sign FILE")
    process.exit(1)
  }
}
