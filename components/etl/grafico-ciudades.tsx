"use client"

import * as React from "react"
import {
  ChartColumnBigIcon,
  ChartPieIcon,
  ChartSplineIcon,
  CloudRainIcon,
  DropletsIcon,
  ThermometerIcon,
} from "lucide-react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  distribucionPorRangos,
  escalaEje,
  METRICAS,
  resumirPorCiudad,
  seriesPorDia,
  type Metrica,
  type ResumenCiudad,
  type ResumenMetrica,
  type SeriesDiarias,
} from "@/lib/etl/resumen"
import type { RegistroValido } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"

import { colorCiudad, COLORES_RANGO } from "./colores"
import { formatoEntero, formatoMedida, formatoPorcentaje } from "./formato"
import { Segmentado } from "./segmentado"
import { Desplegable } from "./desplegable"

const ALTO = "h-56"
const TEXTURA =
  "bg-[repeating-linear-gradient(135deg,var(--color-border)_0_4px,transparent_4px_8px)]"

type TipoGrafico = "barras" | "lineas" | "quesos"

const ICONOS_METRICA = {
  temperatura: ThermometerIcon,
  humedad: DropletsIcon,
  precipitacion: CloudRainIcon,
}

const DESCRIPCIONES: Record<TipoGrafico, (agregado: string) => string> = {
  barras: (a) =>
    `Valor por ciudad con los registros válidos${a === "suma" ? " (suma de todas las horas)" : ""}.`,
  lineas: (a) =>
    `Evolución diaria (${a === "suma" ? "suma" : "media"} de cada día). Pulsa la leyenda para ocultar ciudades.`,
  quesos: () => "Reparto de las horas válidas por rangos de valor.",
}

const fechaCorta = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})
const formatoDia = (dia: string) => fechaCorta.format(new Date(`${dia}T00:00Z`))

