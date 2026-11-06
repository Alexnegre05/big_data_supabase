import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import {
  distribucionPorRangos,
  METRICAS,
  motivosFrecuentes,
  resumirPorCiudad,
  seriesPorDia,
  type Metrica,
} from "./resumen"

const CAMPOS = {
  temperatura: "temperatura_c",
  humedad: "humedad_pct",
  precipitacion: "precipitacion_mm",
} as const

const redondear = (valor: number | null) =>
  valor === null ? null : Math.round(valor * 100) / 100

function datosGraficas(etl: PipelineEtl) {
  const validos = etl.procesado?.limpieza.validos ?? []
  return Object.keys(METRICAS).map((clave) => {
    const metrica = clave as Metrica
    const resumen = resumirPorCiudad(validos, metrica)
    const mediasPorCiudad = new Map<string, number>()
    for (const ciudad of resumen.ciudades) {
      const valores = validos.filter((fila) => fila.ciudad === ciudad.ciudad)
      if (valores.length) {
        const suma = valores.reduce((total, fila) => total + fila[CAMPOS[metrica]], 0)
        mediasPorCiudad.set(ciudad.ciudad, suma / valores.length)
      }
    }
    const mediaEntreCiudades = mediasPorCiudad.size
      ? [...mediasPorCiudad.values()].reduce((suma, valor) => suma + valor, 0) /
        mediasPorCiudad.size
      : 0
    const desviaciones = [...mediasPorCiudad].map(([ciudad, media]) => ({
      ciudad,
      media: redondear(media),
      desviacionPct:
        mediaEntreCiudades === 0
          ? media === 0
            ? 0
            : null
          : redondear(((media - mediaEntreCiudades) / Math.abs(mediaEntreCiudades)) * 100),
    }))
    const series = seriesPorDia(validos, metrica)
    const rangosPorCiudad = resumen.ciudades.map(({ ciudad }) => ({
      ciudad,
      rangos: distribucionPorRangos(
        validos.filter((fila) => fila.ciudad === ciudad),
        metrica
      ),
    }))

    return {
      metrica,
      unidad: METRICAS[metrica].unidad,
      barras: {
        valorGlobal: redondear(resumen.global),
        ciudades: resumen.ciudades.map((ciudad) => ({
          ciudad: ciudad.ciudad,
          valor: redondear(ciudad.valor),
          observaciones: ciudad.registros,
        })),
      },
      lineas: {
        dias: series.dias,
        series: series.series.map((serie) => ({
          ciudad: serie.ciudad,
          valores: serie.valores.map(redondear),
        })),
      },
      quesitoPorRangos: {
        todasLasCiudades: distribucionPorRangos(validos, metrica),
        porCiudad: rangosPorCiudad,
      },
      quesitoPorCiudad: {
        mediaAritmeticaDeMedias: redondear(mediaEntreCiudades),
        desviaciones,
        criterioPorciones:
          "Cada porción se pondera por la desviación absoluta respecto a la media entre las medias de ciudad; la leyenda muestra la desviación firmada porcentual.",
      },
    }
  })
}

/** Resumen analítico del estado visible; omite los JSON originales y las filas horarias. */
export function construirContextoAgente(etl: PipelineEtl) {
  const procesado = etl.procesado
  const validos = procesado?.limpieza.validos ?? []
  const rechazados = procesado?.limpieza.rechazados ?? []
  const porCiudad = new Map<string, { validos: number; rechazados: number }>()
  for (const fila of validos) {
    const c = porCiudad.get(fila.ciudad) ?? { validos: 0, rechazados: 0 }
    c.validos++
    porCiudad.set(fila.ciudad, c)
  }
  for (const fila of rechazados) {
    const ciudad = fila.registro.ciudad ?? "Sin ciudad"
    const c = porCiudad.get(ciudad) ?? { validos: 0, rechazados: 0 }
    c.rechazados++
    porCiudad.set(ciudad, c)
  }

  return JSON.stringify({
    aplicacion: "Dashboard ETL meteorológico Open-Meteo → Supabase",
    mapa: {
      modoVisualPredeterminado: "colores fijos por ciudad",
      coloresPorCiudad: {
        Barcelona: "azul suave",
        Madrid: "naranja",
        Sevilla: "azul",
        Bilbao: "verde oliva",
        Valencia: "morado",
      },
    },
    extraccion: etl.extraccion
      ? {
          periodo: {
            desde: etl.extraccion.config.fechaInicio,
            hasta: etl.extraccion.config.fechaFin,
            zonaHoraria: "UTC",
          },
          ciudades: etl.extraccion.descargas.map((descarga) => ({
            ciudad: descarga.ciudad,
            estado: descarga.estado,
            duracionMs: redondear(descarga.duracionMs),
            intentos: descarga.intentos,
            error: descarga.error,
          })),
          enCurso: etl.extraccion.enCurso,
          duracionMs: redondear(etl.extraccion.duracionMs),
        }
      : null,
    pipeline: {
      transformacion: procesado
        ? {
            registrosTransformados: procesado.transformacion.registros.length,
            duracionMs: redondear(procesado.transformacion.duracionMs),
            diagnosticos: procesado.transformacion.diagnosticos,
          }
        : null,
      limpieza: procesado
        ? {
            validos: validos.length,
            rechazados: rechazados.length,
            duplicados: procesado.limpieza.duplicados,
            tasaValidezPct: procesado.transformacion.registros.length
              ? redondear((validos.length / procesado.transformacion.registros.length) * 100)
              : 0,
            porCiudad: [...porCiudad].map(([ciudad, conteos]) => ({ ciudad, ...conteos })),
            motivosFrecuentes: motivosFrecuentes(rechazados, 10),
            duracionMs: redondear(procesado.limpieza.duracionMs),
          }
        : null,
      filtrosActuales: etl.filtros,
      erroresDeFiltros: etl.filtrosInterpretados.errores,
      orden: etl.orden,
      filasQueCumplenFiltros: etl.filtradosOrdenados.length,
      seleccion: {
        modo: etl.modoSeleccion,
        filasSeleccionadasParaCarga: etl.conjuntoCarga.registros.length,
        seleccionadasFueraDeFiltros: etl.conjuntoCarga.seleccionadosFueraDeFiltro,
      },
      cargaSupabase: etl.carga
        ? {
            enCurso: etl.carga.enCurso,
            registrosCongelados: etl.carga.registros.length,
            duracionMs: redondear(etl.carga.duracionMs),
            lotes: etl.carga.lotes.map((lote) => ({
              numero: lote.numero,
              estado: lote.estado,
              filas: lote.registros.length,
              procesadas: lote.procesados,
              error: lote.error,
              intentos: lote.intentos,
            })),
            verificacion: etl.carga.verificacion,
          }
        : null,
      estadoSupabase: etl.estadoSupabase
        ? {
            configurado: etl.estadoSupabase.configurado,
            tablaAccesible: etl.estadoSupabase.tablaAccesible,
            totalFilas: etl.estadoSupabase.totalFilas,
            mensaje: etl.estadoSupabase.mensaje,
          }
        : null,
    },
    datosDeGraficas: datosGraficas(etl),
    alcance:
      "Las gráficas usan los registros válidos extraídos en este navegador. Las series y agregados son completos para el periodo, sin enviar JSON originales ni registros horarios individuales.",
  })
}
