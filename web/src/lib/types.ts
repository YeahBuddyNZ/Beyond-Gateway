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
  /** The mesh point it's on, when it isn't on the main router. */
  point?: string
}

export type MeshPoint = { id: string; name: string; model: string; joined: number; seen: number; online: boolean; ip: string | null; clients: number }
export type MeshState =
  | { role: "" | "main"; points: MeshPoint[]; max: number }
  | { role: "point"; name: string; main: string | null; checked: number; message: string | null }
