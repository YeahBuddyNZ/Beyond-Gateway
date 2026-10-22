import { useState } from "react"
import { RouterIcon } from "lucide-react"
import { toast } from "sonner"
import { beyond, signOut } from "@/api"
import { useEvery } from "@/hooks/use-every"
import * as lib from "@/lib.js"
import type { MeshState } from "@/lib/types"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Centred, Heading } from "./Centred"
import { HelpLink } from "@/components/help-link"

type Point = Extract<MeshState, { role: "point" }>

/** Signed in on a mesh point. Everything is looked after on the main router, so this only says how it's going. */
export function PointHome() {
  const [p, setP] = useState<Point | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEvery(15000, async () => {
    const r = (await beyond.meshState().catch(() => null)) as MeshState | null
    if (r?.role === "point") setP(r)
  })

  const now = Math.floor(Date.now() / 1000)
  if (!p)
    return (
      <Centred>
        <Skeleton className="h-24 w-full" />
      </Centred>
    )

  return (
    <Centred>
      <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <RouterIcon className="size-6" aria-hidden="true" />
      </span>
      <Heading
        title={p.name}
        lead="This router is a mesh point. It puts out your home Wi-Fi from here, and your main Beyond router looks after everything else."
      />
      {p.message ? (
        <Alert variant="warning">
          <AlertTitle>Not heard from the main router</AlertTitle>
          <AlertDescription>{p.message}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="success">
          <AlertTitle>Working</AlertTitle>
          <AlertDescription>Last checked with the main router {lib.agoWords(p.checked, now)}.</AlertDescription>
        </Alert>
      )}
      {p.main && (
        <a href={`http://${p.main}/beyond/`} className={buttonVariants({ size: "lg" })}>
          Open the main router
        </a>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setLeaving(true)}>
          Take it off the mesh
        </Button>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
        <HelpLink id="mesh" className="ml-auto">
          How mesh works
        </HelpLink>
      </div>

      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reset this router?</DialogTitle>
            <DialogDescription>
              It stops putting out your Wi-Fi and starts again as a new Beyond router, with the Beyond Setup Wi-Fi. Then take it off the list on the main
              router too.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Not now</DialogClose>
            <Button
              onClick={async () => {
                setLeaving(false)
                const r = await beyond.meshLeave().catch(() => ({ ok: false }))
                if (!r.ok) return toast.error("That didn’t go through. Try again.")
                toast("Resetting. It’s back as a new router in about two minutes.")
              }}
            >
              Reset it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Centred>
  )
}
