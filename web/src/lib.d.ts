// Types for lib.js, which stays plain JavaScript so node --test can run it with no build (tests/web.test.mjs).
type D = { name?: string; hostname?: string; wifi?: boolean; kind?: string | null; first_seen?: number; online?: boolean; paused?: boolean }
export function wanWords(mode: string | undefined): string
export function formatRate(bytesPerSec: number): string
export function formatDuration(sec: number | undefined): string
export function rateBetween(prev: { time: number; rx: number; tx: number } | null, cur: { time: number; rx: number; tx: number } | null): { down: number; up: number }
export function guessKind(hostname: string | null | undefined): string
export function kindOf(d: D): string
export function deviceName(d: D): string
export function signalBars(dbm: number | undefined): number
export function isNew(d: D, now: number): boolean
export function sortDevices<T extends D>(list: T[]): T[]
export function checkWifi(ssid: string, key: string): string | null
export function agoWords(then: number | undefined, now: number): string
export type UpdateState = { version?: string; build?: number; enabled?: boolean; auto?: boolean; status?: string; checked?: number; message?: string; available?: { version?: string; date?: string; notes?: string } | null }
export function updateWords(u: UpdateState | null): { tone: "muted" | "primary" | "warning" | "success"; badge: string; title: string; detail: string }
