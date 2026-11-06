import { limpiar, type ResultadoLimpieza } from "./limpieza"
import type { RegistroTransformado, RespuestaOpenMeteo } from "./tipos"
import {
  transformarCiudad,
  type DiagnosticoTransformacion,
} from "./transformacion"

export interface ResultadoTransformacionGlobal {
  registros: RegistroTransformado[]
  diagnosticos: DiagnosticoTransformacion[]
  duracionMs: number
}

export interface ResultadoProcesamiento {
  transformacion: ResultadoTransformacionGlobal
  limpieza: ResultadoLimpieza & { duracionMs: number }
}

/**
 * Transforma y limpia a partir de los JSON originales guardados por ciudad.
 * Como siempre se parte de las respuestas originales (una por ciudad), volver
 * a procesar tras reintentar una ciudad nunca duplica registros.
 */
export function procesarRespuestas(
  respuestas: { ciudad: string; json: RespuestaOpenMeteo }[],
  ahora: () => number = () => performance.now()
): ResultadoProcesamiento {
  const inicioT = ahora()
  const registros: RegistroTransformado[] = []
  const diagnosticos: DiagnosticoTransformacion[] = []
  for (const { ciudad, json } of respuestas) {
    const r = transformarCiudad(ciudad, json)
    registros.push(...r.registros)
    diagnosticos.push(r.diagnostico)
  }
  const duracionT = ahora() - inicioT

  const inicioL = ahora()
  const limpieza = limpiar(registros)
  const duracionL = ahora() - inicioL

  return {
    transformacion: { registros, diagnosticos, duracionMs: duracionT },
    limpieza: { ...limpieza, duracionMs: duracionL },
  }
}

/** Ejecuta fn y mide su duración real (fuera del cuerpo de los componentes). */
export function medir<T>(fn: () => T): { valor: T; duracionMs: number } {
  const inicio = performance.now()
  const valor = fn()
  return { valor, duracionMs: performance.now() - inicio }
}
