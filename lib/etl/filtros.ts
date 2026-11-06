import type { RegistroCarga, RegistroValido } from "./tipos"

/** Los valores numéricos se guardan como texto, tal y como llegan de los inputs. "" = sin límite. */
export interface Filtros {
  /** Vacío = todas las ciudades. */
  ciudades: string[]
  /** "AAAA-MM-DDTHH:MM" interpretado en UTC. */
  desde: string
  hasta: string
  temperaturaMin: string
  temperaturaMax: string
  humedadMin: string
  humedadMax: string
  precipitacionMin: string
  precipitacionMax: string
  soloLluvia: boolean
}

export const FILTROS_INICIALES: Filtros = {
  ciudades: [],
  desde: "",
  hasta: "",
  temperaturaMin: "",
  temperaturaMax: "",
  humedadMin: "",
  humedadMax: "",
  precipitacionMin: "",
  precipitacionMax: "",
  soloLluvia: false,
}

export type CampoOrden =
  "ciudad" | "fecha_hora" | "temperatura_c" | "humedad_pct" | "precipitacion_mm"

export interface Orden {
  campo: CampoOrden
  direccion: "asc" | "desc"
}

export const ORDEN_INICIAL: Orden = { campo: "fecha_hora", direccion: "asc" }

export const ETIQUETAS_ORDEN: Record<CampoOrden, string> = {
  ciudad: "Ciudad",
  fecha_hora: "Fecha y hora (UTC)",
  temperatura_c: "Temperatura (°C)",
  humedad_pct: "Humedad (%)",
  precipitacion_mm: "Precipitación (mm)",
}

const PATRON_FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** Convierte "AAAA-MM-DDTHH:MM" (sin zona) en milisegundos, tratándolo como UTC. */
export function fechaHoraUtcAMs(valor: string): number | null {
  if (!PATRON_FECHA_HORA.test(valor)) return null
  const ms = Date.parse(`${valor}:00Z`)
  return Number.isNaN(ms) ? null : ms
}

function leerLimite(valor: string): number | null | "invalido" {
  const limpio = valor.trim().replace(",", ".")
  if (limpio === "") return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : "invalido"
}

interface LimitesNumericos {
  min: number | null
  max: number | null
}

export interface FiltrosInterpretados {
  ciudades: Set<string> | null
  desde: number | null
  hasta: number | null
  temperatura: LimitesNumericos
  humedad: LimitesNumericos
  precipitacion: LimitesNumericos
  soloLluvia: boolean
  errores: string[]
}

/** Valida los filtros. Un límite con errores se ignora y se informa. */
export function interpretarFiltros(f: Filtros): FiltrosInterpretados {
  const errores: string[] = []

  const rango = (
    etiqueta: string,
    minTexto: string,
    maxTexto: string
  ): LimitesNumericos => {
    let min = leerLimite(minTexto)
    let max = leerLimite(maxTexto)
    if (min === "invalido") {
      errores.push(`${etiqueta}: el mínimo no es un número.`)
      min = null
    }
    if (max === "invalido") {
      errores.push(`${etiqueta}: el máximo no es un número.`)
      max = null
    }
    if (min !== null && max !== null && min > max) {
      errores.push(`${etiqueta}: el mínimo es mayor que el máximo.`)
    }
    return { min, max }
  }

  const fecha = (etiqueta: string, valor: string) => {
    if (valor === "") return null
    const ms = fechaHoraUtcAMs(valor)
    if (ms === null) errores.push(`${etiqueta}: fecha y hora no válida.`)
    return ms
  }

  const desde = fecha("Desde", f.desde)
  const hasta = fecha("Hasta", f.hasta)
  if (desde !== null && hasta !== null && desde > hasta) {
    errores.push("El inicio del intervalo es posterior al final.")
  }

  return {
    ciudades: f.ciudades.length > 0 ? new Set(f.ciudades) : null,
    desde,
    hasta,
    temperatura: rango("Temperatura", f.temperaturaMin, f.temperaturaMax),
    humedad: rango("Humedad", f.humedadMin, f.humedadMax),
    precipitacion: rango(
      "Precipitación",
      f.precipitacionMin,
      f.precipitacionMax
    ),
    soloLluvia: f.soloLluvia,
    errores,
  }
}

