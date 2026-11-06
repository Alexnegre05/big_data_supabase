"use client"

import * as React from "react"
import { ArrowUpRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { motivosFrecuentes } from "@/lib/etl/resumen"
import { cn } from "@/lib/utils"

import type { Destino } from "./aplicacion-etl"
import { formatoEntero, formatoPorcentaje } from "./formato"

/**
 * Arco semicircular. `pathLength=100` permite expresar el relleno en % sin
 * trigonometría (que difiere entre Node y el navegador y rompería la hidratación).
 */
function Arco({
  radio,
  fraccion,
  className,
}: {
  radio: number
  fraccion: number | null
  className: string
}) {
  const d = `M${100 - radio},100 A${radio},${radio} 0 0 1 ${100 + radio},100`
  return (
    <>
      <path
        d={d}
        fill="none"
        strokeWidth={14}
        strokeLinecap="round"
        className="stroke-muted"
      />
      {fraccion !== null && fraccion > 0 && (
        <path
          d={d}
          pathLength={100}
          fill="none"
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${fraccion * 100} 100`}
          className={cn(
            "transition-[stroke-dasharray] duration-700",
            className
          )}
        />
      )}
    </>
  )
}

/** Medidor de dos arcos concéntricos: calidad (fuera) y selección (dentro). */
function Medidor({
  calidad,
  seleccion,
}: {
  calidad: number | null
  seleccion: number | null
}) {
  return (
    <svg viewBox="0 0 200 110" aria-hidden className="w-full max-w-64">
      {/* chart-2 es musgo en ambos temas, así el arco exterior no se confunde con el naranja. */}
      <Arco radio={88} fraccion={calidad} className="stroke-chart-2" />
      <Arco radio={64} fraccion={seleccion} className="stroke-marca" />
    </svg>
  )
}

export function TarjetaCalidad({
  etl,
  navegar,
}: {
  etl: PipelineEtl
  navegar: (destino: Destino) => void
}) {
  const limpieza = etl.procesado?.limpieza
  const validos = limpieza?.validos.length ?? 0
  const rechazados = limpieza?.rechazados.length ?? 0
  const total = validos + rechazados
  const listos = etl.conjuntoCarga.registros.length
  const motivos = React.useMemo(
    () => (limpieza ? motivosFrecuentes(limpieza.rechazados) : []),
    [limpieza]
  )

  return (
    <section
      aria-labelledby="titulo-calidad"
      className="flex flex-col gap-4 rounded-3xl neu p-4 @xl:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="titulo-calidad" className="text-base font-medium">
            Calidad de los datos
          </h2>
          <p className="text-sm text-muted-foreground">
            Porcentaje de registros que pasan la limpieza.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full neu-sm"
          aria-label="Ver los registros rechazados"
          onClick={() => navegar("rechazados")}
        >
          <ArrowUpRightIcon aria-hidden />
        </Button>
      </header>

      <div className="relative mx-auto flex w-full justify-center">
        <Medidor
          calidad={total > 0 ? validos / total : null}
          seleccion={validos > 0 ? listos / validos : null}
        />
        <p className="absolute inset-x-0 bottom-0 text-center">
          <span className="block text-3xl font-semibold tracking-tight tabular-nums">
            {formatoPorcentaje(validos, total)}
          </span>
          <span className="text-xs text-muted-foreground">válidos</span>
        </p>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-full bg-chart-2" />
          <span className="flex-1">Válidos sobre extraídos</span>
          <span className="font-medium tabular-nums">
            {formatoPorcentaje(validos, total)}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-full bg-marca" />
          <span className="flex-1">Listos para cargar</span>
          <span className="font-medium tabular-nums">
            {formatoPorcentaje(listos, validos)}
          </span>
        </li>
      </ul>

      <dl className="grid grid-cols-2 gap-2 text-center">
        <div>
          <dt className="text-xs text-muted-foreground">Válidos</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {limpieza ? formatoEntero(validos) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Rechazados</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {limpieza ? formatoEntero(rechazados) : "—"}
          </dd>
        </div>
      </dl>

      {limpieza && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <h3 className="text-sm font-medium">Motivos de rechazo</h3>
          {motivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún registro rechazado.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {motivos.map((m) => (
                <li key={m.motivo} className="flex justify-between gap-3">
                  <span className="truncate" title={m.motivo}>
                    {m.motivo}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatoEntero(m.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
