import { useEffect, useState } from "react"
import { toast } from "sonner"
import { beyond, signOut } from "@/api"
import * as lib from "@/lib.js"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PageTitle, Shell } from "./Shell"
import { Updates } from "./Updates"
import { HelpLink } from "@/components/help-link"

function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Settings() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [s, setS] = useState<any>(null)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    beyond
      .status()
      .catch(() => ({ wan: {} }))
      .then(setS)
  }, [])

  const loading = <Skeleton className="h-16 w-full" />

  return (
    <Shell tab="settings">
      <PageTitle title="Settings" />

      <Updates />

      <Card>
        <CardHeader>
          <CardTitle>Internet</CardTitle>
          <CardDescription>Find it again after changing ISP, or if the fibre box was swapped.</CardDescription>
        </CardHeader>
        <CardContent>
          {s ? (
            <Facts
              rows={[
                ["Connected by", lib.wanWords(s.wan.mode)],
                ["Address", s.wan.ipv4 || "None yet"],
                ["IPv6", s.wan.ipv6 ? "Yes" : "No"],
              ]}
            />
          ) : (
            loading
          )}
        </CardContent>
        <CardFooter className="border-t py-3">
          <Button
            variant="outline"
            size="lg"
            onClick={async () => {
              await beyond.findInternet().catch(() => null)
              toast("Looking for the internet again. It takes about a minute.")
            }}
          >
            Find the internet again
          </Button>
          <HelpLink id="no-internet" className="ml-auto">
            Internet not working?
          </HelpLink>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This router</CardTitle>
        </CardHeader>
        <CardContent>
          {s ? (
            <Facts
              rows={[
                ["Model", s.model || "Unknown"],
                ["Running for", lib.formatDuration(s.uptime)],
                ["OpenWrt", s.release || "Unknown"],
              ]}
            />
          ) : (
            loading
          )}
        </CardContent>
        <CardFooter className="gap-2 border-t py-3">
          <Button variant="outline" size="lg" onClick={() => setRestarting(true)}>
            Restart
          </Button>
          <Button variant="ghost" size="lg" onClick={signOut}>
            Sign out
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The way back</CardTitle>
          <CardDescription>
            Want your old router back? Unplug the cable from Beyond’s WAN port and plug it into your old router instead.
            That’s all: nothing about your internet plan changed.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-2 border-t py-3">
          <span className="text-xs text-muted-foreground">For people who know networks: OpenWrt’s own screens are still here.</span>
          <div className="flex w-full flex-wrap items-center gap-2">
            <a href="/cgi-bin/luci/" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Advanced settings
            </a>
            <HelpLink id="way-back" className="ml-auto">
              More about going back
            </HelpLink>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={restarting} onOpenChange={setRestarting}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Restart the router?</DialogTitle>
            <DialogDescription>The internet drops for about a minute, for everyone in the house.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Not now</DialogClose>
            <Button
              onClick={async () => {
                setRestarting(false)
                await beyond.reboot().catch(() => null)
                toast("Restarting. Back in about a minute.")
              }}
            >
              Restart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  )
}
