"use client"

import { UploadCloudIcon } from "lucide-react"

import type { EstadoDescarga, PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { EstadoLote } from "@/lib/etl/carga"
import type { EstadoFase } from "@/lib/etl/tipos"

import { EstadoBadge } from "./estado-badge"
import { formatoDuracion, formatoEntero } from "./formato"

const FASE_DESCARGA: Record<EstadoDescarga, [EstadoFase, string]> = {
  pendiente: ["pendiente", "Pendiente"],
  descargando: ["en_curso", "Descargando"],
  ok: ["completada", "Descargada"],
  error: ["error", "Error"],
}

const FASE_LOTE: Record<EstadoLote, [EstadoFase, string]> = {
  pendiente: ["pendiente", "Pendiente"],
  enviando: ["en_curso", "Enviando"],
  completado: ["completada", "Subido"],
  error: ["error", "Error"],
}

interface Fila {
  id: string
  icono: React.ReactNode
  titulo: string
  detalle: string
  estado: [EstadoFase, string]
  valor: string
}

export function ActividadReciente({ etl }: { etl: PipelineEtl }) {
  const descargas: Fila[] = (etl.extraccion?.descargas ?? []).map((d) => {
    const horas = Array.isArray(d.json?.hourly?.time)
      ? (d.json.hourly.time as unknown[]).length
      : null
    return {
      id: `descarga-${d.ciudad}`,
      icono: d.ciudad.slice(0, 2).toUpperCase(),
      titulo: d.ciudad,
      detalle:
        d.estado === "error"
          ? (d.error ?? "Error")
          : `Extracción · ${formatoDuracion(d.duracionMs)}`,
      estado: FASE_DESCARGA[d.estado],
      valor: horas === null ? "—" : `${formatoEntero(horas)} h`,
    }
  })
  const lotes: Fila[] = (etl.carga?.lotes ?? []).map((l) => ({
    id: `lote-${l.numero}`,
    icono: <UploadCloudIcon className="size-4" />,
    titulo: `Lote ${l.numero}`,
    detalle:
      l.estado === "error"
        ? (l.error ?? "Error")
        : `Carga en Supabase · ${formatoDuracion(l.duracionMs)}`,
    estado: FASE_LOTE[l.estado],
    valor: `${formatoEntero(l.registros.length)} filas`,
  }))
  // Lo último que ha ocurrido (la carga) va primero.
  const filas = [...lotes, ...descargas]

  return (
    <section
      aria-labelledby="titulo-actividad"
      className="flex flex-col gap-3 rounded-3xl neu p-4 @xl:p-5"
    >
      <h2 id="titulo-actividad" className="text-base font-medium">
        Actividad reciente
      </h2>
      {filas.length === 0 ? (
        <p className="flex flex-1 items-center justify-center rounded-2xl neu-hundido p-6 text-center text-sm text-muted-foreground">
          Aquí aparecerán las descargas de cada ciudad y los lotes subidos a
          Supabase.
        </p>
      ) : (
        <ul className="flex flex-col divide-y" aria-live="polite">
          {filas.map((f) => (
            <li
              key={f.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 @xl:grid-cols-[auto_1fr_auto_5rem]"
            >
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-full neu-sm text-xs font-semibold"
              >
                {f.icono}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{f.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {f.detalle}
                </span>
              </span>
              <EstadoBadge estado={f.estado[0]} texto={f.estado[1]} />
              <span className="col-span-3 text-right text-sm font-medium tabular-nums @xl:col-span-1">
                {f.valor}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
