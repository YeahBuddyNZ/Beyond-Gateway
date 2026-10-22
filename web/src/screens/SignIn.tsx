import { useState } from "react"
import { signIn } from "@/api"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { PasswordInput } from "@/components/password-input"
import { Centred, Heading } from "./Centred"

export function SignIn() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <Centred>
      <form
        className="flex flex-col gap-6"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const ok = await signIn(password)
          setBusy(false)
          if (!ok) setError("That password didn’t work.")
        }}
      >
        <Heading title="Welcome home" />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">Router password</FieldLabel>
            <PasswordInput id="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <FieldError>{error}</FieldError>
        </FieldGroup>
        <Button type="submit" size="lg" disabled={busy}>
          Sign in
        </Button>
      </form>
    </Centred>
  )
}
