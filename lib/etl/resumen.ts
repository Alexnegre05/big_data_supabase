import type { RegistroRechazado, RegistroValido } from "./tipos"

export type Metrica = "temperatura" | "humedad" | "precipitacion"

export const METRICAS: Record<
  Metrica,
  { titulo: string; unidad: string; agregado: "media" | "suma" }
> = {
  temperatura: { titulo: "Temperatura media", unidad: "°C", agregado: "media" },
  humedad: { titulo: "Humedad media", unidad: "%", agregado: "media" },
  precipitacion: {
    titulo: "Precipitación total",
    unidad: "mm",
    agregado: "suma",
  },
}

const CAMPOS = {
  temperatura: "temperatura_c",
  humedad: "humedad_pct",
  precipitacion: "precipitacion_mm",
} as const

export interface ResumenCiudad {
  ciudad: string
  valor: number
  registros: number
}

export interface ResumenMetrica {
  ciudades: ResumenCiudad[]
  /** Media de todas las horas o suma total, según la métrica. */
  global: number
}

/** Agrega los registros válidos por ciudad, en el orden en que aparecen. */
export function resumirPorCiudad(
  validos: readonly RegistroValido[],
  metrica: Metrica
): ResumenMetrica {
  const campo = CAMPOS[metrica]
  const media = METRICAS[metrica].agregado === "media"
  const acumulado = new Map<string, { suma: number; registros: number }>()
  let suma = 0
  for (const r of validos) {
    const a = acumulado.get(r.ciudad) ?? { suma: 0, registros: 0 }
    a.suma += r[campo]
    a.registros++
    acumulado.set(r.ciudad, a)
    suma += r[campo]
  }
  const ciudades = [...acumulado].map(([ciudad, a]) => ({
    ciudad,
    registros: a.registros,
    valor: media ? a.suma / a.registros : a.suma,
  }))
  const global = media ? (validos.length ? suma / validos.length : 0) : suma
  return { ciudades, global }
}

export interface SerieCiudad {
  ciudad: string
  /** Un valor por día de `dias`; null si la ciudad no tiene horas válidas ese día. */
  valores: (number | null)[]
}

export interface SeriesDiarias {
  /** Días "AAAA-MM-DD" (UTC) en orden cronológico. */
  dias: string[]
  series: SerieCiudad[]
}

/** Agrega por ciudad y día (media o suma según la métrica) para el gráfico de líneas. */
export function seriesPorDia(
  validos: readonly RegistroValido[],
  metrica: Metrica
): SeriesDiarias {
  const campo = CAMPOS[metrica]
  const media = METRICAS[metrica].agregado === "media"
  const acumulado = new Map<string, Map<string, { suma: number; n: number }>>()
  const dias = new Set<string>()
  for (const r of validos) {
    const dia = r.fecha_hora.slice(0, 10)
    dias.add(dia)
    const porDia = acumulado.get(r.ciudad) ?? new Map()
    const a = porDia.get(dia) ?? { suma: 0, n: 0 }
    a.suma += r[campo]
    a.n++
    porDia.set(dia, a)
    acumulado.set(r.ciudad, porDia)
  }
  const ordenados = [...dias].sort()
  return {
    dias: ordenados,
    series: [...acumulado].map(([ciudad, porDia]) => ({
      ciudad,
      valores: ordenados.map((d) => {
        const a = porDia.get(d)
        return a ? (media ? a.suma / a.n : a.suma) : null
      }),
    })),
  }
}

/** Rangos ordenados de cada métrica; cada uno incluye los valores < `hasta`. */
export const RANGOS: Record<Metrica, { etiqueta: string; hasta: number }[]> = {
  temperatura: [
    { etiqueta: "< 10 °C", hasta: 10 },
    { etiqueta: "10–20 °C", hasta: 20 },
    { etiqueta: "20–30 °C", hasta: 30 },
    { etiqueta: "≥ 30 °C", hasta: Infinity },
  ],
  humedad: [
    { etiqueta: "< 40 %", hasta: 40 },
    { etiqueta: "40–60 %", hasta: 60 },
    { etiqueta: "60–80 %", hasta: 80 },
    { etiqueta: "≥ 80 %", hasta: Infinity },
  ],
  precipitacion: [
    { etiqueta: "Sin lluvia", hasta: 0.1 },
    { etiqueta: "0,1–1 mm", hasta: 1 },
    { etiqueta: "1–4 mm", hasta: 4 },
    { etiqueta: "≥ 4 mm", hasta: Infinity },
  ],
}

/** Cuántas horas válidas caen en cada rango de la métrica (parte de un todo). */
export function distribucionPorRangos(
  validos: readonly RegistroValido[],
  metrica: Metrica
): { etiqueta: string; horas: number }[] {
  const campo = CAMPOS[metrica]
  const rangos = RANGOS[metrica]
  const horas = rangos.map(() => 0)
  for (const r of validos) {
    horas[rangos.findIndex((x) => r[campo] < x.hasta)]++
  }
  return rangos.map((x, i) => ({ etiqueta: x.etiqueta, horas: horas[i] }))
}

export interface Escala {
  min: number
  max: number
  marcas: number[]
}

/** Eje con valores "redondos" que incluye siempre el cero. */
export function escalaEje(valores: readonly number[], divisiones = 4): Escala {
  const bajo = Math.min(0, ...valores)
  const alto = Math.max(0, ...valores)
  if (bajo === alto) return { min: 0, max: 1, marcas: [0, 1] }

  const bruto = (alto - bajo) / divisiones
  const magnitud = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].find((m) => m * magnitud >= bruto)! * magnitud
  const min = Math.floor(bajo / paso) * paso
  const max = Math.ceil(alto / paso) * paso
  const marcas: number[] = []
  // Redondeo para evitar acumulaciones del tipo 0.30000000000000004.
  for (let v = min; v <= max + paso / 2; v += paso) {
    marcas.push(Number(v.toPrecision(12)))
  }
  return { min, max, marcas }
}

/** Quita los valores concretos para agrupar motivos del mismo tipo. */
function normalizarMotivo(motivo: string) {
  return motivo
    .split(":")[0]
    .replace(/\s*\(.*\)$/, "")
    .trim()
}

/** Motivos de rechazo más frecuentes (una fila puede aportar varios). */
export function motivosFrecuentes(
  rechazados: readonly RegistroRechazado[],
  limite = 3
): { motivo: string; total: number }[] {
  const conteo = new Map<string, number>()
  for (const r of rechazados) {
    for (const m of r.motivos) {
      const motivo = normalizarMotivo(m)
      conteo.set(motivo, (conteo.get(motivo) ?? 0) + 1)
    }
  }
  return [...conteo]
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo))
    .slice(0, limite)
}
