import { useEffect, useState } from "react"
import { toast } from "sonner"
import { beyond } from "@/api"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/reui/badge"
import { HelpLink } from "@/components/help-link"

type FamilyState = { linked: boolean; code: string | null; until: number | null; checked: number; message: string | null }

/** Settings: link the router to Beyond Family, so a grown-up can see it from anywhere. Look only. */
export function FamilyLink() {
  const [f, setF] = useState<FamilyState | null>(null)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    beyond
      .familyState()
      .catch(() => null)
      .then((r) => r && setF(r as FamilyState))
  }, [])

  // While a code is up, look every few seconds so the card turns to "Linked" soon after it's typed in.
  const waiting = !!f?.code && !f.linked
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
      beyond
        .familyState()
        .then((r) => {
          const next = r as FamilyState
          if (next.linked) toast("Linked to Beyond Family.")
          setF(next)
        })
        .catch(() => null)
    }, 4000)
    return () => clearInterval(t)
  }, [waiting])

  const link = async () => {
    setBusy(true)
    const r = await beyond.familyLink().catch(() => null)
    setBusy(false)
    setNow(Math.floor(Date.now() / 1000))
    if (!r) return toast("Couldn’t reach the router just now.")
    setF(r as FamilyState)
  }

  const unlink = async () => {
    setAsking(false)
    setBusy(true)
    const r = await beyond.familyUnlink().catch(() => null)
    setBusy(false)
    if (!r) return toast("Couldn’t reach the router just now.")
    setF(r as FamilyState)
    toast("Unlinked. Beyond Family can no longer see this router.")
  }

  const minutes = f?.until ? Math.max(0, Math.ceil((f.until - now) / 60)) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beyond Family</CardTitle>
        <CardDescription>See from anywhere whether the internet’s working at home, and who’s online, in the Beyond Family app.</CardDescription>
        {f?.linked && (
          <CardAction>
            <Badge variant="success-light" radius="full">
              Linked
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {f?.linked ? (
          <p>
            A grown-up in your household can see this router in Beyond Family, under <strong>Family</strong> then <strong>Home network</strong>. It’s
            look only: nothing there can change your router.
          </p>
        ) : f?.code ? (
          <div className="space-y-2">
            <p>
              In Beyond Family, open <strong>Family</strong> then <strong>Home network</strong>, and type this code:
            </p>
            <p className="font-mono text-3xl font-semibold tracking-[0.3em]" aria-label={`Code ${f.code.split("").join(" ")}`}>
              {f.code}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Spinner /> Waiting for it. The code works for {minutes} more minute{minutes === 1 ? "" : "s"}.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Once linked, the router tells Beyond Family each minute whether the internet is up, how fast it’s going, and the names you gave your
            devices with whether each is online. Never their addresses, your Wi-Fi password or what anyone does online.
          </p>
        )}
        {f?.message && !f.linked && <p className="text-destructive">{f.message}</p>}
      </CardContent>
      <CardFooter className="flex-wrap gap-2 border-t py-3">
        {f?.linked ? (
          <Button variant="outline" size="lg" onClick={() => setAsking(true)} disabled={busy}>
            Unlink
          </Button>
        ) : (
          <Button size="lg" onClick={link} disabled={busy || !f}>
            {busy && <Spinner />} {f?.code ? "New code" : "Connect to Beyond Family"}
          </Button>
        )}
        {f?.code && !f.linked && (
          <Button variant="ghost" size="lg" onClick={unlink} disabled={busy}>
            Cancel
          </Button>
        )}
        <HelpLink id="family" className="ml-auto">
          How this works
        </HelpLink>
      </CardFooter>

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Unlink from Beyond Family?</DialogTitle>
            <DialogDescription>The router stops telling Beyond Family how it’s going. You can link it again any time with a new code.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Not now</DialogClose>
            <Button onClick={unlink}>Unlink</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
