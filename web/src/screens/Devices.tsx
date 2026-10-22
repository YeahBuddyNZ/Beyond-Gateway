import { useState } from "react"
import { MonitorSmartphoneIcon, PauseIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { beyond } from "@/api"
import { useEvery } from "@/hooks/use-every"
import * as lib from "@/lib.js"
import type { Device } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/reui/badge"
import { DeviceIcon, KINDS } from "@/components/device-icon"
import { PageTitle, Shell } from "./Shell"
import { HelpLink } from "@/components/help-link"

const FILTERS = ["All", "Online", "Paused"] as const
type Filter = (typeof FILTERS)[number]

function Bars({ n }: { n: number }) {
  return (
    <span className="inline-flex h-4 items-end gap-0.5" title={n ? n + " of 4 bars" : "No signal reading"}>
      {[1, 2, 3, 4].map((i) => (
        <i key={i} className={cn("w-1 rounded-full bg-muted", i <= n && "bg-primary")} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  )
}

export function Devices() {
  const [list, setList] = useState<Device[] | null>(null)
  const [filter, setFilter] = useState<Filter>("All")
  const [editing, setEditing] = useState<Device | null>(null)

  const load = async () => {
    const r = await beyond.devices().catch(() => null)
    if (r) setList(r.devices)
  }
  useEvery(8000, load)

  const setPaused = async (d: Device, paused: boolean) => {
    setList((l) => l && l.map((x) => (x.mac === d.mac ? { ...x, paused } : x)))
    const r = await beyond.pause({ mac: d.mac, paused }).catch(() => ({ ok: false, error: "" }))
    if (!r.ok) {
      setList((l) => l && l.map((x) => (x.mac === d.mac ? { ...x, paused: !paused } : x)))
      toast.error("That didn’t go through. Try again.")
    } else toast.success(paused ? lib.deviceName(d) + " is paused." : lib.deviceName(d) + " is back online.")
  }

  const now = Date.now() / 1000
  const shown = list && (lib.sortDevices(list) as Device[]).filter((d) => filter === "All" || (filter === "Online" ? d.online : d.paused))

  return (
    <Shell tab="devices">
      <PageTitle title="Devices" lead="Everything on your network. The switch pauses a device’s internet; it can still see the router." />
      <HelpLink id="pause">How pausing works</HelpLink>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList aria-label="Show">
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f} className="px-3">
              {f}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card size="sm">
        <CardContent>
          {shown == null ? (
            <div className="flex flex-col gap-3 py-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : shown.length ? (
            <ItemGroup>
              {shown.map((d, i) => (
                <div key={d.mac} className="contents">
                  {i > 0 && <ItemSeparator />}
                  <Item size="sm" className={cn("px-1", !d.online && "opacity-60")}>
                    <ItemMedia variant="icon">
                      <span className={cn("grid size-10 place-items-center rounded-full bg-muted", d.paused ? "text-muted-foreground" : "bg-accent text-accent-foreground")}>
                        <DeviceIcon kind={lib.kindOf(d)} className="size-5" />
                      </span>
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <button type="button" className="text-left outline-none focus-visible:underline" onClick={() => setEditing(d)}>
                        <ItemTitle className="truncate">{lib.deviceName(d)}</ItemTitle>
                      </button>
                      <ItemDescription className="flex flex-wrap items-center gap-1.5">
                        {lib.isNew(d, now) && <Badge variant="primary-light">New</Badge>}
                        {d.paused && <Badge variant="warning-light">Paused</Badge>}
                        <span>
                          {d.paused ? "No internet" : d.online ? lib.connectionWords(d) : "Away"}
                          {d.ip && d.online ? " · " + d.ip : ""}
                        </span>
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="gap-4">
                      {d.wifi && d.online && <Bars n={lib.signalBars(d.signal)} />}
                      <Switch
                        checked={!d.paused}
                        aria-label={(d.paused ? "Unpause " : "Pause ") + lib.deviceName(d)}
                        onCheckedChange={(on) => setPaused(d, !on)}
                      />
                    </ItemActions>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">{filter === "Paused" ? <PauseIcon /> : <MonitorSmartphoneIcon />}</EmptyMedia>
                <EmptyTitle>{filter === "Paused" ? "Nothing is paused" : "No devices yet"}</EmptyTitle>
                <EmptyDescription>
                  {filter === "Paused" ? "Flick a switch to pause a device’s internet." : "They show up here as soon as they join."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {editing && <EditDevice device={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </Shell>
  )
}

const KIND_ITEMS = KINDS.map(([value, label]) => ({ value, label }))

function EditDevice({ device: d, onClose, onSaved }: { device: Device; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(d.name || "")
  const [kind, setKind] = useState<string>(lib.kindOf(d))
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            const r = await beyond.rename({ mac: d.mac, name: name.trim(), kind }).catch(() => ({ ok: false, error: "" }))
            setBusy(false)
            if (!r.ok) return toast.error(r.error || "That didn’t save.")
            onClose()
            onSaved()
          }}
        >
          <DialogHeader>
            <DialogTitle>{lib.deviceName(d)}</DialogTitle>
            <DialogDescription>Only you see these names.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="device-name">Name</FieldLabel>
              <Input id="device-name" value={name} maxLength={40} placeholder={lib.deviceName(d)} onChange={(e) => setName(e.target.value)} />
              <FieldDescription>Like "Nikau’s iPad".</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>What it is</FieldLabel>
              <Select items={KIND_ITEMS} value={kind} onValueChange={(v) => v && setKind(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_ITEMS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Address</dt>
            <dd className="tabular-nums">{d.ip || "Not right now"}</dd>
            <dt className="text-muted-foreground">Hardware ID</dt>
            <dd className="font-mono">{d.mac}</dd>
            {d.hostname && (
              <>
                <dt className="text-muted-foreground">Calls itself</dt>
                <dd className="break-all">{d.hostname}</dd>
              </>
            )}
          </dl>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
