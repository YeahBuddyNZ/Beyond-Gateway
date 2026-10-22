import { useRef, useState } from "react"
import { GlobeIcon, MonitorSmartphoneIcon, RouterIcon, SparklesIcon } from "lucide-react"
import { cn } from "cn"
import { beyond } from "@/api"
import { useEvery } from "@/hooks/use-every"
import * as lib from "@/lib.js"
import type { Device } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle, ItemActions } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/reui/badge"
import { DeviceIcon } from "@/components/device-icon"
import { PageTitle, Shell } from "./Shell"

type Status = { wan: { up: boolean; mode: string; uptime: number; counters: { rx: number; tx: number } }; time: number }

function Node({ icon: Icon, name, state, href, down }: { icon: typeof GlobeIcon; name: string; state: React.ReactNode; href?: string; down?: boolean }) {
  const Tag = href ? "a" : "div"
  return (
    <Tag href={href} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center sm:w-28">
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full bg-secondary ring-1 ring-lilac/40",
          down && "ring-destructive"
        )}
      >
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <span className="text-sm font-semibold">{name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{state}</span>
    </Tag>
  )
}

const Link = () => <span aria-hidden="true" className="mt-7 h-0.5 min-w-2 flex-1 rounded-full bg-linear-to-r from-lilac to-[#8ff3ff]" />

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-display text-xl font-semibold tabular-nums">{value ?? <Skeleton className="mt-1 h-6 w-16" />}</span>
      </CardContent>
    </Card>
  )
}

export function Home() {
  const [status, setStatus] = useState<Status | null>(null)
  const [rate, setRate] = useState<{ down: number; up: number } | null>(null)
  const [devices, setDevices] = useState<Device[] | null>(null)
  const prev = useRef<{ time: number; rx: number; tx: number } | null>(null)

  useEvery(2000, async () => {
    const s = (await beyond.status().catch(() => null)) as Status | null
    if (!s) return
    const cur = { time: s.time, rx: s.wan.counters.rx, tx: s.wan.counters.tx }
    setRate(prev.current ? lib.rateBetween(prev.current, cur) : null)
    prev.current = cur
    setStatus(s)
  })
  useEvery(10000, async () => {
    const r = await beyond.devices().catch(() => null)
    if (r) setDevices(r.devices)
  })

  const now = Date.now() / 1000
  const online = devices?.filter((d) => d.online).length
  const fresh = devices?.filter((d) => lib.isNew(d, now)) ?? []

  return (
    <Shell tab="home">
      <PageTitle title="Your home" />

      <Card className="dark bg-[radial-gradient(circle_at_85%_0%,rgb(158_123_255/0.35),transparent_45%),linear-gradient(135deg,var(--color-void),var(--color-chrome))] text-foreground ring-0">
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-start">
            <Node
              icon={GlobeIcon}
              name="Internet"
              down={status ? !status.wan.up : false}
              state={status ? (status.wan.up ? "Connected" : "Not connected") : "Checking"}
            />
            <Link />
            <Node icon={RouterIcon} name="Beyond Gateway" state="Running" />
            <Link />
            <Node icon={MonitorSmartphoneIcon} name="Devices" href="#devices" state={online == null ? "..." : online + " online"} />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Down now</span>
              <span className="font-display text-2xl font-semibold tabular-nums">{rate ? lib.formatRate(rate.down) : "..."}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Up now</span>
              <span className="font-display text-2xl font-semibold tabular-nums">{rate ? lib.formatRate(rate.up) : "..."}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Online now" value={online} />
        <Tile label="Paused" value={devices?.filter((d) => d.paused).length} />
        <Tile label="Internet up for" value={status && (status.wan.up ? lib.formatDuration(status.wan.uptime) : "Not connected")} />
        <Tile label="Connected by" value={status && <span className="text-base">{lib.wanWords(status.wan.mode)}</span>} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Just joined</CardTitle>
        </CardHeader>
        <CardContent>
          {devices == null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ) : fresh.length ? (
            <ItemGroup>
              {fresh.map((d) => (
                <Item key={d.mac} size="sm" render={<a href="#devices" />}>
                  <ItemMedia variant="icon">
                    <DeviceIcon kind={lib.kindOf(d)} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{lib.deviceName(d)}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant="primary-light">{lib.formatDuration(now - (d.first_seen ?? now))} ago</Badge>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SparklesIcon />
                </EmptyMedia>
                <EmptyTitle>Nothing new today</EmptyTitle>
                <EmptyDescription>When a new phone, tablet or gadget joins, it shows here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </Shell>
  )
}
