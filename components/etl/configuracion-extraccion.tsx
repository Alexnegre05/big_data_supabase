"use client"

import * as React from "react"
import type { DateRange } from "react-day-picker"
import { es } from "react-day-picker/locale"
import {
  AlertTriangleIcon,
  CalendarRangeIcon,
  CheckIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  DownloadCloudIcon,
  Loader2Icon,
  RotateCcwIcon,
  XCircleIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { DescargaCiudad, PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES, NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  calcularVolumen,
  fechaAMs,
  FECHA_MINIMA,
  hoyUtc,
  MAX_DIAS_EXTRACCION,
} from "@/lib/etl/extraccion"
import { cn } from "@/lib/utils"

import { colorCiudad } from "./colores"
import { EncabezadoPaso } from "./encabezado-paso"
import { formatoDuracion, formatoEntero } from "./formato"

const MS_DIA = 86_400_000
const aFecha = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * Atajos de periodo. Terminan 6 días antes de hoy porque el archivo histórico
 * tarda unos días en consolidarse (así no aparecen valores null).
 */
function atajosPeriodo(hoy = hoyUtc()) {
  const fin = fechaAMs(hoy)! - 6 * MS_DIA
  const d = new Date(fechaAMs(hoy)!)
  const inicioMesAnterior = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)
  const finMesAnterior = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)
  return [
    { titulo: "Última semana", inicio: fin - 6 * MS_DIA, fin },
    { titulo: "2 semanas", inicio: fin - 13 * MS_DIA, fin },
    { titulo: "Último mes", inicio: fin - 29 * MS_DIA, fin },
    { titulo: "Mes anterior", inicio: inicioMesAnterior, fin: finMesAnterior },
  ].map((a) => ({ ...a, inicio: aFecha(a.inicio), fin: aFecha(a.fin) }))
}

