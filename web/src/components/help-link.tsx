import { CircleHelpIcon } from "lucide-react"
import { cn } from "cn"

/** A small "How does this work?" link to one help article. */
export function HelpLink({ id, children = "How does this work?", className }: { id: string; children?: React.ReactNode; className?: string }) {
  return (
    <a href={`#help/${id}`} className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline", className)}>
      <CircleHelpIcon aria-hidden="true" className="size-4" />
      {children}
    </a>
  )
}
