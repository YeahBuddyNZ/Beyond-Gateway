import { useState } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"

type Props = Omit<React.ComponentProps<typeof InputGroupInput>, "type">

// A password box with Show, because typing a long Wi-Fi password blind on a phone is how mistakes happen.
export function PasswordInput(props: Props) {
  const [shown, setShown] = useState(false)
  return (
    <InputGroup>
      <InputGroupInput type={shown ? "text" : "password"} autoComplete="new-password" {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={shown ? "Hide password" : "Show password"}
          size="icon-xs"
          onClick={() => setShown(!shown)}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
