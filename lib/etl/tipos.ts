/** Registro tal y como sale de la fase de transformación: puede contener huecos. */
export interface RegistroTransformado {
  /** Identificador local estable: ciudad + posición en los arrays originales. */
  idLocal: string
  ciudad: string | null
  /** Posición (0‑based) en los arrays paralelos de la respuesta original. */
  indice: number
  /** Valor recibido en hourly.time, sin modificar (para depurar). */
  fechaOriginal: unknown
  /** Fecha normalizada a ISO 8601 en UTC, o null si no se pudo interpretar. */
  fecha_hora: string | null
  temperatura_c: number | null
  humedad_pct: number | null
  precipitacion_mm: number | null
  /** Incidencias detectadas al transformar (valores null, tipos incorrectos...). */
  incidencias: string[]
}

/** Registro que ha superado todas las reglas de calidad. */
export interface RegistroValido {
  /** Clave natural: `${ciudad}|${fecha_hora}`. Coincide con la restricción UNIQUE. */
  clave: string
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export interface RegistroRechazado {
  registro: RegistroTransformado
  motivos: string[]
}

/** Lo que se envía al servidor y se guarda en Supabase. */
export interface RegistroCarga {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export type EstadoFase = "pendiente" | "en_curso" | "completada" | "error"

export interface RespuestaOpenMeteo {
  latitude?: number
  longitude?: number
  utc_offset_seconds?: number
  timezone?: string
  hourly_units?: Record<string, string>
  hourly?: Record<string, unknown>
  [clave: string]: unknown
}

export function claveDe(ciudad: string, fechaHora: string) {
  return `${ciudad}|${fechaHora}`
}
