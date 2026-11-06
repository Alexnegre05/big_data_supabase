"use client"

import * as React from "react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { RegistroRechazado } from "@/lib/etl/tipos"

import { formatoEntero, formatoFechaUtc } from "./formato"
import { Valor } from "./pestana-transformados"
import { SinDatos } from "./sin-datos"
import { TablaPaginada, type Columna } from "./tabla-paginada"

const COLUMNAS: Columna<RegistroRechazado>[] = [
  {
    id: "ciudad",
    titulo: "Ciudad",
    celda: ({ registro: r }) => r.ciudad ?? <Valor v={null} />,
  },
  {
    id: "indice",
    titulo: "Posición",
    celda: ({ registro: r }) => r.indice,
    numerica: true,
  },
  {
    id: "fecha",
    titulo: "fecha_hora (UTC)",
    celda: ({ registro: r }) =>
      r.fecha_hora ? (
        formatoFechaUtc(r.fecha_hora)
      ) : (
        <code className="text-xs">
          {JSON.stringify(r.fechaOriginal) ?? "ausente"}
        </code>
      ),
  },
  {
    id: "temp",
    titulo: "Temperatura (°C)",
    celda: ({ registro: r }) => <Valor v={r.temperatura_c} />,
    numerica: true,
  },
  {
    id: "hum",
    titulo: "Humedad (%)",
    celda: ({ registro: r }) => <Valor v={r.humedad_pct} />,
    numerica: true,
  },
  {
    id: "prec",
    titulo: "Precipitación (mm)",
    celda: ({ registro: r }) => <Valor v={r.precipitacion_mm} />,
    numerica: true,
  },
  {
    id: "motivo",
    titulo: "Motivo del rechazo",
    celda: ({ motivos }) => (
      <span className="text-xs whitespace-normal">{motivos.join("; ")}</span>
    ),
  },
]

export function PestanaRechazados({ etl }: { etl: PipelineEtl }) {
  const limpieza = etl.procesado?.limpieza

  const porMotivo = React.useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const r of limpieza?.rechazados ?? []) {
      for (const m of r.motivos) {
        // Agrupa "humedad_pct fuera de rango (105)" y similares por su texto base.
        const base = m.replace(/\s*\(.*\)$/, "")
        cuenta.set(base, (cuenta.get(base) ?? 0) + 1)
      }
    }
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1])
  }, [limpieza])

  if (!limpieza) {
    return <SinDatos>Aún no se ha ejecutado la limpieza.</SinDatos>
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Descartes por <strong>calidad</strong>: faltan datos, valores fuera de
        rango o duplicados. Las filas que solo quedan fuera por tus filtros no
        aparecen aquí (están en «Válidos → Excluidos por filtros»). Duplicados:
        se conserva la primera aparición válida de cada ciudad + fecha_hora.
      </p>
      {porMotivo.length > 0 && (
        <ul
          className="flex flex-wrap gap-2 text-xs"
          aria-label="Rechazos por motivo"
        >
          {porMotivo.map(([motivo, n]) => (
            <li key={motivo} className="rounded-md border px-2 py-1">
              {motivo}:{" "}
              <strong className="tabular-nums">{formatoEntero(n)}</strong>
            </li>
          ))}
        </ul>
      )}
      <TablaPaginada
        filas={limpieza.rechazados}
        columnas={COLUMNAS}
        claveFila={(r) => r.registro.idLocal}
        etiqueta="Registros rechazados"
        vacio="Ningún registro rechazado: todos los registros superan las reglas de calidad."
      />
    </div>
  )
}
