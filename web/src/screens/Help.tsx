import { Fragment, useEffect, useMemo, useState } from "react"
import { ArrowLeftIcon, LifeBuoyIcon, SearchIcon } from "lucide-react"
import { HELP, searchHelp, SUPPORT_URL, type Article } from "@/help"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Wordmark } from "@/components/brand"
import { PageTitle, Shell } from "./Shell"

/** **bold** for what to press, nothing else. */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-foreground">{part}</strong> : <Fragment key={i}>{part}</Fragment>))}
    </>
  )
}

function Body({ article }: { article: Article }) {
  return (
    <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-foreground/85">
      {article.body.map((p, i) => (
        <p key={i}>
          <Words text={p} />
        </p>
      ))}
    </div>
  )
}

const openFromHash = () => location.hash.match(/^#help\/([a-z-]+)/)?.[1] ?? null

function HelpBody() {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<string[]>(() => {
    const id = openFromHash()
    return id ? [id] : []
  })
  const found = useMemo(() => searchHelp(query), [query])
  const searching = query.trim().length > 0

  useEffect(() => {
    const id = openFromHash()
    if (id) requestAnimationFrame(() => document.getElementById("help-" + id)?.scrollIntoView({ block: "start" }))
  }, [])

  const list = (articles: Article[]) => (
    <Accordion value={open} onValueChange={(v) => setOpen(v as string[])} multiple>
      {articles.map((a) => (
        <AccordionItem key={a.id} value={a.id} id={"help-" + a.id} className="scroll-mt-4">
          <AccordionTrigger className="text-base">{a.title}</AccordionTrigger>
          <AccordionContent>
            <Body article={a} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )

  return (
    <>
      <InputGroup className="h-11">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What do you need a hand with?" aria-label="Search help" />
      </InputGroup>

      {searching ? (
        found.length ? (
          <Card>
            <CardContent>{list(found)}</CardContent>
          </Card>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Nothing about that yet</EmptyTitle>
              <EmptyDescription>Try other words, or ask us below. A real person answers.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      ) : (
        HELP.map((topic) => (
          <Card key={topic.title}>
            <CardHeader>
              <CardTitle>{topic.title}</CardTitle>
            </CardHeader>
            <CardContent>{list(topic.articles)}</CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoyIcon aria-hidden="true" className="size-4 text-primary" /> Still stuck?
          </CardTitle>
          <CardDescription>Ask Atlas, Beyond's helper, on our website. If it can't sort it, a real person from Beyond joins the same chat.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "lg" })}>
            Get help from Beyond
          </a>
        </CardContent>
      </Card>
    </>
  )
}

/** Help while signed in, in the usual frame. */
export function Help() {
  return (
    <Shell tab="help">
      <PageTitle title="Help" lead="Plain answers, and what to press." />
      <HelpBody />
    </Shell>
  )
}

/** Help before setup or sign-in: no menu, and a way back to where they were. */
export function HelpOutside() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:py-10">
      <div className="flex items-center justify-between gap-4">
        <Wordmark />
        <a href="#" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          <ArrowLeftIcon aria-hidden="true" />
          Back
        </a>
      </div>
      <PageTitle title="Help" lead="Plain answers, and what to press." />
      <HelpBody />
    </main>
  )
}