function dentro(valor: number, { min, max }: LimitesNumericos) {
  return (min === null || valor >= min) && (max === null || valor <= max)
}

export function cumpleFiltros(
  r: RegistroValido,
  f: FiltrosInterpretados
): boolean {
  if (f.ciudades && !f.ciudades.has(r.ciudad)) return false
  if (f.desde !== null || f.hasta !== null) {
    const ms = Date.parse(r.fecha_hora)
    if (f.desde !== null && ms < f.desde) return false
    if (f.hasta !== null && ms > f.hasta) return false
  }
  if (!dentro(r.temperatura_c, f.temperatura)) return false
  if (!dentro(r.humedad_pct, f.humedad)) return false
  if (!dentro(r.precipitacion_mm, f.precipitacion)) return false
  if (f.soloLluvia && !(r.precipitacion_mm > 0)) return false
  return true
}

export function aplicarFiltros(
  validos: RegistroValido[],
  filtros: FiltrosInterpretados
): RegistroValido[] {
  return validos.filter((r) => cumpleFiltros(r, filtros))
}

function comparar(a: RegistroValido, b: RegistroValido, campo: CampoOrden) {
  const va = a[campo]
  const vb = b[campo]
  if (typeof va === "number" && typeof vb === "number") return va - vb
  return String(va).localeCompare(String(vb), "es")
}

/**
 * Ordena sin modificar el array original. Desempata siempre por ciudad y
 * fecha para que el orden sea determinista (importante para la vista previa).
 */
export function ordenar(
  registros: RegistroValido[],
  orden: Orden
): RegistroValido[] {
  const signo = orden.direccion === "asc" ? 1 : -1
  return [...registros].sort(
    (a, b) =>
      signo * comparar(a, b, orden.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

export function paginar<T>(lista: T[], pagina: number, tamano: number) {
  const totalPaginas = Math.max(1, Math.ceil(lista.length / tamano))
  const actual = Math.min(Math.max(1, pagina), totalPaginas)
  const inicio = (actual - 1) * tamano
  return {
    filas: lista.slice(inicio, inicio + tamano),
    pagina: actual,
    totalPaginas,
    desde: lista.length === 0 ? 0 : inicio + 1,
    hasta: Math.min(inicio + tamano, lista.length),
  }
}

/**
 * automatico: la selección es siempre todo lo que cumple los filtros y se
 * recalcula al cambiarlos. manual: la selección es la que marca el usuario.
 */
export type ModoSeleccion = "automatico" | "manual"

export function resolverSeleccion(
  modo: ModoSeleccion,
  seleccionManual: ReadonlySet<string>,
  filtradosOrdenados: RegistroValido[]
): ReadonlySet<string> {
  return modo === "automatico"
    ? new Set(filtradosOrdenados.map((r) => r.clave))
    : seleccionManual
}

export interface ConjuntoCarga {
  /** Filas que se enviarán, en el orden elegido. */
  registros: RegistroValido[]
  /** Claves seleccionadas que ya no cumplen los filtros (o ya no existen). */
  seleccionadosFueraDeFiltro: number
}

/**
 * Pipeline de selección: válidos → filtros → ordenación → selección.
 * Solo se cargan las filas seleccionadas que siguen cumpliendo los filtros.
 */
export function calcularConjuntoCarga(
  filtradosOrdenados: RegistroValido[],
  seleccion: ReadonlySet<string>
): ConjuntoCarga {
  const registros = filtradosOrdenados.filter((r) => seleccion.has(r.clave))
  return {
    registros,
    seleccionadosFueraDeFiltro: seleccion.size - registros.length,
  }
}

export function aRegistroCarga(r: RegistroValido): RegistroCarga {
  return {
    ciudad: r.ciudad,
    fecha_hora: r.fecha_hora,
    temperatura_c: r.temperatura_c,
    humedad_pct: r.humedad_pct,
    precipitacion_mm: r.precipitacion_mm,
  }
}
