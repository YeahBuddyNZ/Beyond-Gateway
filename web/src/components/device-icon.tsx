import {
  CameraIcon,
  CircleHelpIcon,
  Gamepad2Icon,
  LaptopIcon,
  MonitorIcon,
  PrinterIcon,
  SmartphoneIcon,
  SpeakerIcon,
  TabletIcon,
  TvIcon,
  WatchIcon,
  type LucideIcon,
} from "lucide-react"

// The kinds a device can be. The same list as KINDS in beyond.uc, which refuses anything else.
export const KINDS: Array<[string, string, LucideIcon]> = [
  ["phone", "Phone", SmartphoneIcon],
  ["laptop", "Laptop", LaptopIcon],
  ["tablet", "Tablet", TabletIcon],
  ["tv", "TV", TvIcon],
  ["console", "Games console", Gamepad2Icon],
  ["speaker", "Speaker", SpeakerIcon],
  ["camera", "Camera", CameraIcon],
  ["watch", "Watch", WatchIcon],
  
  ["printer", "Printer", PrinterIcon],
  ["computer", "Computer", MonitorIcon],
  ["other", "Something else", CircleHelpIcon],
]

export function DeviceIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = KINDS.find(([k]) => k === kind)?.[2] ?? CircleHelpIcon
  return <Icon aria-hidden="true" className={className} />
}
