const enteros = new Intl.NumberFormat("es-ES")
const decimales = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 })

const unDecimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 })

export function formatoEntero(n: number) {
  return enteros.format(n)
}

/** "18,4 °C", "72 %", "3,5 mm". */
export function formatoMedida(n: number, unidad: string) {
  return `${unDecimal.format(n)} ${unidad}`
}

export function formatoPorcentaje(parte: number, total: number) {
  return total > 0 ? `${unDecimal.format((parte / total) * 100)} %` : "—"
}

export function formatoNumero(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : decimales.format(n)
}

export function formatoDuracion(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1) return "< 1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} s`
}

/** Muestra un ISO UTC como "2026-09-01 13:00 UTC" sin pasar por la zona local. */
export function formatoFechaUtc(iso: string | null | undefined) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

/** Convierte "AAAA-MM-DDTHH:MM" (input datetime-local, leído como UTC) en ISO con Z. */
export function entradaUtcAIso(valor: string) {
  if (!valor) return ""
  const ms = Date.parse(`${valor}:00Z`)
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString()
}

export function descargarJson(nombreArchivo: string, datos: unknown) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}
