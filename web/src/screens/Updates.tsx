import { useEffect, useState } from "react"
import { DownloadIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { beyond } from "@/api"
import * as lib from "@/lib.js"
import type { UpdateState } from "@/lib.js"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/reui/badge"
import { HelpLink } from "@/components/help-link"

const TONE = { muted: "outline", primary: "primary-light", warning: "warning-light", success: "success-light" } as const

/** The Updates card: what's installed, whether there's a new version, and the overnight switch. */
export function Updates() {
  const [u, setU] = useState<UpdateState | null>(null)
  const [checking, setChecking] = useState(false)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    beyond
      .updateState()
      .catch(() => ({ enabled: false }))
      .then(setU)
  }, [])

  const words = lib.updateWords(u)
  const now = Math.floor(Date.now() / 1000)

  const check = async () => {
    setChecking(true)
    const next = await beyond.updateCheck().catch(() => null)
    setChecking(false)
    if (next) setU(next)
    else toast("Couldn’t reach the router just now.")
  }

  const install = async () => {
    setAsking(false)
    const r = await beyond.updateInstall().catch(() => ({ ok: false, error: "Couldn’t reach the router just now." }))
    if (!r.ok) return toast(r.error || "It didn’t start. Try again.")
    setU((x) => (x ? { ...x, status: "installing" } : x))
    toast("Installing. The internet is off for about three minutes, then it’s back by itself.")
  }

  const setAuto = async (on: boolean) => {
    setU((x) => (x ? { ...x, auto: on } : x))
    const r = await beyond.updateAuto({ on }).catch(() => ({ ok: false }))
    if (!r.ok) {
      setU((x) => (x ? { ...x, auto: !on } : x))
      toast("That didn’t save. Try again.")
    } else toast(on ? "New versions will install overnight." : "New versions will wait for you.")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Updates</CardTitle>
        <CardDescription>{u ? `Version ${u.version || "unknown"}. Checked ${lib.agoWords(u.checked, now)}.` : " "}</CardDescription>
        {u && (
          <CardAction>
            <Badge variant={TONE[words.tone]} radius="full">
              {words.badge}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {u ? (
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{words.title}</p>
            <p className="text-sm text-muted-foreground">{words.detail}</p>
          </div>
        ) : (
          <Skeleton className="h-12 w-full" />
        )}
        {u?.enabled && (
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="auto-updates">Install updates by themselves</FieldLabel>
              <FieldDescription>Overnight, while everyone’s asleep. Your settings always stay.</FieldDescription>
            </FieldContent>
            <Switch id="auto-updates" checked={!!u.auto} onCheckedChange={setAuto} />
          </Field>
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-2 border-t py-3">
        {u?.status === "available" ? (
          <Button size="lg" onClick={() => setAsking(true)}>
            <DownloadIcon aria-hidden="true" />
            Install now
          </Button>
        ) : u?.enabled && u.status !== "installing" ? (
          <Button variant="outline" size="lg" disabled={checking} onClick={check}>
            {checking ? <Spinner /> : <RefreshCwIcon aria-hidden="true" />}
            {checking ? "Checking" : "Check now"}
          </Button>
        ) : null}
        <HelpLink id="updates" className="ml-auto">
          About updates
        </HelpLink>
      </CardFooter>

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Install {u?.available?.version ?? "the update"} now?</DialogTitle>
            <DialogDescription>
              The internet is off for about three minutes, for everyone in the house, then the router is back by itself. Your Wi-Fi, passwords and devices all stay as they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Not now</DialogClose>
            <Button onClick={install}>Install</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
