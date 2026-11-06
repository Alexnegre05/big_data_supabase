import type { Ciudad } from "./ciudades"
import type { RespuestaOpenMeteo } from "./tipos"

export const URL_ARCHIVO_OPEN_METEO =
  "https://archive-api.open-meteo.com/v1/archive"

export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const

export const MAX_DIAS_EXTRACCION = 31
/** Primer día con datos en el archivo histórico de Open-Meteo (ERA5). */
export const FECHA_MINIMA = "1940-01-01"

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/
const MS_DIA = 24 * 60 * 60 * 1000

/** Convierte "AAAA-MM-DD" en milisegundos UTC, o null si la fecha no existe. */
export function fechaAMs(fecha: string): number | null {
  if (!PATRON_FECHA.test(fecha)) return null
  const ms = Date.parse(`${fecha}T00:00:00Z`)
  if (Number.isNaN(ms)) return null
  // Date.parse acepta 2026-02-30 en algunos motores; lo descartamos comprobando el viaje de vuelta.
  if (new Date(ms).toISOString().slice(0, 10) !== fecha) return null
  return ms
}

export function hoyUtc(ahora = new Date()): string {
  return ahora.toISOString().slice(0, 10)
}

export interface ConfiguracionExtraccion {
  ciudades: string[]
  fechaInicio: string
  fechaFin: string
}

export interface ResumenVolumen {
  dias: number
  horasPorCiudad: number
  registrosPrevistos: number
  peticiones: number
}

export function calcularVolumen(
  config: ConfiguracionExtraccion
): ResumenVolumen | null {
  const inicio = fechaAMs(config.fechaInicio)
  const fin = fechaAMs(config.fechaFin)
  if (inicio === null || fin === null || fin < inicio) return null
  const dias = Math.round((fin - inicio) / MS_DIA) + 1
  return {
    dias,
    horasPorCiudad: dias * 24,
    registrosPrevistos: dias * 24 * config.ciudades.length,
    peticiones: config.ciudades.length,
  }
}

export interface ResultadoValidacion {
  errores: string[]
  avisos: string[]
}

export function validarConfiguracion(
  config: ConfiguracionExtraccion,
  hoy = hoyUtc()
): ResultadoValidacion {
  const errores: string[] = []
  const avisos: string[] = []

  if (config.ciudades.length === 0) {
    errores.push("Selecciona al menos una ciudad.")
  }

  const inicio = fechaAMs(config.fechaInicio)
  const fin = fechaAMs(config.fechaFin)
  if (inicio === null) errores.push("La fecha inicial no es válida.")
  if (fin === null) errores.push("La fecha final no es válida.")

  if (inicio !== null && fin !== null) {
    if (fin < inicio) {
      errores.push("La fecha final debe ser igual o posterior a la inicial.")
    } else {
      const dias = Math.round((fin - inicio) / MS_DIA) + 1
      if (dias > MAX_DIAS_EXTRACCION) {
        errores.push(
          `El periodo abarca ${dias} días; el máximo por extracción es ${MAX_DIAS_EXTRACCION}.`
        )
      }
    }
    if (inicio < fechaAMs(FECHA_MINIMA)!) {
      errores.push(`El archivo histórico empieza el ${FECHA_MINIMA}.`)
    }
    const msHoy = fechaAMs(hoy)!
    if (fin > msHoy) {
      errores.push("La fecha final no puede ser posterior a hoy (UTC).")
    } else if (fin > msHoy - 5 * MS_DIA) {
      avisos.push(
        "Los últimos días pueden llegar incompletos (valores null): el archivo histórico se consolida con unos días de retraso."
      )
    }
  }

  return { errores, avisos }
}

export function construirUrl(
  ciudad: Ciudad,
  fechaInicio: string,
  fechaFin: string
): string {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: fechaInicio,
    end_date: fechaFin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "UTC",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    timeformat: "iso8601",
  })
  return `${URL_ARCHIVO_OPEN_METEO}?${params}`
}

export class ErrorExtraccion extends Error {}

/** Descarga los datos de una ciudad. Lanza ErrorExtraccion con un mensaje legible. */
export async function descargarCiudad(
  ciudad: Ciudad,
  fechaInicio: string,
  fechaFin: string,
  fetchImpl: typeof fetch = fetch
): Promise<RespuestaOpenMeteo> {
  let respuesta: Response
  try {
    respuesta = await fetchImpl(construirUrl(ciudad, fechaInicio, fechaFin), {
      cache: "no-store",
    })
  } catch (error) {
    throw new ErrorExtraccion(
      `No se pudo conectar con Open-Meteo (${(error as Error).message}).`
    )
  }

  const texto = await respuesta.text()
  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    throw new ErrorExtraccion(
      `Respuesta no válida (HTTP ${respuesta.status}): no es JSON.`
    )
  }

  const objeto = cuerpo as { error?: unknown; reason?: unknown }
  if (!respuesta.ok || objeto?.error === true) {
    const motivo =
      typeof objeto?.reason === "string" ? objeto.reason : "sin detalle"
    throw new ErrorExtraccion(
      `Open-Meteo respondió HTTP ${respuesta.status}: ${motivo}.`
    )
  }
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorExtraccion("La respuesta no tiene la forma esperada.")
  }
  return cuerpo as RespuestaOpenMeteo
}
