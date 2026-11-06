"use client"

import * as React from "react"
import {
  ChevronRightIcon,
  CloudSunIcon,
  DatabaseIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  RefreshCwIcon,
} from "lucide-react"

import { BotonTema } from "@/components/selector-tema"
import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { EstadoSupabase } from "@/lib/etl/api-cliente"
import type { EstadoFase } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"

import type { Destino } from "./aplicacion-etl"
import { ESTADOS } from "./estado-badge"
import { formatoEntero } from "./formato"
import { ACCIONES_FASE, calcularFases, ICONOS_FASE } from "./pipeline-visual"

const FONDO_FASE: Record<EstadoFase, string> = {
  pendiente: "bg-muted text-muted-foreground",
  en_curso: "bg-accent text-marca ring-2 ring-marca",
  completada: "bg-primary text-primary-foreground",
  error: "bg-destructive text-white",
}

const ICONO_ESTADO: Record<EstadoFase, string> = {
  pendiente: "text-muted-foreground",
  en_curso: "animate-spin text-marca",
  completada: "text-emerald-600 dark:text-emerald-400",
  error: "text-red-600 dark:text-red-400",
}

/**
 * Las cinco fases siempre a la vista: estado, salida y acceso directo a sus
 * datos. Es a la vez el resumen del pipeline y la navegación de la página.
 */
function RielPipeline({
  etl,
  activa,
  alAbrir,
}: {
  etl: PipelineEtl
  activa: string | null
  alAbrir: (destino: Destino) => void
}) {
  const fases = calcularFases(etl)
  return (
    <nav aria-label="Fases del pipeline" className="min-w-0 flex-1">
      <ol className="flex items-center gap-1 overflow-x-auto py-1.5">
        {fases.map((f, i) => {
          const Icono = ICONOS_FASE[f.id]
          const estado = ESTADOS[f.estado]
          const textoEstado = f.textoEstado ?? estado.texto
          return (
            <li key={f.id} className="flex shrink-0 items-center gap-1">
              {i > 0 && (
                <ChevronRightIcon
                  aria-hidden
                  className="size-4 text-muted-foreground/70"
                />
              )}
              <button
                type="button"
                onClick={() =>
                  alAbrir(f.id === "extraccion" ? "extraccion" : f.pestana)
                }
                aria-current={activa === f.id ? "step" : undefined}
                title={`Paso ${i + 1}: ${f.titulo} (${ACCIONES_FASE[f.id].toLowerCase()}) · ${textoEstado}${f.salida === "—" ? "" : ` · ${f.salida}`}\nPulsa para ver sus datos.`}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  activa === f.id && "bg-muted ring-1 ring-foreground/15"
                )}
              >
                <span
                  className={cn(
                    "relative flex size-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-colors",
                    FONDO_FASE[f.estado]
                  )}
                >
                  <Icono aria-hidden className="size-4" />
                  {/* El estado también va como icono, no solo como color. */}
                  <estado.icono
                    aria-hidden
                    className={cn(
                      "absolute -right-1 -bottom-1 size-4 rounded-full bg-card",
                      ICONO_ESTADO[f.estado]
                    )}
                  />
                </span>
                <span className="hidden max-w-32 flex-col leading-tight lg:flex xl:max-w-40">
                  <span className="truncate text-sm font-medium">
                    <span className="text-muted-foreground">{i + 1}.</span>{" "}
                    {f.titulo}
                  </span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {/* Mientras no hay resultado, se explica qué hace la fase. */}
                    {f.salida === "—" ? ACCIONES_FASE[f.id] : f.salida}
                  </span>
                </span>
                <span className="sr-only lg:hidden">
                  {f.titulo} ({ACCIONES_FASE[f.id]}): {textoEstado}, {f.salida}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function BarraSuperior({
  etl,
  faseActiva,
  alAbrir,
  panelAbierto,
  alternarPanel,
}: {
  etl: PipelineEtl
  faseActiva: string | null
  alAbrir: (destino: Destino) => void
  panelAbierto: boolean
  alternarPanel: () => void
}) {
  return (
    <header className="z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-card px-2 shadow-sm sm:gap-4 sm:px-4">
      <h1 className="sr-only">Pipeline ETL: Open-Meteo → Supabase</h1>
      <Marca />
      <span aria-hidden className="hidden h-8 w-px bg-border sm:block" />
      <RielPipeline etl={etl} activa={faseActiva} alAbrir={alAbrir} />
      <TarjetaSupabase etl={etl} className="hidden shrink-0 md:flex" />
      <BotonTema />
      <Button
        variant="outline"
        size="icon"
        onClick={alternarPanel}
        aria-label={panelAbierto ? "Cerrar panel" : "Abrir panel"}
        title={
          panelAbierto
            ? "Ocultar el panel de la derecha para ver el mapa entero"
            : "Mostrar el panel de la derecha (descargar, gráficos y tablas)"
        }
      >
        {panelAbierto ? (
          <PanelRightCloseIcon aria-hidden />
        ) : (
          <PanelRightOpenIcon aria-hidden />
        )}
      </Button>
    </header>
  )
}

/** Distingue "faltan variables" de "el servidor no responde" (p. ej. un 403). */
function textoEstado(sb: EstadoSupabase | null) {
  if (!sb) return "Comprobando…"
  if (sb.tablaAccesible) return "Conectado"
  if (sb.configurado) return "Tabla no disponible"
  if (sb.faltan.length > 0) return "Sin configurar"
  return "Sin acceso"
}

export function TarjetaSupabase({
  etl,
  className,
}: {
  etl: PipelineEtl
  className?: string
}) {
  const sb = etl.estadoSupabase
  const [comprobando, setComprobando] = React.useState(false)
  const comprobar = async () => {
    setComprobando(true)
    await etl.refrescarEstadoSupabase()
    setComprobando(false)
  }
  const detalle = !sb
    ? null
    : sb.tablaAccesible
      ? sb.totalFilas !== undefined
        ? `${formatoEntero(sb.totalFilas)} filas guardadas`
        : null
      : sb.mensaje
  // Texto suelto, sin caja: solo llama la atención si hay un problema.
  const fallo = sb !== null && !sb.tablaAccesible
  return (
    <section
      aria-label="Estado de Supabase"
      className={cn("group flex items-center gap-1 text-xs", className)}
    >
      <p
        role="status"
        title={detalle ?? undefined}
        className={cn(
          "flex items-center gap-1.5",
          fallo ? "text-red-700 dark:text-red-300" : "text-muted-foreground"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            !sb
              ? "bg-muted-foreground/50"
              : sb.tablaAccesible
                ? "bg-emerald-500"
                : "bg-red-500"
          )}
        />
        <DatabaseIcon aria-hidden className="size-3.5 shrink-0" />
        <span>
          Supabase{" "}
          <span className={cn(!fallo && "sr-only")}>· {textoEstado(sb)}</span>
        </span>
        {detalle && <span className="sr-only">. {detalle}</span>}
      </p>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Comprobar conexión con Supabase"
        title="Comprobar otra vez si la base de datos (Supabase) responde"
        onClick={() => void comprobar()}
        disabled={comprobando}
        className={cn(
          "text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
          (comprobando || fallo) && "opacity-100"
        )}
      >
        <RefreshCwIcon
          aria-hidden
          className={cn(comprobando && "animate-spin")}
        />
      </Button>
    </section>
  )
}

function Marca() {
  return (
    <span className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-lg bg-marca text-marca-foreground">
        <CloudSunIcon aria-hidden className="size-4.5" />
      </span>
      <span className="hidden lg:inline">Meteo ETL</span>
    </span>
  )
}
