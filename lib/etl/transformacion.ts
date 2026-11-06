import type { RegistroTransformado, RespuestaOpenMeteo } from "./tipos"

/** Correspondencia entre las variables de Open-Meteo y las columnas normalizadas. */
export const MAPA_VARIABLES = {
  temperature_2m: "temperatura_c",
  relative_humidity_2m: "humedad_pct",
  precipitation: "precipitacion_mm",
} as const

type VariableApi = keyof typeof MAPA_VARIABLES

export interface DiagnosticoTransformacion {
  ciudad: string
  /** Longitud de cada array recibido; null si el array no existe. */
  longitudes: Record<"time" | VariableApi, number | null>
  coherente: boolean
  /** Problemas a nivel de respuesta (no de fila). */
  avisos: string[]
  /** Desplazamiento UTC declarado por la API, en segundos. */
  desfaseUtc: number
  registrosGenerados: number
}

export interface ResultadoTransformacion {
  registros: RegistroTransformado[]
  diagnostico: DiagnosticoTransformacion
}

const PATRON_HORA_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * Open-Meteo devuelve "AAAA-MM-DDTHH:MM" sin zona horaria. La hora es local
 * respecto a utc_offset_seconds, así que la convertimos a UTC de forma explícita
 * en lugar de dejar que el navegador la interprete con su zona local.
 */
export function interpretarFechaUtc(
  valor: unknown,
  desfaseSegundos: number
): string | null {
  if (typeof valor !== "string") return null
  const m = PATRON_HORA_LOCAL.exec(valor)
  if (!m) return null
  const [anio, mes, dia, hora, minuto] = m.slice(1).map(Number)
  const ms = Date.UTC(anio, mes - 1, dia, hora, minuto)
  const comprobacion = new Date(ms)
  // Rechaza fechas imposibles como 2026-02-30T25:00, que Date.UTC "desborda".
  if (
    comprobacion.getUTCFullYear() !== anio ||
    comprobacion.getUTCMonth() !== mes - 1 ||
    comprobacion.getUTCDate() !== dia ||
    comprobacion.getUTCHours() !== hora ||
    comprobacion.getUTCMinutes() !== minuto
  ) {
    return null
  }
  return new Date(ms - desfaseSegundos * 1000).toISOString()
}

function describirTipo(valor: unknown): string {
  if (valor === null) return "null"
  if (valor === undefined) return "ausente"
  if (valor === "") return "cadena vacía"
  if (typeof valor === "string") return `texto "${valor.slice(0, 20)}"`
  if (typeof valor === "number") return `número no finito (${valor})`
  return `tipo ${typeof valor}`
}

/** Devuelve el número si es finito; nunca convierte null, "" o ausentes en 0. */
export function leerNumero(
  valor: unknown,
  columna: string,
  incidencias: string[]
): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor
  incidencias.push(`${columna}: ${describirTipo(valor)}`)
  return null
}

function comoArray(valor: unknown): unknown[] | null {
  return Array.isArray(valor) ? valor : null
}

/** Convierte los arrays paralelos de una ciudad en un registro por hora. */
export function transformarCiudad(
  ciudad: string,
  respuesta: RespuestaOpenMeteo
): ResultadoTransformacion {
  const avisos: string[] = []
  const hourly =
    respuesta.hourly && typeof respuesta.hourly === "object"
      ? respuesta.hourly
      : null
  if (!hourly) avisos.push("La respuesta no contiene el bloque 'hourly'.")

  let desfaseUtc = 0
  if (typeof respuesta.utc_offset_seconds === "number") {
    desfaseUtc = respuesta.utc_offset_seconds
    if (desfaseUtc !== 0) {
      avisos.push(
        `La API declara un desfase de ${desfaseUtc} s; se ha restado para obtener UTC.`
      )
    }
  } else {
    avisos.push(
      "La respuesta no declara utc_offset_seconds; se asume UTC porque así se solicitó."
    )
  }

  const time = comoArray(hourly?.time)
  const series = {
    temperature_2m: comoArray(hourly?.temperature_2m),
    relative_humidity_2m: comoArray(hourly?.relative_humidity_2m),
    precipitation: comoArray(hourly?.precipitation),
  }

  const longitudes = {
    time: time?.length ?? null,
    temperature_2m: series.temperature_2m?.length ?? null,
    relative_humidity_2m: series.relative_humidity_2m?.length ?? null,
    precipitation: series.precipitation?.length ?? null,
  }
  for (const [nombre, longitud] of Object.entries(longitudes)) {
    if (hourly && longitud === null) {
      avisos.push(`Falta el array hourly.${nombre}.`)
    }
  }
  const valoresLongitud = Object.values(longitudes)
  const coherente =
    valoresLongitud.every((l) => l !== null) &&
    new Set(valoresLongitud).size === 1
  if (hourly && !coherente) {
    avisos.push(
      "Los arrays no tienen la misma longitud: las posiciones sin valor se marcan como ausentes y se rechazarán en la limpieza."
    )
  }

  // Recorremos hasta la longitud máxima para no perder ningún valor en silencio.
  const n = Math.max(0, ...valoresLongitud.map((l) => l ?? 0))
  const nombreCiudad = ciudad.trim() === "" ? null : ciudad
  const registros: RegistroTransformado[] = []

  for (let i = 0; i < n; i++) {
    const incidencias: string[] = []
    const fechaOriginal = time?.[i]
    const fecha_hora = interpretarFechaUtc(fechaOriginal, desfaseUtc)
    if (fecha_hora === null) {
      incidencias.push(`fecha_hora: ${describirTipo(fechaOriginal)}`)
    }
    registros.push({
      idLocal: `${ciudad}#${i}`,
      ciudad: nombreCiudad,
      indice: i,
      fechaOriginal,
      fecha_hora,
      temperatura_c: leerNumero(
        series.temperature_2m?.[i],
        "temperatura_c",
        incidencias
      ),
      humedad_pct: leerNumero(
        series.relative_humidity_2m?.[i],
        "humedad_pct",
        incidencias
      ),
      precipitacion_mm: leerNumero(
        series.precipitation?.[i],
        "precipitacion_mm",
        incidencias
      ),
      incidencias,
    })
  }

  return {
    registros,
    diagnostico: {
      ciudad,
      longitudes,
      coherente,
      avisos,
      desfaseUtc,
      registrosGenerados: registros.length,
    },
  }
}
