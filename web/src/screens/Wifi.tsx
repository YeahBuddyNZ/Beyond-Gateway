import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { PrinterIcon, QrCodeIcon } from "lucide-react"
import { toast } from "sonner"
import { beyond } from "@/api"
import * as lib from "@/lib.js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/reui/badge"
import { PasswordInput } from "@/components/password-input"
import { PageTitle, Shell } from "./Shell"
import { HelpLink } from "@/components/help-link"
import { WifiQr } from "@/components/wifi-qr"
import { Dots } from "@/components/brand"

export function Wifi() {
  const [loaded, setLoaded] = useState(false)
  const [bands, setBands] = useState(1)
  const [ssid, setSsid] = useState("")
  const [key, setKey] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [share, setShare] = useState<{ ssid: string; key: string } | null>(null)
  const [shown, setShown] = useState(false)

  const loadShare = () =>
    beyond
      .wifiShare()
      .then((w) => setShare(w.ssid && w.key ? { ssid: w.ssid, key: w.key } : null))
      .catch(() => setShare(null))

  useEffect(() => {
    loadShare()
  }, [])

  useEffect(() => {
    beyond
      .wifiGet()
      .catch(() => ({}) as Record<string, never>)
      .then((w) => {
        setSsid(w.ssid || "")
        setBands(w.bands || 1)
        setLoaded(true)
      })
  }, [])

  return (
    <Shell tab="wifi">
      <PageTitle title="Wi-Fi" />
      <HelpLink id="wifi">What happens when I change it?</HelpLink>

      <Card>
        <form
          className="contents"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!key) return setError("Type the password too (the old one is fine), so every band gets the same.")
            const bad = lib.checkWifi(ssid.trim(), key)
            if (bad) return setError(bad)
            setError("")
            setBusy(true)
            const r = await beyond.wifiSet({ ssid: ssid.trim(), key }).catch(() => ({ ok: false, error: "" }))
            setBusy(false)
            if (!r.ok) return setError(r.error || "That didn’t save.")
            toast.success("Saved. Devices reconnect in a few seconds.")
            loadShare()
          }}
        >
          <CardHeader>
            <CardTitle>Your Wi-Fi</CardTitle>
            {bands > 1 && <CardDescription>One name for every band. Devices pick the fastest by themselves.</CardDescription>}
          </CardHeader>
          <CardContent>
            {loaded ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="ssid">Wi-Fi name</FieldLabel>
                  <Input id="ssid" value={ssid} maxLength={32} onChange={(e) => setSsid(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="key">Wi-Fi password</FieldLabel>
                  <PasswordInput
                    id="key"
                    value={key}
                    maxLength={63}
                    placeholder="Type it to change the name or password"
                    onChange={(e) => setKey(e.target.value)}
                  />
                  <FieldDescription>Changing it means every device has to join again.</FieldDescription>
                </Field>
                <FieldError>{error}</FieldError>
              </FieldGroup>
            ) : (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t py-3">
            <Button type="submit" size="lg" disabled={busy || !loaded}>
              Save
            </Button>
          </CardFooter>
        </form>
      </Card>

      {share && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCodeIcon aria-hidden="true" className="size-4" />
              Join with a QR code
            </CardTitle>
            <CardDescription>Point a phone's camera at it to join. No typing the password.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {shown ? (
              <WifiQr ssid={share.ssid} password={share.key} className="size-48 shrink-0 rounded-lg border" />
            ) : (
              <button
                type="button"
                onClick={() => setShown(true)}
                className="flex size-48 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                <QrCodeIcon aria-hidden="true" className="size-8" />
                Show the code
              </button>
            )}
            <dl className="grid w-full gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Wi-Fi name</dt>
                <dd className="font-medium break-all">{share.ssid}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Password</dt>
                <dd className="font-mono break-all">{shown ? share.key : "••••••••••"}</dd>
              </div>
              {!shown && <p className="text-muted-foreground">Hidden until you tap, so it isn\'t on show to whoever is looking over your shoulder.</p>}
            </dl>
          </CardContent>
          <CardFooter className="flex-wrap gap-2 border-t py-3">
            <Button variant="outline" onClick={() => (setShown(true), setTimeout(() => window.print(), 50))}>
              <PrinterIcon aria-hidden="true" />
              Print a card for the fridge
            </Button>
            <HelpLink id="wifi-qr">How does this work?</HelpLink>
          </CardFooter>
          {createPortal(
            <div className="print-only flex-col items-center justify-center gap-6 text-center">
              <Dots />
              <p className="text-3xl font-semibold">Join our Wi-Fi</p>
              <WifiQr ssid={share.ssid} password={share.key} className="size-72" />
              <p className="text-lg">Point your phone's camera at the code</p>
              <div className="text-lg">
                <p>
                  Name: <strong>{share.ssid}</strong>
                </p>
                <p>
                  Password: <strong className="font-mono">{share.key}</strong>
                </p>
              </div>
            </div>,
            document.body,
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCodeIcon aria-hidden="true" className="size-4" />
            Guest Wi-Fi
            <Badge variant="info-light">Coming next</Badge>
          </CardTitle>
          <CardDescription>A separate network for visitors, with a QR code to put on the TV or the fridge.</CardDescription>
        </CardHeader>
      </Card>
    </Shell>
  )
}
