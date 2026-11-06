"use client"

import * as React from "react"

import {
  consultarEstado,
  consultarExistentes,
  enviarLote,
  type EstadoSupabase,
} from "@/lib/etl/api-cliente"
import {
  crearLotes,
  ejecutarLotes,
  verificarClaves,
  type Lote,
  type ResultadoVerificacion,
} from "@/lib/etl/carga"
import { buscarCiudad, NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  descargarCiudad,
  validarConfiguracion,
  type ConfiguracionExtraccion,
} from "@/lib/etl/extraccion"
import {
  aplicarFiltros,
  aRegistroCarga,
  calcularConjuntoCarga,
  FILTROS_INICIALES,
  interpretarFiltros,
  ORDEN_INICIAL,
  ordenar,
  resolverSeleccion,
  type Filtros,
  type ModoSeleccion,
  type Orden,
} from "@/lib/etl/filtros"
import {
  medir,
  procesarRespuestas,
  type ResultadoProcesamiento,
} from "@/lib/etl/procesamiento"
import type { RegistroCarga, RespuestaOpenMeteo } from "@/lib/etl/tipos"

export type EstadoDescarga = "pendiente" | "descargando" | "ok" | "error"

export interface DescargaCiudad {
  ciudad: string
  estado: EstadoDescarga
  json: RespuestaOpenMeteo | null
  error: string | null
  duracionMs: number | null
  intentos: number
}

export interface Extraccion {
  /** Configuración congelada al pulsar "Extraer datos". */
  config: ConfiguracionExtraccion
  descargas: DescargaCiudad[]
  enCurso: boolean
  duracionMs: number | null
}

export interface EstadoCargaSupabase {
  lotes: Lote[]
  /** Copia congelada del conjunto enviado, en el orden elegido. */
  registros: readonly RegistroCarga[]
  congeladoEn: string
  enCurso: boolean
  duracionMs: number | null
  verificacion:
    | { estado: "pendiente" | "en_curso" }
    | { estado: "completada"; resultado: ResultadoVerificacion }
    | { estado: "error"; error: string }
}

const CONFIG_INICIAL: ConfiguracionExtraccion = {
  ciudades: [...NOMBRES_CIUDADES],
  fechaInicio: "2026-09-01",
  fechaFin: "2026-09-30",
}

