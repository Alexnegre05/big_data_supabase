"use client"

import * as React from "react"
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloudDownloadIcon,
  LayoutDashboardIcon,
  Maximize2Icon,
  MapPinIcon,
  Minimize2Icon,
  Table2Icon,
  WorkflowIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { cn } from "@/lib/utils"

import { ActividadReciente } from "./actividad-reciente"
import type { Destino } from "./aplicacion-etl"
import { TarjetaSupabase } from "./barra-superior"
import { Cobertura } from "./cobertura"
import { ConfiguracionExtraccion } from "./configuracion-extraccion"
import { ContextoResumido, useResumido } from "./detalle-panel"
import { formatoEntero } from "./formato"
import { GraficoCiudades } from "./grafico-ciudades"
import { InspeccionDatos, type Pestana } from "./inspeccion-datos"
import { GuiaPasos } from "./guia-pasos"
import { PipelineVisual } from "./pipeline-visual"
import { TarjetaCalidad } from "./tarjeta-calidad"
import { TarjetasKpi } from "./tarjetas-kpi"

export const VISTAS = [
  {
    id: "extraccion",
    titulo: "Extracción",
    icono: CloudDownloadIcon,
    ayuda: "Empieza aquí: elige ciudades y fechas y descarga los datos",
  },
  {
    id: "resumen",
    titulo: "Resumen",
    icono: LayoutDashboardIcon,
    ayuda: "Gráficos y cifras de lo que has descargado",
  },
  {
    id: "pipeline",
    titulo: "Pipeline",
    icono: WorkflowIcon,
    ayuda: "Qué les pasa a los datos en cada fase, paso a paso",
  },
  {
    id: "datos",
    titulo: "Datos",
    icono: Table2Icon,
    ayuda: "Las tablas: revisa las filas, elige cuáles guardar y súbelas",
  },
] as const

export type Vista = (typeof VISTAS)[number]["id"]

/** null = ancho por defecto, "max" = todo lo que deja el mapa, número = px arrastrados. */
export type AnchoPanel = number | "max" | null

const ANCHO_MINIMO = 352
/** Lo que se reserva siempre para el mapa. */
const RESERVA_MAPA = 320
const PASO_TECLADO = 32

/**
 * Panel acoplado a la derecha del mapa (en móvil, a pantalla completa bajo la
 * barra superior). Todas las vistas siguen montadas aunque estén ocultas, para
 * no perder paginaciones ni consultas al cambiar de una a otra.
 */
