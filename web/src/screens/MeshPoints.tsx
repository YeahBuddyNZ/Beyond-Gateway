import { useState } from "react"
import { RouterIcon } from "lucide-react"
import { toast } from "sonner"
import { beyond } from "@/api"
import { useEvery } from "@/hooks/use-every"
import * as lib from "@/lib.js"
import type { MeshPoint, MeshState } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Badge } from "@/components/reui/badge"
import { HelpLink } from "@/components/help-link"

const TONE = { success: "success-light", warning: "warning-light" } as const

/** Settings on the main router: the other Beyond routers putting out the same Wi-Fi around the house. */
export function MeshPoints() {
  const [m, setM] = useState<Extract<MeshState, { role: "" | "main" }> | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<MeshPoint | null>(null)

  const load = async () => {
    const r = (await beyond.meshState().catch(() => null)) as MeshState | null
    if (r && r.role !== "point") setM(r)
  }
  useEvery(15000, load)

  const now = Math.floor(Date.now() / 1000)
  const points = m?.points ?? []
  const full = !!m && points.length >= m.max

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mesh points</CardTitle>
        <CardDescription>More Beyond routers around the house, all putting out this Wi-Fi. Phones move to the nearest one by themselves.</CardDescription>
        {points.length > 0 && (
          <CardAction>
            <Badge variant="primary-light" radius="full">
              {points.length + 1} routers
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      {points.length > 0 && (
        <CardContent>
          <ItemGroup>
            {points.map((p, i) => {
              const w = lib.meshPointWords(p, now)
              return (
                <div key={p.id} className="contents">
                  {i > 0 && <ItemSeparator />}
                  <Item size="sm" className="px-1">
                    <ItemMedia variant="icon">
                      <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
                        <RouterIcon className="size-5" aria-hidden="true" />
                      </span>
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="truncate">{p.name}</ItemTitle>
                      <ItemDescription>
                        {w.detail}
                        {p.model ? " · " + p.model : ""}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="gap-2">
                      <Badge variant={TONE[w.tone]}>{w.badge}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                        Change
                      </Button>
                    </ItemActions>
                  </Item>
                </div>
              )
            })}
          </ItemGroup>
        </CardContent>
      )}
      <CardFooter className="flex-wrap gap-2 border-t py-3">
        <Button size="lg" variant={points.length ? "outline" : "default"} onClick={() => setAdding(true)} disabled={!m || full}>
          Add a mesh point
        </Button>
        {full && <span className="text-sm text-muted-foreground">That’s the most for one network.</span>}
        <HelpLink id="mesh" className="ml-auto">
          How mesh works
        </HelpLink>
      </CardFooter>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a mesh point</DialogTitle>
            <DialogDescription>Any router running Beyond Gateway works, whatever the make.</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Put Beyond Gateway on the other router, the same way as this one, and turn it on <strong>without setting it up</strong>.
            </li>
            <li>
              Run a cable from its <strong>WAN</strong> port to one of this router’s ports (through the wall sockets is fine).
            </li>
            <li>
              Join its <strong>Beyond Setup</strong> Wi-Fi, open <strong>beyond.lan</strong> and choose <strong>Add to my Beyond network</strong>.
            </li>
            <li>Type this router’s password there. A minute later it shows up here, putting out your Wi-Fi.</li>
          </ol>
          <DialogFooter>
            <DialogClose render={<Button />}>Got it</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && <EditPoint point={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </Card>
  )
}

function EditPoint({ point: p, onClose, onSaved }: { point: MeshPoint; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(p.name)
  const [busy, setBusy] = useState(false)
  const [forgetting, setForgetting] = useState(false)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {forgetting ? (
          <>
            <DialogHeader>
              <DialogTitle>Take {p.name} off the mesh?</DialogTitle>
              <DialogDescription>
                It stops getting changes from this router. It keeps putting out the Wi-Fi it has until you reset it (hold its reset button for 10 seconds).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setForgetting(false)}>
                Not now
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const r = await beyond.meshForget({ id: p.id }).catch(() => ({ ok: false }))
                  setBusy(false)
                  if (!r.ok) return toast.error("That didn’t go through. Try again.")
                  toast(p.name + " is off the mesh.")
                  onClose()
                  onSaved()
                }}
              >
                Take it off
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              const r = await beyond.meshRename({ id: p.id, name: name.trim() }).catch(() => ({ ok: false, error: "" }))
              setBusy(false)
              if (!r.ok) return toast.error(r.error || "That didn’t save.")
              onClose()
              onSaved()
            }}
          >
            <DialogHeader>
              <DialogTitle>{p.name}</DialogTitle>
              <DialogDescription>Name it after where it is, so the device list makes sense.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="point-name">Name</FieldLabel>
                <Input id="point-name" value={name} maxLength={30} placeholder="Upstairs" onChange={(e) => setName(e.target.value)} />
              </Field>
            </FieldGroup>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Model</dt>
              <dd>{p.model || "Unknown"}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="tabular-nums">{p.ip || "Not right now"}</dd>
            </dl>
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setForgetting(true)}>
                Take it off the mesh
              </Button>
              <div className="flex gap-2">
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit" disabled={busy || !name.trim()}>
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