export function usePipelineEtl() {
  const [config, setConfig] = React.useState(CONFIG_INICIAL)
  const [extraccion, setExtraccion] = React.useState<Extraccion | null>(null)
  const [procesado, setProcesado] =
    React.useState<ResultadoProcesamiento | null>(null)
  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_INICIALES)
  const [orden, setOrden] = React.useState<Orden>(ORDEN_INICIAL)
  const [modoSeleccion, setModoSeleccion] =
    React.useState<ModoSeleccion>("automatico")
  const [seleccionManual, setSeleccionManual] = React.useState<
    ReadonlySet<string>
  >(() => new Set())
  const [carga, setCarga] = React.useState<EstadoCargaSupabase | null>(null)
  const [estadoSupabase, setEstadoSupabase] =
    React.useState<EstadoSupabase | null>(null)
  // Ciudad bajo el ratón en el panel o en el mapa: ambos la resaltan a la vez.
  const [ciudadResaltada, setCiudadResaltada] = React.useState<string | null>(
    null
  )

  // Las referencias evitan envíos simultáneos aunque React aún no haya re-renderizado.
  const extrayendoRef = React.useRef(false)
  const cargandoRef = React.useRef(false)
  const descargasRef = React.useRef<DescargaCiudad[]>([])
  const lotesRef = React.useRef<Lote[]>([])

  const validacion = React.useMemo(() => validarConfiguracion(config), [config])

  const refrescarEstadoSupabase = React.useCallback(async () => {
    try {
      setEstadoSupabase(await consultarEstado())
    } catch (error) {
      setEstadoSupabase({
        configurado: false,
        faltan: [],
        tablaAccesible: false,
        mensaje: `No se pudo consultar el estado: ${(error as Error).message}`,
      })
    }
  }, [])

  React.useEffect(() => {
    // Carga inicial del estado del destino (petición externa, no estado derivado).
    void refrescarEstadoSupabase()
  }, [refrescarEstadoSupabase])

  const actualizarDescarga = React.useCallback((d: DescargaCiudad) => {
    descargasRef.current = descargasRef.current.map((x) =>
      x.ciudad === d.ciudad ? d : x
    )
    const copia = descargasRef.current
    setExtraccion((e) => (e ? { ...e, descargas: copia } : e))
  }, [])

  const reprocesar = React.useCallback(() => {
    const correctas = descargasRef.current.flatMap((d) =>
      d.estado === "ok" && d.json ? [{ ciudad: d.ciudad, json: d.json }] : []
    )
    setProcesado(correctas.length > 0 ? procesarRespuestas(correctas) : null)
  }, [])

  /** Descarga en serie las ciudades indicadas para mostrar procesadas y pendientes. */
  const descargar = React.useCallback(
    async (ciudades: string[], cfg: ConfiguracionExtraccion) => {
      const inicio = performance.now()
      for (const nombre of ciudades) {
        const previa = descargasRef.current.find((d) => d.ciudad === nombre)!
        const intentos = previa.intentos + 1
        actualizarDescarga({
          ...previa,
          estado: "descargando",
          error: null,
          intentos,
        })
        const t0 = performance.now()
        try {
          const json = await descargarCiudad(
            buscarCiudad(nombre)!,
            cfg.fechaInicio,
            cfg.fechaFin
          )
          actualizarDescarga({
            ciudad: nombre,
            estado: "ok",
            json,
            error: null,
            duracionMs: performance.now() - t0,
            intentos,
          })
        } catch (error) {
          actualizarDescarga({
            ciudad: nombre,
            estado: "error",
            json: null,
            error: (error as Error).message,
            duracionMs: performance.now() - t0,
            intentos,
          })
        }
      }
      return performance.now() - inicio
    },
    [actualizarDescarga]
  )

  const extraer = React.useCallback(async () => {
    if (extrayendoRef.current || cargandoRef.current) return
    if (validacion.errores.length > 0) return
    extrayendoRef.current = true

    const cfg: ConfiguracionExtraccion = {
      ...config,
      // Respeta el orden de la lista de ciudades, no el orden de clic.
      ciudades: NOMBRES_CIUDADES.filter((c) => config.ciudades.includes(c)),
    }
    descargasRef.current = cfg.ciudades.map((ciudad) => ({
      ciudad,
      estado: "pendiente",
      json: null,
      error: null,
      duracionMs: null,
      intentos: 0,
    }))
    setExtraccion({
      config: cfg,
      descargas: descargasRef.current,
      enCurso: true,
      duracionMs: null,
    })
    // Un nuevo conjunto de datos invalida la selección y la carga anteriores.
    setProcesado(null)
    setModoSeleccion("automatico")
    setSeleccionManual(new Set())
    setCarga(null)
    lotesRef.current = []

    const duracionMs = await descargar(cfg.ciudades, cfg)
    setExtraccion((e) => (e ? { ...e, enCurso: false, duracionMs } : e))
    reprocesar()
    extrayendoRef.current = false
  }, [config, descargar, reprocesar, validacion.errores.length])

  /** Reintenta solo una ciudad; sus datos sustituyen (no se suman) a los anteriores. */
  const reintentarCiudad = React.useCallback(
    async (ciudad: string) => {
      if (extrayendoRef.current || !extraccion) return
      extrayendoRef.current = true
      setExtraccion((e) => (e ? { ...e, enCurso: true } : e))
      const duracionMs = await descargar([ciudad], extraccion.config)
      setExtraccion((e) => (e ? { ...e, enCurso: false, duracionMs } : e))
      reprocesar()
      extrayendoRef.current = false
    },
    [descargar, extraccion, reprocesar]
  )

  // Orden de operaciones: válidos → filtros → ordenación → selección.
  const validos = procesado?.limpieza.validos
  const filtrosInterpretados = React.useMemo(
    () => interpretarFiltros(filtros),
    [filtros]
  )
  const seleccionado = React.useMemo(() => {
    return medir(() => {
      const filtrados = aplicarFiltros(validos ?? [], filtrosInterpretados)
      const ordenados = ordenar(filtrados, orden)
      const seleccion = resolverSeleccion(
        modoSeleccion,
        seleccionManual,
        ordenados
      )
      const conjunto = calcularConjuntoCarga(ordenados, seleccion)
      return { ordenados, seleccion, conjunto }
    })
  }, [validos, filtrosInterpretados, orden, modoSeleccion, seleccionManual])
  const seleccion = seleccionado.valor.seleccion

  /**
   * Cualquier cambio manual parte de la selección visible en ese momento
   * (en modo automático, todo lo filtrado) y pasa a modo manual.
   */
  const editarSeleccion = React.useCallback(
    (cambio: (s: Set<string>) => void) => {
      const nueva = new Set(seleccion)
      cambio(nueva)
      setSeleccionManual(nueva)
      setModoSeleccion("manual")
    },
    [seleccion]
  )

  const alternarFila = React.useCallback(
    (clave: string) =>
      editarSeleccion((s) => {
        if (s.has(clave)) s.delete(clave)
        else s.add(clave)
      }),
    [editarSeleccion]
  )

  const marcarFilas = React.useCallback(
    (claves: string[], marcar: boolean) =>
      editarSeleccion((s) => {
        for (const c of claves) {
          if (marcar) s.add(c)
          else s.delete(c)
        }
      }),
    [editarSeleccion]
  )

  const seleccionarTodasFiltradas = React.useCallback(() => {
    marcarFilas(
      seleccionado.valor.ordenados.map((r) => r.clave),
      true
    )
  }, [marcarFilas, seleccionado.valor.ordenados])

  const vaciarSeleccion = React.useCallback(
    () => editarSeleccion((s) => s.clear()),
    [editarSeleccion]
  )

  const activarSeleccionAutomatica = React.useCallback(() => {
    setModoSeleccion("automatico")
    setSeleccionManual(new Set())
  }, [])
  const restablecerFiltros = React.useCallback(() => {
    setFiltros(FILTROS_INICIALES)
    setOrden(ORDEN_INICIAL)
  }, [])

  const verificar = React.useCallback(async () => {
    const completados = lotesRef.current
      .filter((l) => l.estado === "completado")
      .flatMap((l) => l.registros)
    setCarga((c) => (c ? { ...c, verificacion: { estado: "en_curso" } } : c))
    try {
      const resultado = await verificarClaves(
        completados.map((r) => ({
          ciudad: r.ciudad,
          fecha_hora: r.fecha_hora,
        })),
        consultarExistentes
      )
      setCarga((c) =>
        c ? { ...c, verificacion: { estado: "completada", resultado } } : c
      )
    } catch (error) {
      setCarga((c) =>
        c
          ? {
              ...c,
              verificacion: {
                estado: "error",
                error: (error as Error).message,
              },
            }
          : c
      )
    }
  }, [])

  const ejecutar = React.useCallback(async () => {
    const inicio = performance.now()
    setCarga((c) => (c ? { ...c, enCurso: true } : c))
    const final = await ejecutarLotes(lotesRef.current, enviarLote, (lote) => {
      lotesRef.current = lotesRef.current.map((l) =>
        l.numero === lote.numero ? lote : l
      )
      const copia = lotesRef.current
      setCarga((c) => (c ? { ...c, lotes: copia } : c))
    })
    lotesRef.current = final
    setCarga((c) =>
      c
        ? {
            ...c,
            lotes: final,
            enCurso: false,
            duracionMs: performance.now() - inicio,
          }
        : c
    )
    if (final.some((l) => l.estado === "completado")) await verificar()
    void refrescarEstadoSupabase()
  }, [refrescarEstadoSupabase, verificar])

  const iniciarCarga = React.useCallback(async () => {
    if (cargandoRef.current || extrayendoRef.current) return
    const registros = seleccionado.valor.conjunto.registros
    if (registros.length === 0) return
    cargandoRef.current = true
    try {
      // Copia congelada: los cambios de filtros posteriores no afectan a esta carga.
      const lotes = crearLotes(registros.map(aRegistroCarga))
      lotesRef.current = lotes
      setCarga({
        lotes,
        registros: Object.freeze(lotes.flatMap((l) => l.registros)),
        congeladoEn: new Date().toISOString(),
        enCurso: true,
        duracionMs: null,
        verificacion: { estado: "pendiente" },
      })
      await ejecutar()
    } finally {
      cargandoRef.current = false
    }
  }, [ejecutar, seleccionado.valor.conjunto.registros])

  const reintentarLotesFallidos = React.useCallback(async () => {
    if (cargandoRef.current) return
    if (!lotesRef.current.some((l) => l.estado === "error")) return
    cargandoRef.current = true
    try {
      await ejecutar()
    } finally {
      cargandoRef.current = false
    }
  }, [ejecutar])

  return {
    config,
    setConfig,
    validacion,
    extraccion,
    extraer,
    reintentarCiudad,
    procesado,
    filtros,
    setFiltros,
    filtrosInterpretados,
    orden,
    setOrden,
    filtradosOrdenados: seleccionado.valor.ordenados,
    conjuntoCarga: seleccionado.valor.conjunto,
    duracionFiltradoMs: seleccionado.duracionMs,
    seleccion,
    modoSeleccion,
    activarSeleccionAutomatica,
    alternarFila,
    marcarFilas,
    seleccionarTodasFiltradas,
    vaciarSeleccion,
    restablecerFiltros,
    carga,
    iniciarCarga,
    reintentarLotesFallidos,
    verificar,
    estadoSupabase,
    refrescarEstadoSupabase,
    ciudadResaltada,
    setCiudadResaltada,
  }
}

export type PipelineEtl = ReturnType<typeof usePipelineEtl>
