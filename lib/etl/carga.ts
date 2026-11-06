import { claveDe, type RegistroCarga } from "./tipos"

/** Máximo de registros por petición al servidor (y por upsert en Supabase). */
export const TAMANO_LOTE = 500

export type EstadoLote = "pendiente" | "enviando" | "completado" | "error"

export interface Lote {
  numero: number
  registros: readonly RegistroCarga[]
  estado: EstadoLote
  /** Filas que Supabase devolvió como insertadas o actualizadas. */
  procesados: number | null
  error: string | null
  duracionMs: number | null
  intentos: number
}

export interface ResultadoEnvio {
  procesados: number
}

export type EnviarLote = (
  registros: readonly RegistroCarga[]
) => Promise<ResultadoEnvio>

/**
 * Congela una copia del conjunto seleccionado y la divide en lotes. A partir
 * de aquí los cambios de filtros o selección no afectan a la carga.
 */
export function crearLotes(
  registros: readonly RegistroCarga[],
  tamano = TAMANO_LOTE
): Lote[] {
  const copia = registros.map((r) => Object.freeze({ ...r }))
  const lotes: Lote[] = []
  for (let i = 0; i < copia.length; i += tamano) {
    lotes.push({
      numero: lotes.length + 1,
      registros: Object.freeze(copia.slice(i, i + tamano)),
      estado: "pendiente",
      procesados: null,
      error: null,
      duracionMs: null,
      intentos: 0,
    })
  }
  return lotes
}

/**
 * Envía en serie los lotes indicados (por defecto, los que no están
 * completados). Un fallo no detiene el resto: cada lote es un upsert
 * independiente e idempotente. Devuelve el estado final de todos los lotes.
 */
export async function ejecutarLotes(
  lotes: readonly Lote[],
  enviar: EnviarLote,
  alActualizar: (lote: Lote) => void = () => {},
  ahora: () => number = () => performance.now()
): Promise<Lote[]> {
  const resultado = [...lotes]
  for (let i = 0; i < resultado.length; i++) {
    const lote = resultado[i]
    if (lote.estado === "completado") continue

    const enviando: Lote = {
      ...lote,
      estado: "enviando",
      error: null,
      intentos: lote.intentos + 1,
    }
    resultado[i] = enviando
    alActualizar(enviando)

    const inicio = ahora()
    try {
      const { procesados } = await enviar(lote.registros)
      resultado[i] = {
        ...enviando,
        estado: "completado",
        procesados,
        duracionMs: ahora() - inicio,
      }
    } catch (error) {
      resultado[i] = {
        ...enviando,
        estado: "error",
        procesados: null,
        error: (error as Error).message,
        duracionMs: ahora() - inicio,
      }
    }
    alActualizar(resultado[i])
  }
  return resultado
}

export interface ResumenCarga {
  total: number
  completados: number
  fallidos: number
  pendientes: number
  lotesFallidos: number
}

export function resumirCarga(lotes: readonly Lote[]): ResumenCarga {
  const resumen: ResumenCarga = {
    total: 0,
    completados: 0,
    fallidos: 0,
    pendientes: 0,
    lotesFallidos: 0,
  }
  for (const l of lotes) {
    resumen.total += l.registros.length
    if (l.estado === "completado") resumen.completados += l.registros.length
    else if (l.estado === "error") {
      resumen.fallidos += l.registros.length
      resumen.lotesFallidos++
    } else resumen.pendientes += l.registros.length
  }
  return resumen
}

export interface ClaveRegistro {
  ciudad: string
  fecha_hora: string
}

export type ConsultarExistentes = (
  claves: ClaveRegistro[]
) => Promise<ClaveRegistro[]>

export interface ResultadoVerificacion {
  comprobadas: number
  encontradas: number
  faltantes: ClaveRegistro[]
}

/** Normaliza el timestamp que devuelve Postgres ("…+00:00") al formato ISO con Z. */
export function normalizarFecha(valor: string) {
  return new Date(valor).toISOString()
}

/** Comprueba, en lotes, que las claves enviadas existen en destino. */
export async function verificarClaves(
  claves: readonly ClaveRegistro[],
  consultar: ConsultarExistentes,
  tamano = TAMANO_LOTE
): Promise<ResultadoVerificacion> {
  const faltantes: ClaveRegistro[] = []
  let encontradas = 0
  for (let i = 0; i < claves.length; i += tamano) {
    const lote = claves.slice(i, i + tamano)
    const existentes = await consultar(lote)
    const conjunto = new Set(
      existentes.map((e) => claveDe(e.ciudad, normalizarFecha(e.fecha_hora)))
    )
    for (const c of lote) {
      if (conjunto.has(claveDe(c.ciudad, normalizarFecha(c.fecha_hora)))) {
        encontradas++
      } else {
        faltantes.push(c)
      }
    }
  }
  return { comprobadas: claves.length, encontradas, faltantes }
}
