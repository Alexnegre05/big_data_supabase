"use client"

import * as React from "react"
import { ArrowUpRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import { calcularVolumen } from "@/lib/etl/extraccion"
import { cn } from "@/lib/utils"

import type { Destino } from "./aplicacion-etl"
import { colorCiudad } from "./colores"
import { formatoEntero } from "./formato"

/** Contorno simplificado de la península ibérica (longitud, latitud). */
const PENINSULA: [number, number][] = [
  [-9.3, 42.9],
  [-8.4, 43.4],
  [-7.9, 43.8],
  [-6.5, 43.6],
  [-5.7, 43.6],
  [-3.8, 43.5],
  [-2.9, 43.4],
  [-1.8, 43.4],
  [-1.4, 43.1],
  [0, 42.7],
  [1.4, 42.6],
  [2.4, 42.4],
  [3.3, 42.3],
  [3.2, 41.9],
  [2.2, 41.4],
  [1.2, 41.1],
  [0.9, 40.7],
  [0, 39.9],
  [-0.3, 39.4],
  [0.2, 38.7],
  [-0.5, 38.3],
  [-0.7, 37.6],
  [-1.3, 37.5],
  [-2.2, 36.7],
  [-4.4, 36.7],
  [-5.4, 36.1],
  [-5.6, 36],
  [-6.3, 36.5],
  [-6.9, 37.2],
  [-7.9, 37],
  [-9, 37],
  [-8.9, 38],
  [-9.5, 38.7],
  [-9.4, 39.4],
  [-8.7, 41.2],
  [-8.9, 41.9],
  [-8.8, 42.2],
]
const MALLORCA: [number, number][] = [
  [2.35, 39.55],
  [2.75, 39.95],
  [3.2, 39.85],
  [3.45, 39.65],
  [3.1, 39.3],
  [2.7, 39.45],
]
const MENORCA: [number, number][] = [
  [3.8, 40],
  [4.3, 39.95],
  [4.25, 39.82],
  [3.85, 39.92],
]

// Equirectangular corregida por cos(40°) para que la península no se vea ancha.
const proyectar = ([lon, lat]: [number, number]): [number, number] => [
  Math.round((lon + 9.8) * 0.766 * 100) / 10,
  Math.round((44.1 - lat) * 100) / 10,
]
const trazo = (puntos: [number, number][]) =>
  `M${puntos.map((p) => proyectar(p).join(",")).join("L")}Z`

export function Cobertura({
  etl,
  navegar,
}: {
  etl: PipelineEtl
  navegar: (destino: Destino) => void
}) {
  const { config, extraccion, procesado } = etl
  const [activa, setActiva] = React.useState<string | null>(null)
  const volumen = calcularVolumen(config)
  const descargadas = new Set(
    extraccion?.descargas.filter((d) => d.estado === "ok").map((d) => d.ciudad)
  )
  const pct = Math.round((config.ciudades.length / CIUDADES.length) * 100)

  return (
    <section
      aria-labelledby="titulo-cobertura"
      className="relative flex min-h-72 flex-col gap-4 overflow-hidden rounded-3xl neu p-4 @xl:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <h2 id="titulo-cobertura" className="text-base font-medium">
          Cobertura
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full neu-sm"
          aria-label="Ir al mapa"
          onClick={() => navegar("mapa")}
        >
          <ArrowUpRightIcon aria-hidden />
        </Button>
      </header>

      <dl className="relative z-10 flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Ciudades</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">
            {pct}%
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              {config.ciudades.length}/{CIUDADES.length}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Periodo</dt>
          <dd className="font-medium tabular-nums">
            {volumen ? `${volumen.dias} días` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Horas extraídas</dt>
          <dd className="font-medium tabular-nums">
            {procesado
              ? formatoEntero(procesado.transformacion.registros.length)
              : "—"}
          </dd>
        </div>
      </dl>

      {/* Silueta en la esquina, como un mapa decorativo pero con las ciudades vivas. */}
      <div className="absolute right-3 bottom-3 w-[66%] max-w-72">
        <svg viewBox="-2 -2 112 86" className="w-full overflow-visible">
          <g
            className="fill-foreground/12 stroke-foreground/25"
            strokeWidth={0.4}
          >
            <path d={trazo(PENINSULA)} />
            <path d={trazo(MALLORCA)} />
            <path d={trazo(MENORCA)} />
          </g>
          {CIUDADES.map((c) => {
            const [x, y] = proyectar([c.longitud, c.latitud])
            const incluida = config.ciudades.includes(c.nombre)
            const esActiva = activa === c.nombre
            return (
              <g
                key={c.nombre}
                onMouseEnter={() => setActiva(c.nombre)}
                onMouseLeave={() => setActiva(null)}
                className="cursor-default"
              >
                <title>
                  {`${c.nombre}: ${incluida ? "incluida" : "no incluida"}${descargadas.has(c.nombre) ? " · descargada" : ""}`}
                </title>
                <circle cx={x} cy={y} r={6} fill="transparent" />
                {descargadas.has(c.nombre) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={4.5}
                    fill={colorCiudad(c.nombre)}
                    className="origin-center animate-ping [animation-duration:2.5s]"
                    style={{ transformOrigin: `${x}px ${y}px` }}
                    opacity={0.35}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={esActiva ? 3.6 : 2.6}
                  fill={incluida ? colorCiudad(c.nombre) : "var(--background)"}
                  stroke={
                    incluida ? "var(--background)" : colorCiudad(c.nombre)
                  }
                  strokeWidth={incluida ? 1 : 1.2}
                  className="transition-all"
                />
                <text
                  x={x + 5}
                  y={y + 1.6}
                  className={cn(
                    "fill-foreground text-[4.5px] transition-opacity",
                    esActiva ? "opacity-100" : "opacity-0"
                  )}
                >
                  {c.nombre}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
