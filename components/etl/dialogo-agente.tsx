"use client"

import * as React from "react"
import {
  BotMessageSquareIcon,
  SendIcon,
  XIcon,
} from "lucide-react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { construirContextoAgente } from "@/lib/etl/contexto-agente"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function DialogoAgente({ etl }: { etl: PipelineEtl }) {
  const [mensajes, setMensajes] = React.useState<MensajeChat[]>([])
  const [borrador, setBorrador] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const finalMensajes = React.useRef<HTMLDivElement>(null)
  const contexto = React.useMemo(
    () => construirContextoAgente(etl),
    [
      etl.extraccion,
      etl.procesado,
      etl.filtros,
      etl.filtrosInterpretados,
      etl.orden,
      etl.filtradosOrdenados,
      etl.modoSeleccion,
      etl.conjuntoCarga,
      etl.carga,
      etl.estadoSupabase,
    ]
  )

  React.useEffect(() => {
    finalMensajes.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [mensajes, enviando, error])

  const enviar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const texto = borrador.trim()
    if (!texto || enviando) return

    const siguientes = [...mensajes, { role: "user" as const, content: texto }]
    setMensajes(siguientes)
    setBorrador("")
    setError(null)
    setEnviando(true)

    try {
      const respuesta = await fetch("/api/agente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Mantiene suficiente contexto y limita el tamaño de la petición.
        body: JSON.stringify({
          messages: siguientes.slice(-12),
          dashboardContext: contexto,
        }),
      })
      const datos = await respuesta.json()
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo enviar el mensaje.")
      setMensajes([
        ...siguientes,
        { role: "assistant", content: datos.message },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar con el agente.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        aria-label="Abrir conversación con el agente"
        className="fixed bottom-4 left-4 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg outline-none transition-colors hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        <BotMessageSquareIcon aria-hidden className="size-4" />
        <span>Agente</span>
      </DialogTrigger>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:w-[min(36rem,calc(100%-2rem))]">
        <DialogHeader className="border-b p-5 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <BotMessageSquareIcon aria-hidden className="size-5 text-primary" />
            Conversación con el agente
          </DialogTitle>
          <DialogDescription>
            Asistente para el pipeline meteorológico y el uso de la aplicación.
          </DialogDescription>
          <DialogClose
            aria-label="Cerrar diálogo"
            className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <XIcon aria-hidden className="size-4" />
          </DialogClose>
        </DialogHeader>

        <div
          role="log"
          aria-label="Mensajes de la conversación"
          aria-live="polite"
          className="flex min-h-56 flex-col gap-4 overflow-y-auto p-4 sm:p-5"
        >
          {mensajes.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BotMessageSquareIcon aria-hidden className="size-6" />
              </span>
              <p className="max-w-sm text-sm text-muted-foreground">
                Pregunta sobre el pipeline, la calidad de los datos o cómo utilizar el dashboard.
              </p>
            </div>
          ) : (
            mensajes.map((mensaje, i) => (
              <div
                key={`${mensaje.role}-${i}`}
                className={`flex ${mensaje.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${mensaje.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"}`}
                >
                  {mensaje.content}
                </p>
              </div>
            ))
          )}
          {enviando && (
            <p role="status" className="self-start rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
              El agente está escribiendo…
            </p>
          )}
          {error && (
            <p role="alert" className="self-start rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div ref={finalMensajes} />
        </div>

        <form onSubmit={enviar} className="flex items-end gap-2 border-t bg-muted/30 p-3 sm:p-4">
          <textarea
            aria-label="Escribe un mensaje para el agente"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Escribe tu mensaje…"
            rows={1}
            maxLength={3000}
            disabled={enviando}
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-y rounded-lg border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={enviando || !borrador.trim()}
            aria-label="Enviar mensaje"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground outline-none transition-colors hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <SendIcon aria-hidden className="size-4" />
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type MensajeChat = { role: "user" | "assistant"; content: string }