export function PanelTrabajo({
  etl,
  vista,
  setVista,
  pestana,
  setPestana,
  ancho,
  setAncho,
  abierto,
  abiertoMovil,
  cerrar,
  navegar,
}: {
  etl: PipelineEtl
  vista: Vista
  setVista: (v: Vista) => void
  pestana: Pestana | null
  setPestana: (p: Pestana | null) => void
  ancho: AnchoPanel
  setAncho: (a: AnchoPanel) => void
  abierto: boolean
  abiertoMovil: boolean
  cerrar: () => void
  navegar: (destino: Destino) => void
}) {
  const [arrastrando, setArrastrando] = React.useState(false)
  const panelRef = React.useRef<HTMLElement>(null)
  const contenidoRef = React.useRef<HTMLDivElement>(null)
  const validos = etl.procesado?.limpieza.validos.length

  // Cada vista empieza arriba, no donde se quedó la anterior.
  React.useEffect(() => {
    contenidoRef.current?.scrollTo({ top: 0 })
  }, [vista])

  return (
    <aside
      ref={panelRef}
      aria-label="Panel de trabajo"
      style={
        typeof ancho === "number"
          ? ({ "--ancho-panel": `${ancho}px` } as React.CSSProperties)
          : undefined
      }
      className={cn(
        "@container flex min-h-0 flex-col bg-background",
        // Móvil: hoja a pantalla completa bajo la barra superior.
        abiertoMovil ? "fixed inset-x-0 top-16 bottom-0 z-40" : "hidden",
        // Escritorio: columna junto al mapa; el mapa se encoge, no queda tapado.
        "lg:relative lg:inset-auto lg:z-auto lg:max-w-[calc(100%-20rem)] lg:min-w-[22rem] lg:shrink-0 lg:border-l",
        abierto ? "lg:flex" : "lg:hidden",
        ancho === null && "lg:w-[30rem] xl:w-[34rem]",
        ancho === "max" && "lg:w-[min(76rem,calc(100%-22rem))]",
        typeof ancho === "number" && "lg:w-(--ancho-panel)",
        !arrastrando && "lg:transition-[width] lg:duration-300"
      )}
    >
      <AsaRedimension
        panelRef={panelRef}
        ancho={ancho}
        setAncho={setAncho}
        setArrastrando={setArrastrando}
      />

      <div className="flex shrink-0 items-center gap-1 border-b bg-card px-2 py-1.5">
        <div
          role="tablist"
          aria-label="Vistas del panel"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
        >
          {VISTAS.map(({ id, titulo, icono: Icono, ayuda }) => (
            <button
              key={id}
              type="button"
              role="tab"
              title={ayuda}
              id={`vista-${id}`}
              aria-selected={vista === id}
              aria-controls={`contenido-${id}`}
              onClick={() => setVista(id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                vista === id
                  ? "bg-muted font-medium text-foreground ring-1 ring-foreground/10"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icono aria-hidden className="size-4 text-marca" />
              {titulo}
              {id === "datos" && validos !== undefined && (
                <span className="rounded-full bg-marca/15 px-1.5 text-xs tabular-nums">
                  <span className="sr-only">(</span>
                  {formatoEntero(validos)}
                  <span className="sr-only"> válidos)</span>
                </span>
              )}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          onClick={() => setAncho(ancho === null ? "max" : null)}
          aria-label={ancho === null ? "Ensanchar panel" : "Ancho por defecto"}
          title={
            ancho === null
              ? "Ensanchar panel (para tablas)"
              : "Volver al ancho por defecto"
          }
        >
          {ancho === null ? (
            <Maximize2Icon aria-hidden />
          ) : (
            <Minimize2Icon aria-hidden />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={cerrar}
          aria-label="Cerrar panel"
          title="Cerrar panel"
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      <div
        ref={contenidoRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <Seccion id="extraccion" vista={vista}>
          {/* Lo primero que se ve: qué hacer ahora y el botón para hacerlo. */}
          <GuiaPasos etl={etl} navegar={navegar} vistaActual="extraccion" />
          <ConfiguracionExtraccion etl={etl} />
        </Seccion>
        <Seccion id="resumen" vista={vista} ampliable>
          <Resumen etl={etl} navegar={navegar} />
        </Seccion>
        <Seccion id="pipeline" vista={vista} ampliable>
          <PipelineVisual etl={etl} alInspeccionar={navegar} />
        </Seccion>
        <Seccion id="datos" vista={vista}>
          <InspeccionDatos
            etl={etl}
            pestana={pestana}
            setPestana={setPestana}
          />
        </Seccion>
      </div>
    </aside>
  )
}

/**
 * Borde izquierdo arrastrable. Con el teclado: flechas para ensanchar o
 * estrechar, Inicio y Fin para los extremos. Doble clic alterna estrecho/ancho.
 */
function AsaRedimension({
  panelRef,
  ancho,
  setAncho,
  setArrastrando,
}: {
  panelRef: React.RefObject<HTMLElement | null>
  ancho: AnchoPanel
  setAncho: (a: AnchoPanel) => void
  setArrastrando: (a: boolean) => void
}) {
  const maximo = () =>
    Math.max(
      ANCHO_MINIMO,
      (panelRef.current?.parentElement?.clientWidth ?? window.innerWidth) -
        RESERVA_MAPA
    )
  const fijar = (px: number) =>
    setAncho(Math.round(Math.min(maximo(), Math.max(ANCHO_MINIMO, px))))
  const actual = () => panelRef.current?.getBoundingClientRect().width ?? 0

  const alPulsar = (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current
    if (e.button !== 0 || !panel) return
    e.preventDefault()
    const asa = e.currentTarget
    const derecha = panel.getBoundingClientRect().right
    asa.setPointerCapture(e.pointerId)
    setArrastrando(true)
    const mover = (ev: PointerEvent) => fijar(derecha - ev.clientX)
    const soltar = () => {
      setArrastrando(false)
      asa.removeEventListener("pointermove", mover)
      asa.removeEventListener("pointerup", soltar)
      asa.removeEventListener("pointercancel", soltar)
    }
    asa.addEventListener("pointermove", mover)
    asa.addEventListener("pointerup", soltar)
    asa.addEventListener("pointercancel", soltar)
  }

  const alTeclear = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const acciones: Record<string, () => void> = {
      ArrowLeft: () => fijar(actual() + PASO_TECLADO),
      ArrowRight: () => fijar(actual() - PASO_TECLADO),
      Home: () => fijar(ANCHO_MINIMO),
      End: () => fijar(maximo()),
    }
    const accion = acciones[e.key]
    if (!accion) return
    e.preventDefault()
    accion()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar el panel"
      aria-valuenow={typeof ancho === "number" ? ancho : undefined}
      aria-valuemin={ANCHO_MINIMO}
      tabIndex={0}
      title="Arrastra para cambiar el ancho · doble clic para ensanchar o estrechar"
      onPointerDown={alPulsar}
      onKeyDown={alTeclear}
      onDoubleClick={() => setAncho(ancho === "max" ? null : "max")}
      className="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none outline-none lg:block"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-marca/50 group-focus-visible:bg-marca group-active:bg-marca"
      />
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 h-10 w-1.5 -translate-1/2 rounded-full bg-border ring-1 ring-background transition-colors group-hover:bg-marca group-focus-visible:bg-marca"
      />
    </div>
  )
}

function Seccion({
  id,
  vista,
  ampliable,
  children,
}: {
  id: Vista
  vista: Vista
  /** Añade al final el botón "Ver más / Ver menos". */
  ampliable?: boolean
  children: React.ReactNode
}) {
  // Cada vista empieza en "Ver menos" y no se recuerda: al recargar vuelve a recogerse.
  const [mas, setMas] = React.useState(false)
  return (
    <ContextoResumido.Provider value={!mas}>
      <div
        role="tabpanel"
        id={`contenido-${id}`}
        aria-labelledby={`vista-${id}`}
        hidden={vista !== id}
        className="flex flex-col gap-4 p-4 @xl:p-6"
      >
        {children}
        {ampliable && (
          <Button
            variant="outline"
            size="sm"
            aria-expanded={mas}
            onClick={() => setMas(!mas)}
            className="self-center rounded-full px-4"
          >
            {mas ? (
              <ChevronUpIcon aria-hidden />
            ) : (
              <ChevronDownIcon aria-hidden />
            )}
            {mas ? "Ver menos" : "Ver más"}
          </Button>
        )}
      </div>
    </ContextoResumido.Provider>
  )
}

function Resumen({
  etl,
  navegar,
}: {
  etl: PipelineEtl
  navegar: (destino: Destino) => void
}) {
  const resumido = useResumido()
  const { config } = etl

  return (
    <section aria-labelledby="titulo-resumen" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h2
          id="titulo-resumen"
          className="text-lg font-semibold tracking-tight"
        >
          Resumen
        </h2>
        {!resumido && (
          <p className="text-sm text-muted-foreground">
            Extrae datos meteorológicos horarios, transfórmalos, límpialos,
            decide qué registros subir y cárgalos en Supabase.
          </p>
        )}
        <p className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full neu-sm px-3 py-1">
            <CalendarIcon aria-hidden className="size-3.5 text-marca" />
            {config.fechaInicio} → {config.fechaFin} (UTC)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full neu-sm px-3 py-1">
            <MapPinIcon aria-hidden className="size-3.5 text-marca" />
            {config.ciudades.length === 0
              ? "Ninguna ciudad"
              : config.ciudades.join(", ")}
          </span>
        </p>
      </header>

      <TarjetaSupabase etl={etl} className="md:hidden" />
      <TarjetasKpi etl={etl} />

      <GuiaPasos etl={etl} navegar={navegar} vistaActual="resumen" />

      <GraficoCiudades etl={etl} />

      {!resumido && (
        <div className="grid gap-6 @4xl:grid-cols-2">
          <ActividadReciente etl={etl} />
          <Cobertura etl={etl} navegar={navegar} />
          <TarjetaCalidad etl={etl} navegar={navegar} />
        </div>
      )}
    </section>
  )
}
