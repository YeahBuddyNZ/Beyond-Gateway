import { useCallback, useEffect, useState } from "react"
import { beyond, onSessionChange, signedIn, SignedOut } from "@/api"
import { Button } from "@/components/ui/button"
import { Centred, Heading } from "@/screens/Centred"
import { Devices } from "@/screens/Devices"
import { Home } from "@/screens/Home"
import { Settings } from "@/screens/Settings"
import { Setup } from "@/screens/Setup"
import { SignIn } from "@/screens/SignIn"
import { Wifi } from "@/screens/Wifi"
import { Skeleton } from "@/components/ui/skeleton"

const SCREENS = { home: Home, devices: Devices, wifi: Wifi, settings: Settings }
const tabFromHash = () => {
  const t = location.hash.slice(1)
  return (t in SCREENS ? t : "home") as keyof typeof SCREENS
}

type State = "loading" | "setup" | "signin" | "app" | "unreachable"

export function App() {
  const [state, setState] = useState<State>("loading")
  const [tab, setTab] = useState(tabFromHash)

  const check = useCallback(async () => {
    try {
      const s = await beyond.setupState()
      setState(!s.setup_done ? "setup" : signedIn() ? "app" : "signin")
    } catch (e) {
      if (!(e instanceof SignedOut)) setState("unreachable")
    }
  }, [])

  useEffect(() => {
    void check()
    const off = onSessionChange(() => void check())
    const onHash = () => {
      setTab(tabFromHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener("hashchange", onHash)
    return () => {
      off()
      window.removeEventListener("hashchange", onHash)
    }
  }, [check])

  if (state === "loading")
    return (
      <Centred>
        <Skeleton className="h-24 w-full" />
      </Centred>
    )
  if (state === "setup") return <Setup />
  if (state === "signin") return <SignIn />
  if (state === "unreachable")
    return (
      <Centred>
        <Heading title="Can’t reach the router" lead="Check you’re on its Wi-Fi or plugged into it, then try again." />
        <Button size="lg" onClick={() => void check()}>
          Try again
        </Button>
      </Centred>
    )
  const Screen = SCREENS[tab]
  return <Screen key={tab} />
}
