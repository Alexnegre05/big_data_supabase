import type { ClaveRegistro, ResultadoEnvio } from "./carga"
import type { RegistroCarga } from "./tipos"

async function leerRespuesta<T>(respuesta: Response): Promise<T> {
  let cuerpo: unknown = null
  try {
    cuerpo = await respuesta.json()
  } catch {
    // cuerpo vacío o no JSON
  }
  if (!respuesta.ok) {
    const c = cuerpo as { error?: string; detalles?: string[] } | null
    const detalle = c?.detalles?.length ? ` ${c.detalles.join(" · ")}` : ""
    throw new Error(`${c?.error ?? `HTTP ${respuesta.status}`}${detalle}`)
  }
  return cuerpo as T
}

export interface EstadoSupabase {
  configurado: boolean
  faltan: string[]
  tablaAccesible: boolean
  totalFilas?: number
  mensaje: string
}

export async function consultarEstado(): Promise<EstadoSupabase> {
  try {
    const r = await fetch("/api/mediciones?limit=1", { cache: "no-store" })
    if (!r.ok) throw new Error("No se pudo acceder a Supabase")
    const data = await r.json()
    return { configurado: true, faltan: [], tablaAccesible: true, totalFilas: data.total, mensaje: "Conexión con Supabase disponible." }
  } catch {
    return { configurado: false, faltan: [], tablaAccesible: false, mensaje: "No se pudo comprobar la conexión con Supabase." }
  }
}

export async function enviarLote(
  registros: readonly RegistroCarga[]
): Promise<ResultadoEnvio> {
  const respuesta = await fetch("/api/mediciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: registros }),
  })
  const data = await respuesta.json()
  if (!respuesta.ok && respuesta.status !== 207) throw new Error(data.error ?? `HTTP ${respuesta.status}`)
  if (data.failedRows?.length) throw new Error(`${data.failedRows.length} filas no se pudieron verificar`)
  return { procesados: data.processed ?? 0 }
}

export async function consultarExistentes(
  claves: ClaveRegistro[]
): Promise<ClaveRegistro[]> {
  const encontrados: ClaveRegistro[] = []
  for (const ciudad of [...new Set(claves.map((c) => c.ciudad))]) {
    const grupo = claves.filter((c) => c.ciudad === ciudad)
    const fechas = grupo.map((c) => c.fecha_hora).sort()
    const existentes = new Set<string>()
    let page = 0
    let total = 0
    do {
      const params = new URLSearchParams({ ciudad, desde: fechas[0], hasta: fechas.at(-1)!, limit: "100", page: String(page) })
      const respuesta = await fetch(`/api/mediciones?${params}`, { cache: "no-store" })
      const data = await leerRespuesta<{ rows: ClaveRegistro[]; total: number }>(respuesta)
      total = data.total
      for (const row of data.rows) existentes.add(`${row.ciudad}|${new Date(row.fecha_hora).toISOString()}`)
      page++
    } while (page * 100 < total)
    encontrados.push(...grupo.filter((c) => existentes.has(`${c.ciudad}|${new Date(c.fecha_hora).toISOString()}`)))
  }
  return encontrados
}

export interface FilaPersistida extends RegistroCarga {
  id: number
  importado_en: string
}

export interface ParametrosDatos {
  ciudad: string
  desde: string
  hasta: string
  orden: string
  direccion: "asc" | "desc"
  pagina: number
  tamano: number
}

export async function consultarDatos(
  p: ParametrosDatos
): Promise<{ filas: FilaPersistida[]; total: number }> {
  const params = new URLSearchParams({
    sort: p.orden,
    ascending: String(p.direccion === "asc"),
    page: String(p.pagina - 1),
    limit: String(p.tamano),
  })
  if (p.ciudad) params.set("ciudad", p.ciudad)
  if (p.desde) params.set("desde", p.desde)
  if (p.hasta) params.set("hasta", p.hasta)
  const data = await leerRespuesta<{ rows: FilaPersistida[]; total: number }>(
    await fetch(`/api/mediciones?${params}`, { cache: "no-store" })
  )
  return { filas: data.rows.map((r, i) => ({ ...r, id: i, importado_en: "" })), total: data.total }
}
