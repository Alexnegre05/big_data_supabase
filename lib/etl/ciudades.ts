export interface Ciudad {
  nombre: string
  latitud: number
  longitud: number
}

export const CIUDADES: readonly Ciudad[] = [
  { nombre: "Barcelona", latitud: 41.3874, longitud: 2.1686 },
  { nombre: "Madrid", latitud: 40.4168, longitud: -3.7038 },
  { nombre: "Sevilla", latitud: 37.3891, longitud: -5.9845 },
  { nombre: "Bilbao", latitud: 43.263, longitud: -2.935 },
  { nombre: "Valencia", latitud: 39.4699, longitud: -0.3763 },
]

export const NOMBRES_CIUDADES = CIUDADES.map((c) => c.nombre)

export function buscarCiudad(nombre: string): Ciudad | undefined {
  return CIUDADES.find((c) => c.nombre === nombre)
}
