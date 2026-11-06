"use client"

import * as React from "react"
import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { RespuestaOpenMeteo } from "@/lib/etl/tipos"

import { descargarJson } from "./formato"
import { SinDatos } from "./sin-datos"
import { Selector } from "./selector"

const MUESTRA = 24

/**
 * Representación compacta del JSON: los metadatos completos y, de cada array
 * horario, solo las primeras posiciones. El JSON íntegro se puede descargar.
 */
function resumirJson(json: RespuestaOpenMeteo): string {
  const { hourly, ...resto } = json
  const lineas = JSON.stringify(resto, null, 2).split("\n")
  lineas.pop() // cierre "}"
  if (hourly && typeof hourly === "object") {
    lineas[lineas.length - 1] += ","
    lineas.push('  "hourly": {')
    const entradas = Object.entries(hourly)
    entradas.forEach(([clave, valor], i) => {
      const coma = i < entradas.length - 1 ? "," : ""
      if (Array.isArray(valor)) {
        const muestra = valor.slice(0, MUESTRA).map((v) => JSON.stringify(v))
        const resto = valor.length - muestra.length
        lineas.push(
          `    "${clave}": [${muestra.join(", ")}${resto > 0 ? `, … (+${resto} más)` : ""}]${coma}   // ${valor.length} elementos`
        )
      } else {
        lineas.push(`    "${clave}": ${JSON.stringify(valor)}${coma}`)
      }
    })
    lineas.push("  }")
  }
  lineas.push("}")
  return lineas.join("\n")
}

export function PestanaJson({ etl }: { etl: PipelineEtl }) {
  const descargas = etl.extraccion?.descargas ?? []
  const [elegida, setElegida] = React.useState<string>("")
  const actual =
    descargas.find((d) => d.ciudad === elegida) ?? descargas[0] ?? null
  const correctas = descargas.filter((d) => d.json)

  if (!etl.extraccion) {
    return (
      <SinDatos>
        Pulsa «Descargar los datos» (pestaña Extracción) para ver aquí las
        respuestas originales.
      </SinDatos>
    )
  }

  const periodo = `${etl.extraccion.config.fechaInicio}_${etl.extraccion.config.fechaFin}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Ciudad
          <Selector
            value={actual?.ciudad ?? ""}
            onChange={(e) => setElegida(e.target.value)}
          >
            {descargas.map((d) => (
              <option key={d.ciudad} value={d.ciudad}>
                {d.ciudad}
                {d.estado === "error" ? " (error)" : ""}
                {d.estado === "descargando" ? " (descargando…)" : ""}
              </option>
            ))}
          </Selector>
        </label>
        {actual?.json && (
          <Button
            variant="outline"
            onClick={() =>
              descargarJson(
                `open-meteo_${actual.ciudad}_${periodo}.json`,
                actual.json
              )
            }
          >
            <DownloadIcon aria-hidden />
            Descargar JSON de {actual.ciudad}
          </Button>
        )}
        {correctas.length > 1 && (
          <Button
            variant="outline"
            onClick={() =>
              descargarJson(
                `open-meteo_todas_${periodo}.json`,
                Object.fromEntries(correctas.map((d) => [d.ciudad, d.json]))
              )
            }
          >
            <DownloadIcon aria-hidden />
            Descargar todos ({correctas.length})
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Respuesta tal cual la devolvió la API, conservada en memoria durante
        esta sesión. Fíjate en que <code>hourly</code> contiene{" "}
        <strong>arrays paralelos</strong>: la posición <em>i</em> de cada array
        corresponde a la hora <code>time[i]</code>. Se muestran las primeras{" "}
        {MUESTRA} posiciones; descarga el archivo para verlo completo.
      </p>

      {actual?.json ? (
        <pre className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {resumirJson(actual.json)}
        </pre>
      ) : actual?.estado === "error" ? (
        <SinDatos>
          La descarga de {actual.ciudad} falló: {actual.error}
        </SinDatos>
      ) : (
        <SinDatos>Esperando la respuesta de {actual?.ciudad}…</SinDatos>
      )}
    </div>
  )
}
