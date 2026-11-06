import { NOMBRES_CIUDADES } from "./ciudades"
import { TAMANO_LOTE, type ClaveRegistro } from "./carga"
import { esFechaUtcValida, motivosDeCalidad } from "./reglas"
import type { RegistroCarga } from "./tipos"

/** Tamaño máximo del cuerpo JSON aceptado por los endpoints de escritura. */
export const MAX_BYTES_PETICION = 256 * 1024

const CAMPOS = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
] as const

export type Validacion<T> =
  { ok: true; datos: T } | { ok: false; error: string; detalles?: string[] }

/** Lee el cuerpo respetando el límite de tamaño aunque falte Content-Length. */
export async function leerJsonLimitado(
  request: Request
): Promise<Validacion<unknown>> {
  const declarado = Number(request.headers.get("content-length") ?? "0")
  if (declarado > MAX_BYTES_PETICION) {
    return { ok: false, error: "La petición supera el tamaño máximo." }
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > MAX_BYTES_PETICION) {
    return { ok: false, error: "La petición supera el tamaño máximo." }
  }
  try {
    return { ok: true, datos: JSON.parse(texto) }
  } catch {
    return { ok: false, error: "El cuerpo no es JSON válido." }
  }
}

function lista(cuerpo: unknown, campo: string): Validacion<unknown[]> {
  const valor = (cuerpo as Record<string, unknown> | null)?.[campo]
  if (!Array.isArray(valor)) {
    return { ok: false, error: `Se esperaba un array '${campo}'.` }
  }
  if (valor.length === 0) {
    return { ok: false, error: `El array '${campo}' está vacío.` }
  }
  if (valor.length > TAMANO_LOTE) {
    return {
      ok: false,
      error: `Máximo ${TAMANO_LOTE} elementos por petición (recibidos ${valor.length}).`,
    }
  }
  return { ok: true, datos: valor }
}

export function validarLoteCarga(cuerpo: unknown): Validacion<RegistroCarga[]> {
  const entrada = lista(cuerpo, "registros")
  if (!entrada.ok) return entrada

  const detalles: string[] = []
  const registros: RegistroCarga[] = []
  const claves = new Set<string>()

  entrada.datos.forEach((item, i) => {
    if (typeof item !== "object" || item === null) {
      detalles.push(`#${i}: no es un objeto`)
      return
    }
    const r = item as Record<string, unknown>
    const extra = Object.keys(r).filter(
      (k) => !(CAMPOS as readonly string[]).includes(k)
    )
    const motivos = motivosDeCalidad({
      ciudad: r.ciudad,
      fecha_hora: r.fecha_hora,
      temperatura_c: r.temperatura_c,
      humedad_pct: r.humedad_pct,
      precipitacion_mm: r.precipitacion_mm,
    })
    if (extra.length > 0)
      motivos.push(`campos no permitidos: ${extra.join(", ")}`)
    if (typeof r.ciudad === "string" && !NOMBRES_CIUDADES.includes(r.ciudad)) {
      motivos.push(`ciudad desconocida "${r.ciudad}"`)
    }
    if (motivos.length > 0) {
      detalles.push(`#${i}: ${motivos.join("; ")}`)
      return
    }
    const clave = `${r.ciudad}|${r.fecha_hora}`
    // Postgres rechaza un upsert que toca dos veces la misma fila en una sentencia.
    if (claves.has(clave)) {
      detalles.push(`#${i}: clave duplicada dentro del lote (${clave})`)
      return
    }
    claves.add(clave)
    registros.push({
      ciudad: r.ciudad as string,
      fecha_hora: new Date(r.fecha_hora as string).toISOString(),
      temperatura_c: r.temperatura_c as number,
      humedad_pct: r.humedad_pct as number,
      precipitacion_mm: r.precipitacion_mm as number,
    })
  })

  if (detalles.length > 0) {
    return {
      ok: false,
      error: `${detalles.length} registro(s) no superan la validación del servidor.`,
      detalles: detalles.slice(0, 20),
    }
  }
  return { ok: true, datos: registros }
}

export function validarClaves(cuerpo: unknown): Validacion<ClaveRegistro[]> {
  const entrada = lista(cuerpo, "claves")
  if (!entrada.ok) return entrada
  const claves: ClaveRegistro[] = []
  for (const [i, item] of entrada.datos.entries()) {
    const c = item as Record<string, unknown> | null
    if (
      typeof c?.ciudad !== "string" ||
      !NOMBRES_CIUDADES.includes(c.ciudad) ||
      !esFechaUtcValida(c.fecha_hora)
    ) {
      return { ok: false, error: `Clave #${i} no válida.` }
    }
    claves.push({ ciudad: c.ciudad, fecha_hora: c.fecha_hora })
  }
  return { ok: true, datos: claves }
}
