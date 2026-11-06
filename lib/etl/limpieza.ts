import { motivosDeCalidad } from "./reglas"
import {
  claveDe,
  type RegistroRechazado,
  type RegistroTransformado,
  type RegistroValido,
} from "./tipos"

export interface ResultadoLimpieza {
  validos: RegistroValido[]
  rechazados: RegistroRechazado[]
  duplicados: number
}

/**
 * Aplica las reglas de calidad y elimina duplicados por (ciudad, fecha_hora).
 *
 * Criterio de duplicados: primero se valida cada fila y después, entre las
 * filas válidas, se conserva la PRIMERA aparición en el orden de extracción
 * (orden de ciudades y posición en los arrays). Las siguientes se rechazan
 * indicando qué fila se ha conservado. Así una fila inválida nunca "tapa"
 * a una válida con la misma clave.
 */
export function limpiar(registros: RegistroTransformado[]): ResultadoLimpieza {
  const validos: RegistroValido[] = []
  const rechazados: RegistroRechazado[] = []
  const conservados = new Map<string, RegistroTransformado>()
  let duplicados = 0

  for (const r of registros) {
    const motivos = motivosDeCalidad(r)
    if (motivos.length > 0) {
      rechazados.push({ registro: r, motivos })
      continue
    }

    const clave = claveDe(r.ciudad!, r.fecha_hora!)
    const previo = conservados.get(clave)
    if (previo) {
      duplicados++
      rechazados.push({
        registro: r,
        motivos: [
          `Duplicado de ciudad + fecha_hora: se conserva la primera aparición (posición ${previo.indice})`,
        ],
      })
      continue
    }

    conservados.set(clave, r)
    validos.push({
      clave,
      ciudad: r.ciudad!,
      fecha_hora: r.fecha_hora!,
      temperatura_c: r.temperatura_c!,
      humedad_pct: r.humedad_pct!,
      precipitacion_mm: r.precipitacion_mm!,
    })
  }

  return { validos, rechazados, duplicados }
}
