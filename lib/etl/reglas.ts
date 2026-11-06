/**
 * Reglas de calidad compartidas por la limpieza (navegador) y la validación
 * del servidor antes de escribir en Supabase. Mantenerlas en un único sitio
 * garantiza que ambos lados aplican exactamente los mismos criterios.
 */

const PATRON_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

export function esFechaUtcValida(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    PATRON_ISO_UTC.test(valor) &&
    !Number.isNaN(Date.parse(valor))
  )
}

function esNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor)
}

export interface CamposMedicion {
  ciudad: unknown
  fecha_hora: unknown
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
}

/** Devuelve la lista de motivos por los que el registro no es válido (vacía si lo es). */
export function motivosDeCalidad(r: CamposMedicion): string[] {
  const motivos: string[] = []

  if (typeof r.ciudad !== "string" || r.ciudad.trim() === "") {
    motivos.push("Sin ciudad")
  }
  if (!esFechaUtcValida(r.fecha_hora)) {
    motivos.push("Sin fecha_hora válida")
  }

  if (!esNumeroFinito(r.temperatura_c)) {
    motivos.push("Falta temperatura_c")
  }
  // Sin umbrales para la temperatura: un valor extremo puede ser real.

  if (!esNumeroFinito(r.humedad_pct)) {
    motivos.push("Falta humedad_pct")
  } else if (r.humedad_pct < 0 || r.humedad_pct > 100) {
    motivos.push(`humedad_pct fuera de rango 0–100 (${r.humedad_pct})`)
  }

  if (!esNumeroFinito(r.precipitacion_mm)) {
    motivos.push("Falta precipitacion_mm")
  } else if (r.precipitacion_mm < 0) {
    motivos.push(`precipitacion_mm negativa (${r.precipitacion_mm})`)
  }

  return motivos
}
