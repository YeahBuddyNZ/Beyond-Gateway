// Block Big Tech trackers must never stop anything Beyond's products, or a family's devices, need to work.
import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { build, exceptions, inside, load, parse, problems, verdict } from "../tools/trackers.mjs"

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8")
const { block, allow } = load()

test("nothing in the block list stops anything in the allow list", () => {
  assert.ok(block.length >= 30 && allow.length >= 80, "found both lists")
  assert.deepEqual(problems(block, allow), [])
  for (const d of allow) assert.equal(verdict(d, block, allow).blocked, false, d)
})

// A block inside an allowed domain is the one way this list could break something Beyond needs: it's allowed only for
// these, each checked by hand to be tracking and nothing else. Adding one means adding it here, on purpose.
const ON_PURPOSE = [
  "region1.analytics.google.com", // inside analytics.google.com, the dashboard stays
  "iadsdk.apple.com",
  "api-adservices.apple.com",
  "books-analytics-events.apple.com",
  "notes-analytics-events.apple.com",
  "weather-analytics-events.apple.com",
  "pixel.facebook.com",
  "an.facebook.com",
]

test("every block inside an allowed domain is on purpose", () => {
  assert.deepEqual(inside(block, allow).sort(), [...ON_PURPOSE].sort())
})

test("the checks catch a block that would break something", () => {
  // The socials hub posts through graph.facebook.com: blocking it trips both checks.
  assert.match(problems([...block, "graph.facebook.com"], allow).join(), /graph\.facebook\.com is in both lists/)
  assert.ok(inside([...block, "graph.facebook.com"], allow).includes("graph.facebook.com"))
  // Something new inside an allowed domain, here an Apple name nobody has checked, shows up so it cannot slip in.
  assert.ok(inside([...block, "xp.apple.com"], allow).includes("xp.apple.com"))
  // A whole company blocked would take an allowed name with it unless it's an exception.
  assert.equal(verdict("www.youtube.com", ["youtube.com"], []).blocked, true)
  assert.equal(verdict("www.youtube.com", ["youtube.com"], ["www.youtube.com"]).blocked, false)
})

test("a domain blocks everything under it, and the longest match wins", () => {
  assert.equal(verdict("stats.g.doubleclick.net", block, allow).blocked, true)
  assert.equal(verdict("pubads.g.doubleclick.net", block, allow).blocked, false)
  assert.equal(verdict("region1.analytics.google.com", block, allow).blocked, true)
  assert.equal(verdict("analytics.google.com", block, allow).blocked, false)
  assert.equal(verdict("example.com", block, allow).blocked, false)
  assert.deepEqual(exceptions(["doubleclick.net"], ["pubads.g.doubleclick.net", "apple.com"]), ["pubads.g.doubleclick.net"])
})

test("the lists are only domains, each once", () => {
  assert.throws(() => parse("doubleclick.net\ndoubleclick.net\n"), /twice/)
  assert.throws(() => parse("https://doubleclick.net/\n"), /not a domain/)
  assert.throws(() => parse("bad domain.com\n"), /not a domain/)
  assert.deepEqual(parse("# a note\nDoubleClick.net   # ads\n\n"), ["doubleclick.net"])
})

test("every company on the tech fines tracker has something blocked", async () => {
  const text = await read("blocklists/big-tech-trackers/block.txt")
  for (const c of ["Alphabet", "Apple", "Meta", "Amazon", "Microsoft", "ByteDance", "X"]) assert.match(text, new RegExp(`^# ${c}\\b`, "m"), c)
})

test("the built lists are up to date", async () => {
  for (const [path, text] of Object.entries(build(block, allow))) assert.equal(await read(path), text, `${path}: run node tools/trackers.mjs`)
})

test("the router's list is a dnsmasq servers-file and nothing else", async () => {
  const conf = await read("files/usr/share/beyond/big-tech-trackers.conf")
  for (const line of conf.split("\n")) {
    if (!line || line.startsWith("#")) continue
    assert.match(line, /^server=\/[a-z0-9.-]+\/#?$/, line)
  }
  assert.match(conf, /^server=\/pubads\.g\.doubleclick\.net\/#$/m)
  assert.match(conf, /^server=\/doubleclick\.net\/$/m)
})

test("the switch is off by default, and the app can reach it", async () => {
  assert.match(await read("files/etc/config/beyond"), /config privacy 'privacy'\n\toption block_trackers '0'/)
  assert.match(await read("files/etc/init.d/beyond"), /\/usr\/libexec\/beyond\/apply-trackers/)
  const uc = await read("files/usr/share/rpcd/ucode/beyond.uc")
  assert.match(uc, /const TRACKERS = '\/usr\/share\/beyond\/big-tech-trackers\.conf';/)
  assert.match(await read("files/usr/libexec/beyond/apply-trackers"), /\/usr\/share\/beyond\/big-tech-trackers\.conf/)
})
