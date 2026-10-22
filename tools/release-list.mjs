// Writes latest.txt, the list every Beyond Gateway reads to see whether there's a new version
// (files/usr/libexec/beyond/update). CI signs it afterwards with tools/update-key.mjs.
//
//   node tools/release-list.mjs <dir> <build> <version> <notes>
//
// <dir> holds one beyond-gateway-<router>-sysupgrade.* per router. Each becomes a line "<router>=<file> <sha256> <bytes>".
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const [dir, build, version, notes = ""] = process.argv.slice(2)
if (!dir || !/^\d+$/.test(build || "") || !version) {
  console.error("Usage: node tools/release-list.mjs <dir> <build> <version> <notes>")
  process.exit(1)
}
const nz = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", day: "2-digit", month: "2-digit", year: "numeric" })
const lines = [`build=${build}`, `version=${version}`, `date=${nz.format(new Date())}`, `notes=${notes.replace(/[\r\n]+/g, " ").trim()}`]
const files = readdirSync(dir).filter((f) => /^beyond-gateway-[a-z0-9_-]+-sysupgrade\.[a-z]+$/.test(f)).sort()
if (!files.length) {
  console.error("No beyond-gateway-<router>-sysupgrade files in " + dir)
  process.exit(1)
}
for (const f of files) {
  const data = readFileSync(join(dir, f))
  const router = f.replace(/^beyond-gateway-/, "").replace(/-sysupgrade\.[a-z]+$/, "")
  lines.push(`${router}=${f} ${createHash("sha256").update(data).digest("hex")} ${data.length}`)
}
writeFileSync(join(dir, "latest.txt"), lines.join("\n") + "\n")
console.log(lines.join("\n"))
