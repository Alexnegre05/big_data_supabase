import { CIUDADES } from "@/lib/etl/ciudades"

/** Color fijo de cada ciudad (sigue a la ciudad, no a su posición en un gráfico). */
export function colorCiudad(nombre: string) {
  const i = CIUDADES.findIndex((c) => c.nombre === nombre)
  return `var(--ciudad-${(i < 0 ? 0 : i % 5) + 1})`
}

/** Rampa ordinal naranja (rango bajo → alto); en oscuro se invierte en CSS. */
export const COLORES_RANGO = [
  "var(--rango-1)",
  "var(--rango-2)",
  "var(--rango-3)",
  "var(--rango-4)",
]
