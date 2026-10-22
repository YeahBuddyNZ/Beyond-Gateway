export type Device = {
  mac: string
  ip?: string
  hostname?: string
  name?: string
  kind?: string | null
  online: boolean
  wifi: boolean
  signal?: number
  paused: boolean
  first_seen?: number
}
