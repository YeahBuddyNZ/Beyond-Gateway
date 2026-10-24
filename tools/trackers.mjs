// Builds the "Block Big Tech trackers" lists from blocklists/big-tech-trackers/block.txt and allow.txt:
//
//   files/usr/share/beyond/big-tech-trackers.conf        the router's own, a dnsmasq servers-file (apply-trackers turns it on)
//   blocklists/big-tech-trackers/adguard.txt       for AdGuard Home (Beyond Shield, Beyond Hub) and Pi-hole
//   blocklists/big-tech-trackers/hosts.txt         a plain hosts file, for anything else
//
//   node tools/trackers.mjs            write them
//   node tools/trackers.mjs --check    fail if they're out of date (tests/trackers.test.mjs does this too)
//
// A domain blocks itself and every name under it, and the longest match wins, so an allowed name under a blocked
// domain (pubads.g.doubleclick.net) is an exception, and a blocked name under an allowed one (region1.analytics.google.com)
// is blocked on purpose.
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ROOT = new URL("../", import.meta.url)
const DIR = "blocklists/big-tech-trackers/"
const NAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/** The domains in a list file, in order. Throws on anything that isn't a domain, or a domain listed twice. */
export function parse(text, label = "list") {
  const out = []
  text.split("\n").forEach((line, i) => {
    const d = line.replace(/#.*/, "").trim().toLowerCase()
    if (!d) return
    if (!NAME.test(d)) throw new Error(`${label} line ${i + 1}: "${d}" is not a domain`)
    if (out.includes(d)) throw new Error(`${label} line ${i + 1}: ${d} is listed twice`)
    out.push(d)
  })
  return out
}

/** The rule a name falls under: the longest listed domain that is the name or a parent of it. */
export function verdict(name, block, allow) {
  const labels = name.toLowerCase().split(".")
  for (let i = 0; i < labels.length - 1; i++) {
    const d = labels.slice(i).join(".")
    if (allow.includes(d)) return { blocked: false, by: d }
    if (block.includes(d)) return { blocked: true, by: d }
  }
  return { blocked: false, by: null }
}

/** Allowed names that sit under a blocked domain: these need an exception, or the block would take them too. */
export function exceptions(block, allow) {
  return allow.filter((d) => {
    const parent = verdict(d.split(".").slice(1).join("."), block, allow)
    return parent.blocked
  })
}

/** Blocked names inside an allowed domain (iadsdk.apple.com inside apple.com). Each must be on purpose. */
export function inside(block, allow) {
  return block.filter((d) => {
    const parent = verdict(d.split(".").slice(1).join("."), block, allow)
    return parent.by != null && !parent.blocked
  })
}

/** Every problem with the two lists, as sentences. Empty when it's safe. */
export function problems(block, allow) {
  return block.filter((d) => allow.includes(d)).map((d) => `${d} is in both lists`)
}

const HEAD = (comment) =>
  [
    `${comment} Block Big Tech trackers, made by tools/trackers.mjs from ${DIR}block.txt and allow.txt. Edit those, not this.`,
    `${comment} Advertising, tracking and telemetry from the companies on gobeyond.nz/tech-fines, never what their products need.`,
  ].join("\n")

/** The three files, by path. */
export function build(block, allow) {
  const keep = exceptions(block, allow)
  const sorted = [...block].sort()
  return {
    "files/usr/share/beyond/big-tech-trackers.conf": [
      HEAD("#"),
      "# dnsmasq servers-file: server=/name/ answers \"no such name\" for it and everything under it; server=/name/# sends it on as usual.",
      ...sorted.map((d) => `server=/${d}/`),
      ...keep.sort().map((d) => `server=/${d}/#`),
      "",
    ].join("\n"),
    [`${DIR}adguard.txt`]: [
      HEAD("!"),
      ...sorted.map((d) => `||${d}^`),
      ...keep.sort().map((d) => `@@||${d}^`),
      "",
    ].join("\n"),
    [`${DIR}hosts.txt`]: [
      HEAD("#"),
      "# A hosts file only blocks the exact names listed; the other two lists also block every name under them.",
      ...sorted.map((d) => `0.0.0.0 ${d}`),
      "",
    ].join("\n"),
  }
}

export function load() {
  const read = (f) => readFileSync(new URL(DIR + f, ROOT), "utf8")
  return { block: parse(read("block.txt"), "block.txt"), allow: parse(read("allow.txt"), "allow.txt") }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { block, allow } = load()
  const bad = problems(block, allow)
  if (bad.length) {
    console.error("Not safe to build:\n" + bad.map((p) => "  " + p).join("\n"))
    process.exit(1)
  }
  const check = process.argv.includes("--check")
  let stale = 0
  for (const [path, text] of Object.entries(build(block, allow))) {
    const url = new URL(path, ROOT)
    let now = null
    try { now = readFileSync(url, "utf8") } catch { now = null }
    if (now === text) continue
    if (check) { console.error(`${path} is out of date: run node tools/trackers.mjs`); stale++ }
    else { writeFileSync(url, text); console.log(`wrote ${path}`) }
  }
  if (stale) process.exit(1)
  console.log(`${block.length} blocked, ${exceptions(block, allow).length} exceptions, ${allow.length} checked to keep working`)
}
