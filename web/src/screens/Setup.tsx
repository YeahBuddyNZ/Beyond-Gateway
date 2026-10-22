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
import { HelpLink } from "@/components/help-link"

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
  const [mesh, setMesh] = useState(false)

  useEvery(3000, async () => {
    if (step !== 1 || wan || mesh) return
    const s = await beyond.setupState().catch(() => null)
    if (s?.wan_mode) setWan(s.wan_mode)
  })

  if (mesh) return <JoinMesh onBack={() => setMesh(false)} />

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
          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={() => go(2)}>
              Start
            </Button>
            <Button size="lg" variant="outline" onClick={() => setMesh(true)}>
              Add to my Beyond network
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <HelpLink id="which-isp">Does it work with my internet?</HelpLink>
            <HelpLink id="phone">Home phone through the modem?</HelpLink>
            <HelpLink id="mesh">Already have a Beyond router?</HelpLink>
          </div>
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
          <HelpLink id="old-wifi">Where do I find my old one?</HelpLink>
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

// A second Beyond router in the house: it joins the main one by cable and puts out the same Wi-Fi. Its network changes
// under this page while it joins, so the page says what will happen and then looks for how it went.
function JoinMesh({ onBack }: { onBack: () => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [joined, setJoined] = useState(false)

  useEvery(4000, async () => {
    if (!waiting) return
    const s = await beyond.setupState().catch(() => null)
    if (!s) return
    if (s.setup_done && s.role === "point") {
      setJoined(true)
      setWaiting(false)
    } else if (!s.joining && s.mesh_message) {
      setError(s.mesh_message)
      setWaiting(false)
    }
  })

  if (joined || waiting)
    return (
      <Centred>
        <Heading
          title={joined ? "Joined. Ka pai!" : "Joining your Beyond network..."}
          lead="It takes about two minutes. The Beyond Setup Wi-Fi goes away, and this router starts putting out your home Wi-Fi."
        />
        {!joined && (
          <Alert>
            <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
            <AlertTitle>This page may lose the router for a bit</AlertTitle>
            <AlertDescription>That’s normal. If it doesn’t come back, join your home Wi-Fi and carry on below.</AlertDescription>
          </Alert>
        )}
        <p className="text-sm text-muted-foreground">
          Then join your home Wi-Fi, open <b className="text-foreground">beyond.lan</b> and look under <b className="text-foreground">Settings</b>,{" "}
          <b className="text-foreground">Mesh points</b>. Give it a name like Upstairs there.
        </p>
      </Centred>
    )

  return (
    <Centred>
      <form
        className="flex flex-col gap-6"
        onSubmit={async (e) => {
          e.preventDefault()
          if (password.length < 8) return setError("Type the password of your main Beyond router.")
          setError("")
          setBusy(true)
          const r = await beyond.joinMesh({ password }).catch((x: Error) => ({ ok: false, error: x.message }))
          setBusy(false)
          if (!r.ok) return setError(r.error || "That didn’t work. Try again.")
          setWaiting(true)
        }}
      >
        <Heading title="Add it to your Beyond network" lead="This router becomes a mesh point: it puts out the same Wi-Fi as your main Beyond router, further from it." />
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Run a cable from this router’s <strong>WAN</strong> port to one of your main Beyond router’s ports. Through the wall sockets is fine.
          </li>
          <li>Type your main router’s password. It becomes this router’s password too.</li>
        </ol>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="main-password">Main router’s password</FieldLabel>
            <PasswordInput id="main-password" value={password} maxLength={128} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <FieldError>{error}</FieldError>
        </FieldGroup>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" size="lg" className="flex-1" disabled={busy}>
            Join
          </Button>
        </div>
        <HelpLink id="mesh" className="self-center">
          How mesh works
        </HelpLink>
      </form>
    </Centred>
  )
}
