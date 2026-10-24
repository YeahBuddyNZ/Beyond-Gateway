import { useEffect, useState } from "react"
import { ShieldAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { beyond } from "@/api"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import { HelpLink } from "@/components/help-link"

type Privacy = { on: boolean; blocked: number; other: boolean }

/** The Block Big Tech trackers card: one switch, off until a grown-up turns it on. */
export function Trackers() {
  const [p, setP] = useState<Privacy | null>(null)

  useEffect(() => {
    beyond
      .privacyState()
      .catch(() => ({ on: false, blocked: 0, other: false }))
      .then((r) => setP(r as Privacy))
  }, [])

  const set = async (on: boolean) => {
    setP((x) => (x ? { ...x, on } : x))
    const r = await beyond.privacySet({ on }).catch(() => ({ ok: false, error: "" }))
    if (!r.ok) {
      setP((x) => (x ? { ...x, on: !on } : x))
      toast(r.error || "That didn’t save. Try again.")
    } else {
      setP(r as Privacy)
      toast(on ? "Big Tech trackers are blocked for the whole house." : "Big Tech trackers are back to normal.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Block Big Tech trackers</CardTitle>
        <CardDescription>
          The companies on Beyond’s tech fines tracker: Google, Apple, Meta, Amazon, Microsoft, TikTok and X.
        </CardDescription>
        {p && (
          <CardAction>
            <Badge variant={p.on ? "success-light" : "outline"} radius="full">
              {p.on ? "On" : "Off"}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {p ? (
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="block-trackers">Block their ads and tracking</FieldLabel>
              <FieldDescription>
                {p.blocked ? `${p.blocked} ad, tracking and telemetry addresses` : "Their ad, tracking and telemetry addresses"}, for every device
                in the house. Their apps, YouTube, Facebook, sign-ins and the App Store all keep working.
              </FieldDescription>
            </FieldContent>
            <Switch id="block-trackers" checked={p.on} disabled={p.other} onCheckedChange={set} />
          </Field>
        ) : (
          <Skeleton className="h-12 w-full" />
        )}
        {p?.other && (
          <Alert variant="warning">
            <ShieldAlertIcon />
            <AlertTitle>Another blocker is set up</AlertTitle>
            <AlertDescription>Someone set one up in Advanced settings, so Beyond leaves it alone.</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="border-t py-3">
        <HelpLink id="trackers" className="ml-auto">
          What it blocks
        </HelpLink>
      </CardFooter>
    </Card>
  )
}