export function GraficoCiudades({ etl }: { etl: PipelineEtl }) {
  const [metrica, setMetrica] = React.useState<Metrica>("temperatura")
  const [tipo, setTipo] = React.useState<TipoGrafico>("lineas")
  const validos = etl.procesado?.limpieza.validos
  const resumen = React.useMemo(
    () => (validos?.length ? resumirPorCiudad(validos, metrica) : null),
    [validos, metrica]
  )
  const { titulo, unidad, agregado } = METRICAS[metrica]

  return (
    <section
      aria-labelledby="titulo-grafico"
      className="flex flex-col gap-4 rounded-3xl neu p-4 @xl:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-grafico" className="text-base font-medium">
            {titulo} por ciudad
          </h2>
          <p className="text-sm text-muted-foreground">
            {DESCRIPCIONES[tipo](agregado)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmentado
            etiqueta="Métrica"
            soloIconos
            opciones={(Object.keys(METRICAS) as Metrica[]).map((m) => ({
              valor: m,
              titulo: METRICAS[m].titulo.split(" ")[0],
              icono: ICONOS_METRICA[m],
            }))}
            valor={metrica}
            alCambiar={setMetrica}
          />
          <Segmentado
            etiqueta="Tipo de gráfico"
            soloIconos
            opciones={[
              { valor: "barras", titulo: "Barras", icono: ChartColumnBigIcon },
              { valor: "lineas", titulo: "Líneas", icono: ChartSplineIcon },
              { valor: "quesos", titulo: "Quesos", icono: ChartPieIcon },
            ]}
            valor={tipo}
            alCambiar={setTipo}
          />
        </div>
      </header>

      {!resumen || !validos ? (
        <GraficoVacio />
      ) : (
        <>
          <Destacados resumen={resumen} unidad={unidad} agregado={agregado} />
          {tipo === "barras" && (
            <Barras key={metrica} ciudades={resumen.ciudades} unidad={unidad} />
          )}
          {tipo === "lineas" && (
            <Lineas validos={validos} metrica={metrica} unidad={unidad} />
          )}
          {tipo === "quesos" && <Quesos validos={validos} metrica={metrica} />}
          <table className="sr-only">
            <caption>
              {titulo} por ciudad ({unidad})
            </caption>
            <thead>
              <tr>
                <th scope="col">Ciudad</th>
                <th scope="col">Valor</th>
                <th scope="col">Horas</th>
              </tr>
            </thead>
            <tbody>
              {resumen.ciudades.map((c) => (
                <tr key={c.ciudad}>
                  <th scope="row">{c.ciudad}</th>
                  <td>{formatoMedida(c.valor, unidad)}</td>
                  <td>{c.registros}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

function Destacados({
  resumen,
  unidad,
  agregado,
}: {
  resumen: ResumenMetrica
  unidad: string
  agregado: "media" | "suma"
}) {
  const ordenadas = [...resumen.ciudades].sort((a, b) => b.valor - a.valor)
  const max = ordenadas[0]
  const min = ordenadas[ordenadas.length - 1]
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3">
      <div>
        <dt className="text-xs text-muted-foreground">
          {agregado === "media" ? "Media de todas las horas" : "Total"}
        </dt>
        <dd className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatoMedida(resumen.global, unidad)}
        </dd>
      </div>
      {ordenadas.length > 1 && (
        <>
          <div>
            <dt className="text-xs text-muted-foreground">Máximo</dt>
            <dd className="text-lg font-medium tabular-nums">
              {formatoMedida(max.valor, unidad)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {max.ciudad}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Mínimo</dt>
            <dd className="text-lg font-medium tabular-nums">
              {formatoMedida(min.valor, unidad)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {min.ciudad}
              </span>
            </dd>
          </div>
        </>
      )}
    </dl>
  )
}

/** Eje Y con etiquetas y líneas de guía compartido por barras y líneas. */
function EjeY({
  marcas,
  pct,
  children,
}: {
  marcas: number[]
  pct: (v: number) => number
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-2">
      <div aria-hidden className={cn("relative", ALTO)}>
        {marcas.map((m) => (
          <span
            key={m}
            className="absolute right-0 translate-y-1/2 text-xs text-muted-foreground tabular-nums"
            style={{ bottom: `${pct(m)}%` }}
          >
            {formatoEntero(m)}
          </span>
        ))}
      </div>
      <div className="relative">
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-x-0 top-0", ALTO)}
        >
          {marcas.map((m) => (
            <span
              key={m}
              className={cn(
                "absolute inset-x-0 border-t",
                m === 0 ? "border-foreground/30" : "border-dashed"
              )}
              style={{ bottom: `${pct(m)}%` }}
            />
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}

function Barras({
  ciudades,
  unidad,
}: {
  ciudades: ResumenCiudad[]
  unidad: string
}) {
  const [activa, setActiva] = React.useState<string | null>(null)
  const escala = escalaEje(ciudades.map((c) => c.valor))
  const pct = (v: number) =>
    ((v - escala.min) / (escala.max - escala.min)) * 100
  const cero = pct(0)

  return (
    <EjeY marcas={escala.marcas} pct={pct}>
      <div
        aria-hidden
        className="grafico-animado relative flex gap-1 @xl:gap-2"
      >
        {ciudades.map((c, i) => {
          const y = pct(c.valor)
          const esActiva = activa === c.ciudad
          return (
            <div
              key={c.ciudad}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActiva(c.ciudad)}
                onMouseLeave={() => setActiva(null)}
                onClick={() => setActiva(esActiva ? null : c.ciudad)}
                className={cn("relative w-full cursor-default", ALTO)}
              >
                <span
                  className={cn(
                    "absolute left-1/2 w-full max-w-14 -translate-x-1/2 transition-opacity",
                    c.valor >= 0 ? "rounded-t-[4px]" : "rounded-b-[4px]",
                    activa && !esActiva && "opacity-30"
                  )}
                  style={{
                    bottom: `${Math.min(cero, y)}%`,
                    height: `${Math.abs(y - cero)}%`,
                    background: colorCiudad(c.ciudad),
                    // Crecen desde el eje (hacia abajo si el valor es negativo), en cascada.
                    transformOrigin: c.valor >= 0 ? "bottom" : "top",
                    animation: `grafico-crecer 0.8s cubic-bezier(0.3, 0.7, 0.4, 1) ${i * 90}ms both`,
                  }}
                />
                {esActiva && (
                  <Aviso style={{ bottom: `${Math.max(cero, y)}%` }}>
                    <span className="block font-medium">{c.ciudad}</span>
                    <span className="block tabular-nums">
                      {formatoMedida(c.valor, unidad)}
                    </span>
                    <span className="block text-muted-foreground tabular-nums">
                      {formatoEntero(c.registros)} horas
                    </span>
                  </Aviso>
                )}
              </button>
              <span
                className={cn(
                  "truncate text-xs",
                  esActiva ? "font-medium" : "text-muted-foreground"
                )}
              >
                {c.ciudad}
              </span>
            </div>
          )
        })}
      </div>
    </EjeY>
  )
}

function Aviso({
  style,
  className,
  children,
}: {
  style?: React.CSSProperties
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-popover px-2.5 py-1.5 text-left text-xs whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-foreground/10",
        className
      )}
      style={style}
    >
      {children}
    </span>
  )
}

/**
 * Curva monótona (Fritsch–Carlson): suave como en un gráfico "spline" pero sin
 * inventar picos o valles que no están en los datos.
 */
function trazoSuave(puntos: [number, number][]) {
  const n = puntos.length
  if (n === 0) return ""
  const [x0, y0] = puntos[0]
  if (n === 1) return `M${x0},${y0}`
  const pendientes = puntos
    .slice(1)
    .map(([x, y], i) => (y - puntos[i][1]) / (x - puntos[i][0]))
  const tangentes = puntos.map((_, i) => {
    if (i === 0) return pendientes[0]
    if (i === n - 1) return pendientes[n - 2]
    const a = pendientes[i - 1]
    const b = pendientes[i]
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b)
  })
  let d = `M${x0},${y0}`
  for (let i = 0; i < n - 1; i++) {
    const [xa, ya] = puntos[i]
    const [xb, yb] = puntos[i + 1]
    const h = (xb - xa) / 3
    d += ` C${xa + h},${ya + tangentes[i] * h} ${xb - h},${yb - tangentes[i + 1] * h} ${xb},${yb}`
  }
  return d
}

/** Divide una serie en tramos continuos (los días sin datos cortan la línea). */
function tramos(valores: (number | null)[], x: (i: number) => number) {
  const resultado: [number, number][][] = []
  let actual: [number, number][] = []
  valores.forEach((v, i) => {
    if (v === null) {
      if (actual.length) resultado.push(actual)
      actual = []
    } else actual.push([x(i), v])
  })
  if (actual.length) resultado.push(actual)
  return resultado
}

function Lineas({
  validos,
  metrica,
  unidad,
}: {
  validos: readonly RegistroValido[]
  metrica: Metrica
  unidad: string
}) {
  const datos: SeriesDiarias = React.useMemo(
    () => seriesPorDia(validos, metrica),
    [validos, metrica]
  )
  const [ocultas, setOcultas] = React.useState<ReadonlySet<string>>(new Set())
  const [enfocada, setEnfocada] = React.useState<string | null>(null)
  const [indice, setIndice] = React.useState<number | null>(null)
  const idGradiente = React.useId()

  const visibles = datos.series.filter((s) => !ocultas.has(s.ciudad))
  const escala = escalaEje(
    visibles.flatMap((s) => s.valores.filter((v): v is number => v !== null))
  )
  const pct = (v: number) =>
    ((v - escala.min) / (escala.max - escala.min)) * 100
  const n = datos.dias.length
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  const y = (v: number) => 100 - pct(v)
  const base = y(Math.max(escala.min, Math.min(0, escala.max)))

  const alternar = (ciudad: string) =>
    setOcultas((o) => {
      const nuevo = new Set(o)
      if (nuevo.has(ciudad)) nuevo.delete(ciudad)
      // Siempre queda al menos una ciudad visible.
      else if (visibles.length > 1) nuevo.add(ciudad)
      return nuevo
    })

  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = (e.clientX - r.left) / r.width
    setIndice(Math.min(n - 1, Math.max(0, Math.round(f * (n - 1)))))
  }

  // Cada ~6 días una etiqueta, siempre con la primera y la última.
  const paso = Math.max(1, Math.ceil(n / 6))
  const etiquetasX = datos.dias
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % paso === 0 || i === n - 1)
    .filter(({ i }, k, arr) => i === n - 1 || arr[k + 1]?.i - i >= paso / 2)

  return (
    <div className="flex flex-col gap-3">
      <EjeY marcas={escala.marcas} pct={pct}>
        <div
          className={cn("relative touch-none", ALTO)}
          onPointerMove={mover}
          onPointerDown={mover}
          onPointerLeave={() => setIndice(null)}
        >
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            <defs>
              {visibles.map((s) => (
                <linearGradient
                  key={s.ciudad}
                  id={`${idGradiente}-${s.ciudad}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={colorCiudad(s.ciudad)}
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="100%"
                    stopColor={colorCiudad(s.ciudad)}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
              {/* Rectángulo que se ensancha: las líneas se "dibujan" de izquierda a derecha. */}
              <clipPath id={`${idGradiente}-barrido`}>
                <rect
                  x={-2}
                  y={-50}
                  width={104}
                  height={200}
                  style={{
                    transformBox: "view-box",
                    transformOrigin: "0 0",
                    animation: "grafico-barrido 1.1s ease-out both",
                  }}
                />
              </clipPath>
            </defs>
            {/* La clave reinicia la animación al cambiar de métrica. */}
            <g
              key={metrica}
              clipPath={`url(#${idGradiente}-barrido)`}
              className="grafico-animado"
            >
              {visibles.map((s) => {
                const atenuada = enfocada !== null && enfocada !== s.ciudad
                // Con muchas ciudades los rellenos se acumulan y emborronan:
                // solo se rellena la ciudad enfocada o cuando hay 1–2 visibles.
                const rellena = enfocada === s.ciudad || visibles.length <= 2
                const orden = datos.series.indexOf(s)
                return (
                  <g
                    key={s.ciudad}
                    className="transition-opacity"
                    opacity={atenuada ? 0.15 : 1}
                  >
                    <g
                      // Onda: cada ciudad sube desde la base con un rebote, en cascada.
                      style={{
                        transformBox: "view-box",
                        transformOrigin: `0 ${base}px`,
                        animation: `grafico-onda 1.3s ease-out ${orden * 110}ms both`,
                      }}
                    >
                      {tramos(s.valores, x).map((t, k) => {
                        const puntos = t.map(
                          ([px, v]) => [px, y(v)] as [number, number]
                        )
                        const linea = trazoSuave(puntos)
                        const area = `${linea} L${puntos[puntos.length - 1][0]},${base} L${puntos[0][0]},${base} Z`
                        return (
                          <React.Fragment key={k}>
                            {rellena && (
                              <path
                                d={area}
                                fill={`url(#${idGradiente}-${s.ciudad})`}
                              />
                            )}
                            <path
                              d={linea}
                              fill="none"
                              stroke={colorCiudad(s.ciudad)}
                              strokeWidth={2}
                              strokeLinecap="round"
                              vectorEffect="non-scaling-stroke"
                            />
                          </React.Fragment>
                        )
                      })}
                    </g>
                  </g>
                )
              })}
            </g>
          </svg>

          {indice !== null && (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-foreground/30"
                style={{ left: `${x(indice)}%` }}
              />
              {visibles.map((s) => {
                const v = s.valores[indice]
                return v === null ? null : (
                  <span
                    key={s.ciudad}
                    aria-hidden
                    className="pointer-events-none absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-background"
                    style={{
                      left: `${x(indice)}%`,
                      bottom: `${pct(v)}%`,
                      background: colorCiudad(s.ciudad),
                    }}
                  />
                )
              })}
              <Aviso
                className={cn(
                  "top-0 mb-0",
                  // El aviso cambia de lado para no salirse del gráfico.
                  x(indice) > 60
                    ? "-translate-x-[calc(100%+0.75rem)]"
                    : "translate-x-3"
                )}
                style={{ left: `${x(indice)}%` }}
              >
                <span className="mb-1 block font-medium">
                  {formatoDia(datos.dias[indice])}
                </span>
                {[...visibles]
                  .map((s) => ({ s, v: s.valores[indice] }))
                  .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity))
                  .map(({ s, v }) => (
                    <span
                      key={s.ciudad}
                      className="flex items-center gap-2 tabular-nums"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ background: colorCiudad(s.ciudad) }}
                      />
                      <span className="flex-1">{s.ciudad}</span>
                      <span className="font-medium">
                        {v === null ? "—" : formatoMedida(v, unidad)}
                      </span>
                    </span>
                  ))}
              </Aviso>
            </>
          )}
        </div>
        <div
          aria-hidden
          className="relative mt-2 h-4 text-xs text-muted-foreground"
        >
          {etiquetasX.map(({ d, i }) => (
            <span
              key={d}
              className={cn(
                "absolute whitespace-nowrap",
                i === 0
                  ? "left-0"
                  : i === n - 1
                    ? "right-0"
                    : "-translate-x-1/2"
              )}
              style={i === 0 || i === n - 1 ? undefined : { left: `${x(i)}%` }}
            >
              {formatoDia(d)}
            </span>
          ))}
        </div>
      </EjeY>

      <ul aria-label="Ciudades del gráfico" className="flex flex-wrap gap-2">
        {datos.series.map((s) => {
          const oculta = ocultas.has(s.ciudad)
          return (
            <li key={s.ciudad}>
              <button
                type="button"
                aria-pressed={!oculta}
                onClick={() => alternar(s.ciudad)}
                onMouseEnter={() => !oculta && setEnfocada(s.ciudad)}
                onMouseLeave={() => setEnfocada(null)}
                onFocus={() => !oculta && setEnfocada(s.ciudad)}
                onBlur={() => setEnfocada(null)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-xs transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  oculta
                    ? "neu-hundido text-muted-foreground line-through"
                    : "neu-sm"
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{
                    background: oculta ? "transparent" : colorCiudad(s.ciudad),
                    boxShadow: `inset 0 0 0 1.5px ${colorCiudad(s.ciudad)}`,
                  }}
                />
                {s.ciudad}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const RADIO = 42
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

function Quesos({
  validos,
  metrica,
}: {
  validos: readonly RegistroValido[]
  metrica: Metrica
}) {
  const [ciudad, setCiudad] = React.useState("todas")
  const [activo, setActivo] = React.useState<number | null>(null)
  const ciudades = NOMBRES_CIUDADES.filter((c) =>
    validos.some((r) => r.ciudad === c)
  )
  const rangos = React.useMemo(
    () =>
      distribucionPorRangos(
        ciudad === "todas"
          ? validos
          : validos.filter((r) => r.ciudad === ciudad),
        metrica
      ),
    [validos, metrica, ciudad]
  )
  const total = rangos.reduce((s, r) => s + r.horas, 0)
  // Hueco de 2 unidades entre porciones (como el espaciado entre barras).
  const hueco = rangos.filter((r) => r.horas > 0).length > 1 ? 2 : 0
  const largos = rangos.map((r) =>
    total ? (r.horas / total) * CIRCUNFERENCIA : 0
  )
  const porciones = rangos.map((r, i) => {
    const largo = largos[i]
    const inicio = largos.slice(0, i).reduce((s, x) => s + x, 0)
    const medio = ((inicio + largo / 2) / CIRCUNFERENCIA) * 2 * Math.PI
    return { ...r, i, largo, inicio, medio }
  })
  const destacado = activo !== null ? porciones[activo] : null

  return (
    <div className="flex flex-col items-center gap-6 @xl:flex-row @xl:items-center">
      {/* La clave reinicia la animación al cambiar de métrica o de ciudad. */}
      <div
        key={`${metrica}-${ciudad}`}
        className="grafico-animado relative size-56 shrink-0"
      >
        <svg
          viewBox="0 0 120 120"
          aria-hidden
          className="size-full -rotate-90"
          style={{
            animation: "grafico-giro 0.9s cubic-bezier(0.3, 0.7, 0.4, 1) both",
          }}
        >
          <circle
            cx="60"
            cy="60"
            r={RADIO}
            fill="none"
            strokeWidth={14}
            className="stroke-muted"
          />
          {porciones.map((p) =>
            p.largo <= hueco ? null : (
              <circle
                key={p.etiqueta}
                cx="60"
                cy="60"
                r={RADIO}
                fill="none"
                stroke={COLORES_RANGO[p.i]}
                strokeWidth={activo === p.i ? 18 : 14}
                strokeDasharray={`${p.largo - hueco} ${CIRCUNFERENCIA}`}
                strokeDashoffset={-p.inicio}
                strokeLinecap="butt"
                className="cursor-pointer transition-all duration-200"
                style={{
                  // Cada porción se dibuja cuando termina la anterior: un barrido en círculo.
                  animation: `grafico-porcion ${Math.max(250, (p.largo / CIRCUNFERENCIA) * 900)}ms ease-out ${300 + (p.inicio / CIRCUNFERENCIA) * 900}ms both`,
                }}
                opacity={activo !== null && activo !== p.i ? 0.35 : 1}
                onMouseEnter={() => setActivo(p.i)}
                onMouseLeave={() => setActivo(null)}
              />
            )
          )}
        </svg>
        {/* Porcentajes fuera del anillo, como en la referencia. */}
        {porciones.map((p) =>
          p.horas / (total || 1) < 0.06 ? null : (
            <span
              key={p.etiqueta}
              aria-hidden
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums"
              style={{
                left: `${50 + 49 * Math.sin(p.medio)}%`,
                top: `${50 - 49 * Math.cos(p.medio)}%`,
                animation: `grafico-aparecer 0.4s ease-out ${1000 + p.i * 80}ms both`,
              }}
            >
              {Math.round((p.horas / total) * 100)}%
            </span>
          )
        )}
        <p className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatoEntero(destacado ? destacado.horas : total)}
          </span>
          <span className="max-w-24 text-xs text-muted-foreground">
            {destacado ? destacado.etiqueta : "horas válidas"}
          </span>
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center gap-2 self-start text-sm">
          <span aria-hidden className="text-muted-foreground">
            Ciudad
          </span>
          <Desplegable
            etiqueta="Ciudad del gráfico de quesos"
            opciones={[
              { valor: "todas", titulo: "Todas las ciudades" },
              ...ciudades.map((c) => ({
                valor: c,
                titulo: c,
                color: colorCiudad(c),
              })),
            ]}
            valor={ciudad}
            alCambiar={setCiudad}
          />
        </div>
        <ul className="flex flex-col gap-1.5">
          {porciones.map((p) => (
            <li key={p.etiqueta}>
              <button
                type="button"
                onMouseEnter={() => setActivo(p.i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(p.i)}
                onBlur={() => setActivo(null)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  activo === p.i ? "neu-hundido" : "hover:bg-muted/50"
                )}
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-sm"
                  style={{ background: COLORES_RANGO[p.i] }}
                />
                <span className="flex-1">{p.etiqueta}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatoEntero(p.horas)} h
                </span>
                <span className="w-14 text-right font-medium tabular-nums">
                  {formatoPorcentaje(p.horas, total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Barras fantasma con textura mientras no hay datos (como en un esqueleto). */
function GraficoVacio() {
  const alturas = [45, 70, 55, 85, 40]
  return (
    <div className="relative">
      <div aria-hidden className={cn("flex items-end gap-2 px-12", ALTO)}>
        {alturas.map((h, i) => (
          <span
            key={i}
            className={cn("mx-auto w-full max-w-14 rounded-t-[4px]", TEXTURA)}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <span className="rounded-xl neu-sm px-3 py-2">
          Pulsa «Descargar los datos» (pestaña Extracción) para ver el resumen
          por ciudad.
        </span>
      </p>
    </div>
  )
}