export function ConfiguracionExtraccion({ etl }: { etl: PipelineEtl }) {
  const { config, setConfig, validacion, extraccion } = etl
  const volumen = calcularVolumen(config)
  const ocupado = Boolean(extraccion?.enCurso) || Boolean(etl.carga?.enCurso)
  const atajos = atajosPeriodo()

  const alternarCiudad = (nombre: string) =>
    setConfig((c) => ({
      ...c,
      ciudades: c.ciudades.includes(nombre)
        ? c.ciudades.filter((x) => x !== nombre)
        : [...c.ciudades, nombre],
    }))

  return (
    <section
      aria-labelledby="titulo-extraccion"
      className="flex flex-col gap-4"
    >
      <EncabezadoPaso
        numero={1}
        id="titulo-extraccion"
        titulo="Opciones de la descarga"
        descripcion="Opcional: ya vienen elegidas."
      />

      <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <form
          className="flex flex-col gap-6 rounded-3xl neu p-5 @xl:p-6"
          onSubmit={(e) => {
            e.preventDefault()
            void etl.extraer()
          }}
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Ciudades</legend>
            <div className="flex items-center justify-between gap-2">
              <span aria-hidden className="text-sm font-medium">
                ¿De qué ciudades?
              </span>
              <div className="flex gap-1 text-xs whitespace-nowrap">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      ciudades: [...NOMBRES_CIUDADES],
                    }))
                  }
                  className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Marcar todas
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => setConfig((c) => ({ ...c, ciudades: [] }))}
                  className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Quitar todas
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
              {CIUDADES.map((c) => {
                const marcada = config.ciudades.includes(c.nombre)
                // Resaltada aquí o desde su marcador del mapa (estado compartido).
                const resaltada = etl.ciudadResaltada === c.nombre
                return (
                  <button
                    key={c.nombre}
                    type="button"
                    aria-pressed={marcada}
                    disabled={ocupado}
                    title={`${c.nombre}: su marcador se resalta en el mapa`}
                    onClick={() => alternarCiudad(c.nombre)}
                    onMouseEnter={() => etl.setCiudadResaltada(c.nombre)}
                    onMouseLeave={() => etl.setCiudadResaltada(null)}
                    onFocus={() => etl.setCiudadResaltada(c.nombre)}
                    onBlur={() => etl.setCiudadResaltada(null)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                      marcada
                        ? "neu-hundido font-medium"
                        : "neu-sm text-muted-foreground hover:text-foreground",
                      // Como la fila de la antigua lista del mapa: se ilumina y se eleva.
                      resaltada && "-translate-y-0.5 ring-1 ring-foreground/20"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                        // Mismo color que las casillas de la app: musgo en claro, naranja en oscuro.
                        marcada
                          ? "bg-primary text-primary-foreground"
                          : "ring-1 ring-foreground/30 ring-inset",
                        resaltada && "scale-110"
                      )}
                    >
                      {marcada && (
                        <CheckIcon className="size-3 animate-in duration-200 zoom-in-50" />
                      )}
                    </span>
                    <span className="flex-1">{c.nombre}</span>
                    {/* El color de la ciudad, como en el mapa y los gráficos. */}
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full transition-opacity",
                        !marcada && "opacity-40"
                      )}
                      style={{ background: colorCiudad(c.nombre) }}
                    />
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium">¿Qué periodo?</legend>
            <div className="flex flex-wrap gap-2">
              {atajos.map((a) => {
                const activo =
                  config.fechaInicio === a.inicio && config.fechaFin === a.fin
                return (
                  <button
                    key={a.titulo}
                    type="button"
                    aria-pressed={activo}
                    disabled={ocupado}
                    title={`${a.inicio} → ${a.fin}`}
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        fechaInicio: a.inicio,
                        fechaFin: a.fin,
                      }))
                    }
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                      activo
                        ? "neu-hundido font-medium text-marca"
                        : "neu-sm text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {a.titulo}
                  </button>
                )
              })}
            </div>
            <SelectorPeriodo
              inicio={config.fechaInicio}
              fin={config.fechaFin}
              ocupado={ocupado}
              alCambiar={(fechaInicio, fechaFin) =>
                setConfig((c) => ({ ...c, fechaInicio, fechaFin }))
              }
            />
          </fieldset>

          <div aria-live="polite" className="flex flex-col gap-3">
            <span className="text-sm font-medium">¿Cuántos datos son?</span>
            {volumen && validacion.errores.length === 0 ? (
              <>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Factor valor={config.ciudades.length} unidad="ciudades" />
                  <span className="text-muted-foreground">×</span>
                  <Factor valor={volumen.dias} unidad="días" />
                  <span className="text-muted-foreground">×</span>
                  <Factor valor={24} unidad="horas" />
                  <span className="text-muted-foreground">=</span>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {formatoEntero(volumen.registrosPrevistos)}
                  </span>
                  <span className="text-muted-foreground">
                    filas (una por ciudad y hora)
                  </span>
                </p>
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 overflow-hidden rounded-full neu-hundido p-0.5">
                    <div
                      className="h-full rounded-full bg-marca transition-[width] duration-500"
                      style={{
                        width: `${(volumen.dias / MAX_DIAS_EXTRACCION) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {volumen.dias} de {MAX_DIAS_EXTRACCION} días como máximo ·
                    se hace {volumen.peticiones}{" "}
                    {volumen.peticiones === 1 ? "petición" : "peticiones"} a
                    Open-Meteo (una por ciudad)
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Corrige la configuración para calcular el volumen.
              </p>
            )}
          </div>

          {validacion.errores.length > 0 && (
            <Alert variant="destructive">
              <XCircleIcon aria-hidden />
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {validacion.errores.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {validacion.avisos.map((a) => (
            <Alert key={a}>
              <AlertTriangleIcon aria-hidden />
              <AlertDescription>{a}</AlertDescription>
            </Alert>
          ))}

          <Button
            type="submit"
            size="lg"
            className="h-11 rounded-xl text-sm"
            disabled={ocupado || validacion.errores.length > 0}
          >
            {extraccion?.enCurso ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : (
              <DownloadCloudIcon aria-hidden />
            )}
            Descargar los datos con estas opciones
          </Button>
        </form>

        <ProgresoExtraccion etl={etl} />
      </div>
    </section>
  )
}

/**
 * El calendario trabaja con fechas locales; la configuración, con "AAAA-MM-DD".
 * Se convierte por componentes (año, mes, día) para no desplazar el día por la zona horaria.
 */
const aLocal = (fecha: string) => {
  const [a, m, d] = fecha.split("-").map(Number)
  return new Date(a, m - 1, d)
}
const aTexto = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fechaLarga = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** Un botón con el periodo que abre el calendario de rango de shadcn. */
function SelectorPeriodo({
  inicio,
  fin,
  ocupado,
  alCambiar,
}: {
  inicio: string
  fin: string
  ocupado: boolean
  alCambiar: (inicio: string, fin: string) => void
}) {
  const [abierto, setAbierto] = React.useState(false)
  // Rango a medio elegir (solo el primer día) mientras el calendario está abierto.
  const [borrador, setBorrador] = React.useState<DateRange | undefined>()
  const valido = fechaAMs(inicio) !== null && fechaAMs(fin) !== null
  const actual: DateRange | undefined = valido
    ? { from: aLocal(inicio), to: aLocal(fin) }
    : undefined
  const hoy = aLocal(hoyUtc())
  const dias = valido
    ? Math.round((fechaAMs(fin)! - fechaAMs(inicio)!) / MS_DIA) + 1
    : null

  return (
    <Popover
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v)
        setBorrador(undefined)
      }}
    >
      <PopoverTrigger
        disabled={ocupado}
        className="flex h-11 w-full items-center gap-3 rounded-xl neu-hundido px-3.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 @xl:max-w-md"
      >
        <CalendarRangeIcon aria-hidden className="size-4 text-marca" />
        <span className="flex-1 tabular-nums">
          {actual?.from && actual.to
            ? `${fechaLarga.format(actual.from)} → ${fechaLarga.format(actual.to)}`
            : "Elige un periodo"}
        </span>
        {dias !== null && dias > 0 && (
          <span className="rounded-full bg-marca/15 px-2 py-0.5 text-xs tabular-nums">
            {dias} {dias === 1 ? "día" : "días"}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-2xl p-3">
        <Calendar
          mode="range"
          locale={es}
          numberOfMonths={2}
          // Con dos meses, los días "de fuera" duplicarían el rango y confunden.
          showOutsideDays={false}
          captionLayout="dropdown"
          resetOnSelect
          max={MAX_DIAS_EXTRACCION}
          selected={borrador ?? actual}
          defaultMonth={actual?.from}
          startMonth={aLocal(FECHA_MINIMA)}
          endMonth={hoy}
          disabled={[{ before: aLocal(FECHA_MINIMA) }, { after: hoy }]}
          onSelect={(r) => {
            setBorrador(r)
            // El rango se aplica al elegir el segundo día.
            if (r?.from && r.to && borrador?.from) {
              alCambiar(aTexto(r.from), aTexto(r.to))
              setAbierto(false)
              setBorrador(undefined)
            }
          }}
        />
        <p className="px-1 text-xs text-muted-foreground">
          {borrador?.from && !borrador.to
            ? "Ahora elige el último día."
            : `Pulsa el primer día y después el último (máximo ${MAX_DIAS_EXTRACCION} días).`}
        </p>
      </PopoverContent>
    </Popover>
  )
}

function Factor({ valor, unidad }: { valor: number; unidad: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-xl neu-sm px-2.5 py-1">
      <span className="font-semibold tabular-nums">{valor}</span>
      <span className="text-xs text-muted-foreground">{unidad}</span>
    </span>
  )
}

const ICONOS_DESCARGA = {
  pendiente: { icono: CircleDashedIcon, texto: "Pendiente" },
  descargando: { icono: Loader2Icon, texto: "Descargando…" },
  ok: { icono: CheckCircle2Icon, texto: "Descargada" },
  error: { icono: XCircleIcon, texto: "Error" },
}

function ProgresoExtraccion({ etl }: { etl: PipelineEtl }) {
  const { extraccion } = etl
  // Sin extracción no hay progreso que enseñar: el formulario ocupa todo el sitio.
  if (!extraccion) return null

  const total = extraccion.descargas.length
  const procesadas = extraccion.descargas.filter(
    (d) => d.estado === "ok" || d.estado === "error"
  ).length
  const fraccion = total ? procesadas / total : 0

  return (
    <section
      aria-label="Progreso de la extracción"
      className="flex flex-col gap-5 rounded-3xl neu p-5 @xl:p-6"
    >
      <div className="flex items-center gap-4">
        <Anillo fraccion={fraccion} />
        <div>
          <p className="font-medium" aria-live="polite">
            {procesadas} de {total} ciudades procesadas
          </p>
          <p className="text-xs text-muted-foreground">
            {extraccion.config.fechaInicio} → {extraccion.config.fechaFin} (UTC)
            {extraccion.duracionMs !== null &&
              ` · ${formatoDuracion(extraccion.duracionMs)}`}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {extraccion.descargas.map((d) => (
          <FilaDescarga
            key={d.ciudad}
            descarga={d}
            ocupado={extraccion.enCurso || Boolean(etl.carga?.enCurso)}
            reintentar={() => void etl.reintentarCiudad(d.ciudad)}
          />
        ))}
      </ul>
    </section>
  )
}

/** Anillo de progreso; `pathLength` evita trigonometría (hidratación estable). */
function Anillo({ fraccion }: { fraccion: number }) {
  return (
    <div className="relative size-16 shrink-0 rounded-full neu-sm">
      <svg viewBox="0 0 40 40" aria-hidden className="size-full -rotate-90">
        <circle
          cx="20"
          cy="20"
          r="15"
          fill="none"
          strokeWidth="4"
          className="stroke-muted"
        />
        {fraccion > 0 && (
          <circle
            cx="20"
            cy="20"
            r="15"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${fraccion * 100} 100`}
            className="stroke-marca transition-[stroke-dasharray] duration-500"
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {Math.round(fraccion * 100)}%
      </span>
    </div>
  )
}

function FilaDescarga({
  descarga: d,
  ocupado,
  reintentar,
}: {
  descarga: DescargaCiudad
  ocupado: boolean
  reintentar: () => void
}) {
  const { icono: Icono, texto } = ICONOS_DESCARGA[d.estado]
  const horas = Array.isArray(d.json?.hourly?.time)
    ? (d.json.hourly.time as unknown[]).length
    : null
  return (
    <li className="flex flex-col gap-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Icono
          aria-hidden
          className={cn(
            "size-4",
            d.estado === "descargando" && "animate-spin text-marca",
            d.estado === "ok" && "text-emerald-600",
            d.estado === "error" && "text-red-600",
            d.estado === "pendiente" && "text-muted-foreground"
          )}
        />
        <span className="min-w-20 font-medium">{d.ciudad}</span>
        <span className="text-muted-foreground">{texto}</span>
        {d.estado === "ok" && horas !== null && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {formatoEntero(horas)} h · {formatoDuracion(d.duracionMs)}
          </span>
        )}
      </div>
      <div aria-hidden className="h-2 overflow-hidden rounded-full neu-hundido">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            d.estado === "descargando" && "w-2/3 animate-pulse",
            d.estado === "ok" && "w-full",
            d.estado === "error" && "w-full bg-red-600/70",
            d.estado === "pendiente" && "w-0"
          )}
          style={
            d.estado === "error"
              ? undefined
              : { background: colorCiudad(d.ciudad) }
          }
        />
      </div>
      {d.estado === "error" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-xs text-red-700 dark:text-red-300">
            {d.error}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={reintentar}
            disabled={ocupado}
          >
            <RotateCcwIcon aria-hidden />
            Reintentar {d.ciudad}
          </Button>
        </div>
      )}
    </li>
  )
}
