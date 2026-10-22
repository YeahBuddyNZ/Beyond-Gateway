import { useMemo } from "react"
import { encode } from "uqr"
import * as lib from "@/lib.js"

// Always black on white, whatever the theme: a camera reads dark squares on a light ground.
export function WifiQr({ ssid, password, className }: { ssid: string; password: string; className?: string }) {
  const { size, d } = useMemo(() => {
    const qr = encode(lib.wifiQrText(ssid, password), { ecc: "M", border: 2 })
    let d = ""
    qr.data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)))
    return { size: qr.size, d }
  }, [ssid, password])
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={`QR code to join ${ssid}`} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}
