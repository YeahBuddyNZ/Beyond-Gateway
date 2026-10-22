import { useState } from "react"
import { CheckIcon, GlobeIcon, LoaderCircleIcon } from "lucide-react"
import { beyond, PREVIEW } from "@/api"
import { useEvery } from "@/hooks/use-every"
import * as lib from "@/lib.js"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/password-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Stepper, StepperIndicator, StepperItem, StepperNav, StepperSeparator, StepperTitle } from "@/components/reui/stepper"
import { Centred, Heading } from "./Centred"

const STEPS = ["Internet", "Wi-Fi", "Router password"]

// First run: find the internet, name the Wi-Fi, set the router's password. Nothing changes until the last step.
export function Setup() {
  const [step, setStep] = useState(1)
  const [wan, setWan] = useState("")
  const [ssid, setSsid] = useState("")
  const [key, setKey] = useState("")
  const [password, setPassword] = useState("")
  const [again, setAgain] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEvery(3000, async () => {
    if (step !== 1 || wan) return
    const s = await beyond.setupState().catch(() => null)
    if (s?.wan_mode) setWan(s.wan_mode)
  })

  const go = (n: number) => {
    setError("")
    setStep(n)
  }

  if (done) {
    return (
      <Centred>
        <Heading
          title="All set. Ka pai!"
          lead={
            <>
              The Wi-Fi is changing to <b className="text-foreground">{ssid}</b>. Join it on this device, then open{" "}
              <b className="text-foreground">beyond.lan</b> to see your home.
            </>
          }
        />
        <Button size="lg" onClick={() => (location.href = PREVIEW ? location.pathname + "?preview" : "/beyond/")}>
          I’ve joined it
        </Button>
      </Centred>
    )
  }

  return (
    <Centred>
      <Stepper value={step} aria-label="Setup steps">
        <StepperNav>
          {STEPS.map((title, i) => (
            <StepperItem key={title} step={i + 1}>
              <div className="flex flex-col items-center gap-1.5">
                <StepperIndicator>
                  {i + 1 < step ? <CheckIcon className="size-3.5" aria-hidden="true" /> : i + 1}
                </StepperIndicator>
                <StepperTitle className="text-xs text-muted-foreground group-data-[state=active]/step:text-foreground">
                  {title}
                </StepperTitle>
              </div>
              {i < STEPS.length - 1 && <StepperSeparator className="mb-5 group-data-[state=completed]/step:bg-primary" />}
            </StepperItem>
          ))}
        </StepperNav>
      </Stepper>

      {step === 1 && (
        <div className="flex flex-col gap-6">
          <Heading
            title="Kia ora. Let’s set up your home network."
            lead="Three quick steps. Nothing on your other devices changes until the last one."
          />
          {wan ? (
            <Alert variant="success">
              <GlobeIcon />
              <AlertTitle>Found the internet</AlertTitle>
              <AlertDescription>{lib.wanWords(wan)}</AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
              <AlertTitle>Looking for the internet...</AlertTitle>
              <AlertDescription>
                Check the cable from the fibre box on the wall goes into the port marked WAN. It keeps looking by
                itself.
              </AlertDescription>
            </Alert>
          )}
          <Button size="lg" onClick={() => go(2)}>
            Start
          </Button>
        </div>
      )}

      {step === 2 && (
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            const bad = lib.checkWifi(ssid.trim(), key)
            if (bad) return setError(bad)
            setSsid(ssid.trim())
            go(3)
          }}
        >
          <Heading
            title="Name your Wi-Fi"
            lead="Tip: use the same name and password as your old router, and every phone and TV in the house joins by itself."
          />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ssid">Wi-Fi name</FieldLabel>
              <Input id="ssid" value={ssid} maxLength={32} autoComplete="off" placeholder="Our Whare" onChange={(e) => setSsid(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="key">Wi-Fi password</FieldLabel>
              <PasswordInput id="key" value={key} maxLength={63} onChange={(e) => setKey(e.target.value)} />
              <FieldDescription>At least 8 characters.</FieldDescription>
            </Field>
            <FieldError>{error}</FieldError>
          </FieldGroup>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => go(1)}>
              Back
            </Button>
            <Button type="submit" size="lg" className="flex-1">
              Next
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form
          className="flex flex-col gap-6"
          onSubmit={async (e) => {
            e.preventDefault()
            if (password.length < 8) return setError("The router password needs at least 8 characters.")
            if (password !== again) return setError("Those two don’t match.")
            setError("")
            setBusy(true)
            const r = await beyond.finishSetup({ ssid, key, password }).catch((x: Error) => ({ ok: false, error: x.message }))
            setBusy(false)
            if (!r.ok) return setError(r.error || "That didn’t work. Try again.")
            setDone(true)
          }}
        >
          <Heading title="A password for the router" lead="This is for changing settings, not for joining the Wi-Fi. Keep it somewhere safe." />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password">Router password</FieldLabel>
              <PasswordInput id="password" value={password} maxLength={128} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="again">Type it again</FieldLabel>
              <PasswordInput id="again" value={again} maxLength={128} onChange={(e) => setAgain(e.target.value)} />
            </Field>
            <FieldError>{error}</FieldError>
          </FieldGroup>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => go(2)}>
              Back
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={busy}>
              Finish
            </Button>
          </div>
        </form>
      )}
    </Centred>
  )
}
