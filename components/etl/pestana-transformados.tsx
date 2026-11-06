"use client"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { RegistroTransformado } from "@/lib/etl/tipos"

import { formatoEntero, formatoFechaUtc } from "./formato"
import { SinDatos } from "./sin-datos"
import { TablaPaginada, type Columna } from "./tabla-paginada"

/** Muestra null de forma visible: nunca como 0 ni como celda vacía. */
export function Valor({ v }: { v: number | null }) {
  if (v === null) {
    return <span className="text-red-700 italic dark:text-red-300">null</span>
  }
  return <>{v.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</>
}

export const COLUMNAS_TRANSFORMADO: Columna<RegistroTransformado>[] = [
  {
    id: "ciudad",
    titulo: "Ciudad",
    celda: (r) => r.ciudad ?? <Valor v={null} />,
  },
  { id: "indice", titulo: "Posición", celda: (r) => r.indice, numerica: true },
  {
    id: "original",
    titulo: "time (original)",
    celda: (r) => (
      <code className="text-xs">
        {JSON.stringify(r.fechaOriginal) ?? "ausente"}
      </code>
    ),
  },
  {
    id: "fecha",
    titulo: "fecha_hora (UTC)",
    celda: (r) =>
      r.fecha_hora ? formatoFechaUtc(r.fecha_hora) : <Valor v={null} />,
  },
  {
    id: "temp",
    titulo: "temperatura_c (°C)",
    celda: (r) => <Valor v={r.temperatura_c} />,
    numerica: true,
  },
  {
    id: "hum",
    titulo: "humedad_pct (%)",
    celda: (r) => <Valor v={r.humedad_pct} />,
    numerica: true,
  },
  {
    id: "prec",
    titulo: "precipitacion_mm (mm)",
    celda: (r) => <Valor v={r.precipitacion_mm} />,
    numerica: true,
  },
  {
    id: "incidencias",
    titulo: "Incidencias",
    celda: (r) =>
      r.incidencias.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="text-xs whitespace-normal">
          {r.incidencias.join("; ")}
        </span>
      ),
  },
]

export function PestanaTransformados({ etl }: { etl: PipelineEtl }) {
  const t = etl.procesado?.transformacion
  if (!t) {
    return <SinDatos>Aún no hay datos transformados.</SinDatos>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          Comprobación de arrays por ciudad
        </h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Longitud de cada array de la respuesta original
            </caption>
            <thead className="bg-muted/50 text-left">
              <tr className="border-b">
                <th scope="col" className="p-2 font-medium">
                  Ciudad
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  time
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  temperature_2m
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  relative_humidity_2m
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  precipitation
                </th>
                <th scope="col" className="p-2 font-medium">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {t.diagnosticos.map((d) => (
                <tr key={d.ciudad} className="border-b last:border-0">
                  <td className="p-2">{d.ciudad}</td>
                  {(
                    [
                      "time",
                      "temperature_2m",
                      "relative_humidity_2m",
                      "precipitation",
                    ] as const
                  ).map((k) => (
                    <td key={k} className="p-2 text-right tabular-nums">
                      {d.longitudes[k] === null
                        ? "falta"
                        : formatoEntero(d.longitudes[k])}
                    </td>
                  ))}
                  <td className="p-2 text-xs">
                    {d.coherente
                      ? "✓ Longitudes coherentes"
                      : "✗ Longitudes distintas"}
                    {d.avisos.length > 0 && (
                      <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                        {d.avisos.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Un registro por ciudad y hora. La hora original (sin zona) se interpreta
        explícitamente como UTC usando <code>utc_offset_seconds</code>. Los
        valores ausentes se muestran como <em>null</em>: no se convierten en 0.
      </p>
      <TablaPaginada
        filas={t.registros}
        columnas={COLUMNAS_TRANSFORMADO}
        claveFila={(r) => r.idLocal}
        etiqueta="Datos transformados"
        vacio="No hay registros."
      />
    </div>
  )
}
