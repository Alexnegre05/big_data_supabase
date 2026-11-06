"use client"

import "maplibre-gl/dist/maplibre-gl.css"

import * as React from "react"
import { createPortal } from "react-dom"
import type { Map as MapaLibre, Marker, StyleSpecification } from "maplibre-gl"
import {
  ChevronDownIcon,
  LayersIcon,
  Loader2Icon,
  LocateFixedIcon,
  MapIcon,
  MaximizeIcon,
  MinimizeIcon,
  MinusIcon,
  PlusIcon,
  WindIcon,
  XIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { useFiltroVisual } from "@/components/filtro-visual"
import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES, NOMBRES_CIUDADES, type Ciudad } from "@/lib/etl/ciudades"
import { METRICAS, resumirPorCiudad, type Metrica } from "@/lib/etl/resumen"
import { FILTROS, type Filtro } from "@/lib/filtro-visual"
import { cn } from "@/lib/utils"

import { useCapaViento, useVientoActual } from "./capa-viento"
import { MarcoVintage, RosaVientos } from "./adornos-vintage"
import { iconoVintage, useCriaturasVintage } from "./decoracion-vintage"
import { estiloVintage } from "./estilo-vintage"
import { formatoEntero, formatoMedida, formatoPorcentaje } from "./formato"

const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY

/** Mapas base de MapTiler. "Datos" (Dataviz) es neutro para que destaquen los marcadores. */
const ESTILOS = {
  datos: { titulo: "Datos", claro: "dataviz", oscuro: "dataviz-dark" },
  calles: { titulo: "Calles", claro: "streets-v2", oscuro: "streets-v2-dark" },
  relieve: { titulo: "Relieve", claro: "topo-v2", oscuro: "topo-v2-dark" },
  satelite: { titulo: "Satélite", claro: "hybrid", oscuro: "hybrid" },
} as const
type Estilo = keyof typeof ESTILOS

/** Sin clave se usa Positron de OpenFreeMap (gratuito, sin registro). */
function urlEstilo(estilo: Estilo, oscuro: boolean) {
  if (!CLAVE_MAPTILER) return "https://tiles.openfreemap.org/styles/positron"
  const id = ESTILOS[estilo][oscuro ? "oscuro" : "claro"]
  return `https://api.maptiler.com/maps/${id}/style.json?key=${CLAVE_MAPTILER}`
}

/** Con el filtro "Vintage" el mapa base es siempre la carta antigua propia. */
function estiloMapa(
  estilo: Estilo,
  oscuro: boolean,
  vintage: boolean
): { clave: string; estilo: string | StyleSpecification } {
  if (vintage)
    return { clave: `vintage-${oscuro}`, estilo: estiloVintage(oscuro) }
  const url = urlEstilo(estilo, oscuro)
  return { clave: url, estilo: url }
}

const TITULOS_CORTOS: Record<Metrica, string> = {
  temperatura: "Temperatura",
  humedad: "Humedad",
  precipitacion: "Lluvia",
}

/**
 * Rampa secuencial de un solo tono (Persian orange #CF8852), claro → oscuro, para
 * la magnitud de la métrica. Validada como rampa ordinal en ambos modos: tono
 * único, luminosidad monótona y contraste suficiente del extremo más suave.
 */
const RAMPA = ["#e1a67b", "#cc854f", "#a76438", "#7e482a"]
const RAMPA_OSCURA = ["#7e482a", "#a76438", "#cc854f", "#e1a67b", "#f0c8ab"]
/** Con el filtro "Vintage": tinta sepia, del pergamino al marrón (los --rango-* de globals.css). */
const RAMPA_VINTAGE = ["#dcbf8f", "#b98c55", "#8a5f32", "#5b3d1f"]
const RAMPA_VINTAGE_OSCURA = ["#5b3d1f", "#8a5f32", "#b98c55", "#dcbf8f"]

function interpolar(rampa: readonly string[], t: number) {
  const pos = Math.min(Math.max(t, 0), 1) * (rampa.length - 1)
  const i = Math.min(Math.floor(pos), rampa.length - 2)
  const f = pos - i
  const a = parseInt(rampa[i].slice(1), 16)
  const b = parseInt(rampa[i + 1].slice(1), 16)
  const canal = (d: number) =>
    Math.round(((a >> d) & 255) * (1 - f) + ((b >> d) & 255) * f)
  return `rgb(${canal(16)} ${canal(8)} ${canal(0)})`
}

const LIMITES: [[number, number], [number, number]] = [
  [
    Math.min(...CIUDADES.map((c) => c.longitud)),
    Math.min(...CIUDADES.map((c) => c.latitud)),
  ],
  [
    Math.max(...CIUDADES.map((c) => c.longitud)),
    Math.max(...CIUDADES.map((c) => c.latitud)),
  ],
]

/** Margen para que las ciudades no queden bajo los paneles flotantes. */
function ajuste(contenedor: HTMLElement) {
  const { clientWidth: ancho, clientHeight: alto } = contenedor
  // A la izquierda están el título y la lista de ciudades (unos 20rem de ancho);
  // en pantallas estrechas, encima.
  const base =
    ancho < 640
      ? { top: 420, bottom: 40, left: 40, right: 40 }
      : { top: 110, bottom: 60, left: 290, right: 90 }
  // Si el margen no cabe, MapLibre calcula coordenadas NaN: se reduce en proporción.
  const fx = Math.min(1, (ancho * 0.6) / (base.left + base.right))
  const fy = Math.min(1, (alto * 0.6) / (base.top + base.bottom))
  return {
    padding: {
      top: base.top * fy,
      bottom: base.bottom * fy,
      left: base.left * fx,
      right: base.right * fx,
    },
    maxZoom: 7,
  }
}

const TEXTOS_MAPA = {
  "CooperativeGesturesHandler.WindowsHelpText":
    "Usa Ctrl + rueda para hacer zoom en el mapa",
  "CooperativeGesturesHandler.MacHelpText":
    "Usa ⌘ + rueda para hacer zoom en el mapa",
  "CooperativeGesturesHandler.MobileHelpText":
    "Usa dos dedos para mover el mapa",
}

interface DatosCiudad {
  temperatura: number
  humedad: number
  precipitacion: number
  validos: number
  rechazados: number
}

/** Panel translúcido que flota sobre el mapa. */
const FLOTANTE =
  "pointer-events-auto rounded-2xl bg-card/90 shadow-lg ring-1 ring-foreground/10 backdrop-blur-md"

export function MapaCiudades({ etl }: { etl: PipelineEtl }) {
  const { config, setConfig, extraccion, procesado } = etl
  const ocupado = Boolean(extraccion?.enCurso) || Boolean(etl.carga?.enCurso)
  const oscuro = useTheme().resolvedTheme === "dark"
  const [filtro, setFiltro] = useFiltroVisual()
  const vintage = filtro === "vintage"

  const [metrica, setMetrica] = React.useState<Metrica>("temperatura")
  const [estilo, setEstilo] = React.useState<Estilo>("datos")
  // El viento es decorativo: apagado por defecto y sin recordarse al recargar.
  const [verViento, setVerViento] = React.useState(false)
  const [capasAbiertas, setCapasAbiertas] = React.useState(false)
  const idCapas = React.useId()
  const [activa, setActiva] = React.useState<string | null>(null)
  // Compartida con el panel de Extracción: resaltar allí agranda el marcador aquí.
  const { ciudadResaltada: resaltada, setCiudadResaltada: setResaltada } = etl
  const [pantallaCompleta, setPantallaCompleta] = React.useState(false)
  const [estadoMapa, setEstadoMapa] = React.useState<
    "cargando" | "listo" | "error"
  >("cargando")

  const marcoRef = React.useRef<HTMLElement>(null)
  const lienzoRef = React.useRef<HTMLDivElement>(null)
  const mapaRef = React.useRef<MapaLibre | null>(null)
  const claveEstiloRef = React.useRef<string | null>(null)
  const [elementos, setElementos] = React.useState<Record<
    string,
    HTMLElement
  > | null>(null)

  // Crea el mapa una sola vez; la librería se importa en el cliente porque usa `window`.
  React.useEffect(() => {
    let cancelado = false
    const marcadores: Marker[] = []
    let observador: ResizeObserver | undefined
    void import("maplibre-gl").then(({ default: maplibre }) => {
      const lienzo = lienzoRef.current
      if (cancelado || !lienzo) return
      const raiz = document.documentElement
      const inicial = estiloMapa(
        "datos",
        raiz.classList.contains("dark"),
        raiz.dataset.filtro === "vintage"
      )
      claveEstiloRef.current = inicial.clave
      // Sin tamaño todavía no se puede encuadrar: se centra en España y punto.
      const conTamano = lienzo.clientWidth > 0 && lienzo.clientHeight > 0
      const mapa = new maplibre.Map({
        container: lienzo,
        style: inicial.estilo,
        ...(conTamano
          ? { bounds: LIMITES, fitBoundsOptions: ajuste(lienzo) }
          : { center: [-2.5, 40.2] as [number, number], zoom: 5 }),
        attributionControl: { compact: true },
        cooperativeGestures: true,
        locale: TEXTOS_MAPA,
      })
      mapa.once("load", () => setEstadoMapa("listo"))
      // Los iconos dibujados del estilo vintage se pintan cuando el mapa los pide.
      mapa.on("styleimagemissing", (e) => {
        const icono = iconoVintage(e.id)
        if (icono && !mapa.hasImage(e.id))
          mapa.addImage(e.id, icono, { pixelRatio: 2 })
      })
      mapa.on("error", (e) => {
        // Un error de tesela suelta no invalida el mapa; uno de estilo sí.
        if (!mapa.isStyleLoaded() && !mapa.loaded()) setEstadoMapa("error")
        console.warn("Mapa:", e.error?.message)
      })
      // Pulsar fuera de las ciudades cierra la ficha.
      mapa.on("click", (e) => {
        const destino = e.originalEvent.target as HTMLElement
        if (!destino.closest(".maplibregl-marker")) setActiva(null)
      })

      const nuevos: Record<string, HTMLElement> = {}
      for (const c of CIUDADES) {
        const el = document.createElement("div")
        marcadores.push(
          new maplibre.Marker({ element: el })
            .setLngLat([c.longitud, c.latitud])
            .addTo(mapa)
        )
        nuevos[c.nombre] = el
      }
      // MapLibre solo escucha la ventana: el panel lateral cambia el ancho sin tocarla.
      observador = new ResizeObserver(() => mapa.resize())
      observador.observe(lienzo)
      mapaRef.current = mapa
      setElementos(nuevos)
    })
    return () => {
      cancelado = true
      observador?.disconnect()
      for (const m of marcadores) m.remove()
      mapaRef.current?.remove()
      mapaRef.current = null
    }
  }, [])

  // Los marcadores son DOM propio, así que sobreviven al cambio de estilo.
  React.useEffect(() => {
    const siguiente = estiloMapa(estilo, oscuro, vintage)
    if (!mapaRef.current || siguiente.clave === claveEstiloRef.current) return
    claveEstiloRef.current = siguiente.clave
    mapaRef.current.setStyle(siguiente.estilo)
  }, [estilo, oscuro, vintage, elementos])

  const { viento, error: errorViento } = useVientoActual(verViento)
  useCapaViento(
    mapaRef,
    elementos !== null,
    verViento ? viento : null,
    vintage
      ? oscuro
        ? "rgba(240, 225, 190, 0.5)"
        : "rgba(70, 45, 20, 0.45)"
      : oscuro || estilo === "satelite"
        ? "rgba(255, 255, 255, 0.55)"
        : "rgba(30, 41, 59, 0.4)"
  )

  useCriaturasVintage(mapaRef, elementos !== null, vintage)

  // La ciudad activa se dibuja por encima de las demás (su ficha incluida), y
  // todas por encima de las criaturas del mapa vintage (z-index 0).
  React.useEffect(() => {
    if (!elementos) return
    for (const [nombre, el] of Object.entries(elementos)) {
      el.style.zIndex =
        nombre === activa ? "3" : nombre === resaltada ? "2" : "1"
    }
  }, [elementos, activa, resaltada])

  React.useEffect(() => {
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiva(null)
    }
    const alCambiarPantalla = () =>
      setPantallaCompleta(document.fullscreenElement === marcoRef.current)
    window.addEventListener("keydown", alPulsarTecla)
    document.addEventListener("fullscreenchange", alCambiarPantalla)
    return () => {
      window.removeEventListener("keydown", alPulsarTecla)
      document.removeEventListener("fullscreenchange", alCambiarPantalla)
    }
  }, [])

  const datos = React.useMemo(() => {
    const validos = procesado?.limpieza.validos
    if (!procesado || !validos?.length) return null
    const porMetrica = (m: Metrica) =>
      new Map(resumirPorCiudad(validos, m).ciudades.map((c) => [c.ciudad, c]))
    const t = porMetrica("temperatura")
    const h = porMetrica("humedad")
    const p = porMetrica("precipitacion")
    const rechazados = new Map<string, number>()
    for (const r of procesado.limpieza.rechazados) {
      const ciudad = r.registro.ciudad ?? "—"
      rechazados.set(ciudad, (rechazados.get(ciudad) ?? 0) + 1)
    }
    const resultado = new Map<string, DatosCiudad>()
    for (const [ciudad, temp] of t) {
      resultado.set(ciudad, {
        temperatura: temp.valor,
        humedad: h.get(ciudad)!.valor,
        precipitacion: p.get(ciudad)!.valor,
        validos: temp.registros,
        rechazados: rechazados.get(ciudad) ?? 0,
      })
    }
    return resultado
  }, [procesado])

  const valorDe = (ciudad: string) => {
    const d = datos?.get(ciudad)
    return d ? d[metrica] : null
  }
  const valores = NOMBRES_CIUDADES.map(valorDe).filter(
    (v): v is number => v !== null
  )
  const minimo = valores.length ? Math.min(...valores) : 0
  const maximo = valores.length ? Math.max(...valores) : 0
  const rampa = vintage
    ? oscuro
      ? RAMPA_VINTAGE_OSCURA
      : RAMPA_VINTAGE
    : oscuro
      ? RAMPA_OSCURA
      : RAMPA
  const colorDe = (v: number) =>
    interpolar(rampa, maximo > minimo ? (v - minimo) / (maximo - minimo) : 0.5)
  const { unidad } = METRICAS[metrica]

  const incluida = (nombre: string) => config.ciudades.includes(nombre)
  const alternarCiudad = (nombre: string, marcar: boolean) =>
    setConfig((c) => ({
      ...c,
      ciudades: marcar
        ? [...c.ciudades, nombre]
        : c.ciudades.filter((x) => x !== nombre),
    }))

  const enfocar = (c: Ciudad) => {
    const mapa = mapaRef.current
    setActiva(c.nombre)
    if (!mapa) return
    // Desplaza la ciudad hacia abajo para dejar sitio a la ficha encima.
    const estrecho = mapa.getContainer().clientWidth < 640
    mapa.flyTo({
      center: [c.longitud, c.latitud],
      zoom: Math.max(mapa.getZoom(), 7),
      offset: [0, estrecho ? 90 : 120],
      essential: true,
    })
  }
  const verTodas = () => {
    const mapa = mapaRef.current
    setActiva(null)
    mapa?.fitBounds(LIMITES, ajuste(mapa.getContainer()))
  }
  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void marcoRef.current?.requestFullscreen()
  }

  return (
    <section
      ref={marcoRef}
      aria-label="Mapa meteorológico"
      className="@container relative isolate h-full overflow-hidden bg-muted"
    >
      {/* maplibre-gl.css fuerza `position: relative` en el lienzo (y gana a las
          capas de Tailwind), así que la posición absoluta va en un envoltorio. */}
      <div className="absolute inset-0">
        <div ref={lienzoRef} className="size-full" />
      </div>

      {vintage && (
        <>
          <MarcoVintage />
          <RosaVientos
            mapaRef={mapaRef}
            mapaListo={elementos !== null}
            className="absolute right-12 bottom-14 z-10 hidden size-28 @xl:block"
          />
        </>
      )}

      {estadoMapa !== "listo" && (
        <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          <span className="flex items-center gap-2 rounded-lg bg-card/90 px-3 py-2 ring-1 ring-foreground/10">
            {estadoMapa === "cargando" ? (
              <>
                <Loader2Icon aria-hidden className="size-4 animate-spin" />
                Cargando mapa…
              </>
            ) : (
              <>
                <MapIcon aria-hidden className="size-4" />
                No se pudo cargar el mapa. Revisa NEXT_PUBLIC_MAPTILER_KEY y los
                orígenes permitidos en MapTiler.
              </>
            )}
          </span>
        </p>
      )}

      {/* Capa de paneles: deja pasar el ratón al mapa salvo en los propios paneles. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-20 flex flex-col justify-between gap-3 p-3 @xl:p-4",
          // Con el marco vintage, los paneles quedan dentro del filete interior.
          vintage && "p-9 @xl:p-10"
        )}
      >
        {/* Las ciudades se eligen en el panel de Extracción (y en la ficha de cada marcador). */}
        <div className="flex flex-wrap items-start justify-end gap-3">
          <div className={cn(FLOTANTE, "flex flex-col gap-3 p-3")}>
            <Segmentado
              etiqueta="Métrica"
              opciones={(Object.keys(METRICAS) as Metrica[]).map((m) => ({
                valor: m,
                titulo: TITULOS_CORTOS[m],
              }))}
              valor={metrica}
              alCambiar={setMetrica}
            />
            {datos && valores.length > 0 ? (
              <Leyenda
                titulo={METRICAS[metrica].titulo}
                unidad={unidad}
                minimo={minimo}
                maximo={maximo}
                rampa={rampa}
              />
            ) : (
              <p className="max-w-64 text-xs text-muted-foreground">
                Descarga los datos para colorear las ciudades según la métrica.
              </p>
            )}

            {/* Opciones visuales plegadas: no hacen falta para la práctica. */}
            <button
              type="button"
              aria-expanded={capasAbiertas}
              aria-controls={idCapas}
              onClick={() => setCapasAbiertas((a) => !a)}
              className="flex items-center gap-2 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <LayersIcon aria-hidden className="size-3.5" />
              Capas y aspecto
              <ChevronDownIcon
                aria-hidden
                className={cn(
                  "ml-auto size-3.5 transition-transform",
                  capasAbiertas && "rotate-180"
                )}
              />
            </button>
            {capasAbiertas && (
              <div id={idCapas} className="flex flex-col gap-3 border-t pt-3">
                {CLAVE_MAPTILER && !vintage && (
                  <Segmentado
                    className="hidden @xl:flex"
                    etiqueta="Mapa base"
                    opciones={(Object.keys(ESTILOS) as Estilo[]).map((e) => ({
                      valor: e,
                      titulo: ESTILOS[e].titulo,
                    }))}
                    valor={estilo}
                    alCambiar={setEstilo}
                  />
                )}
                <Segmentado
                  etiqueta="Filtro (toda la página)"
                  opciones={(Object.keys(FILTROS) as Filtro[]).map((f) => ({
                    valor: f,
                    titulo: FILTROS[f].titulo,
                  }))}
                  valor={filtro}
                  alCambiar={setFiltro}
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={verViento && !errorViento}
                  disabled={errorViento}
                  onClick={() => setVerViento((v) => !v)}
                  title="Recurso visual: viento de ahora mismo según Open-Meteo. No forma parte de la extracción."
                  className="flex items-center gap-2 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  <WindIcon aria-hidden className="size-3.5" />
                  {errorViento ? "Viento no disponible" : "Viento ahora"}
                  <span
                    aria-hidden
                    className={cn(
                      "ml-auto flex h-4 w-7 items-center rounded-full p-0.5 transition-colors",
                      verViento && !errorViento ? "bg-marca" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "size-3 rounded-full bg-card shadow-sm transition-transform",
                        verViento && !errorViento && "translate-x-3"
                      )}
                    />
                  </span>
                </button>
              </div>
            )}

            <div className="hidden gap-1 @xl:flex">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Acercar"
                onClick={() => mapaRef.current?.zoomIn()}
              >
                <PlusIcon aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Alejar"
                onClick={() => mapaRef.current?.zoomOut()}
              >
                <MinusIcon aria-hidden />
              </Button>
              <Button variant="outline" size="sm" onClick={verTodas}>
                <LocateFixedIcon aria-hidden />
                Ver todas
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="ml-auto"
                aria-label={
                  pantallaCompleta
                    ? "Salir de pantalla completa"
                    : "Pantalla completa"
                }
                onClick={alternarPantallaCompleta}
              >
                {pantallaCompleta ? (
                  <MinimizeIcon aria-hidden />
                ) : (
                  <MaximizeIcon aria-hidden />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {elementos &&
        CIUDADES.map((c) =>
          createPortal(
            <Marcador
              ciudad={c.nombre}
              valor={valorDe(c.nombre)}
              unidad={unidad}
              color={colorDe}
              incluida={incluida(c.nombre)}
              resaltada={activa === c.nombre || resaltada === c.nombre}
              alPulsar={() => enfocar(c)}
              alEntrar={() => setResaltada(c.nombre)}
              alSalir={() => setResaltada(null)}
              ficha={
                activa === c.nombre && (
                  <FichaCiudad
                    ciudad={c}
                    datos={datos?.get(c.nombre)}
                    incluida={incluida(c.nombre)}
                    ocupado={ocupado}
                    alternar={(m) => alternarCiudad(c.nombre, m)}
                    cerrar={() => setActiva(null)}
                  />
                )
              }
            />,
            elementos[c.nombre],
            c.nombre
          )
        )}
    </section>
  )
}

function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  className,
}: {
  etiqueta: string
  opciones: { valor: T; titulo: string }[]
  valor: T
  alCambiar: (v: T) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={cn("flex flex-col gap-1", className)}
    >
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <div className="flex rounded-lg bg-muted p-0.5">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={o.valor === valor}
            onClick={() => alCambiar(o.valor)}
            className={cn(
              "flex-1 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              o.valor === valor
                ? "bg-card font-medium shadow-sm ring-1 ring-foreground/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.titulo}
          </button>
        ))}
      </div>
    </div>
  )
}

function Marcador({
  ciudad,
  valor,
  unidad,
  color,
  incluida,
  resaltada,
  alPulsar,
  alEntrar,
  alSalir,
  ficha,
}: {
  ciudad: string
  valor: number | null
  unidad: string
  color: (v: number) => string
  incluida: boolean
  resaltada: boolean
  alPulsar: () => void
  alEntrar: () => void
  alSalir: () => void
  ficha: React.ReactNode
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={alPulsar}
        onMouseEnter={alEntrar}
        onMouseLeave={alSalir}
        onFocus={alEntrar}
        onBlur={alSalir}
        aria-label={`${ciudad}${valor !== null ? `: ${formatoMedida(valor, unidad)}` : ""}${incluida ? "" : " (no incluida)"}`}
        className="group relative block cursor-pointer outline-none"
      >
        {/* Área de pulsación mayor que el punto. */}
        <span className="absolute -inset-2" />
        <span
          className={cn(
            "block size-4 rounded-full shadow-md ring-2 ring-card transition-transform",
            resaltada && "scale-125 ring-foreground",
            !incluida && "border-2 border-dashed border-muted-foreground"
          )}
          style={{
            background: !incluida
              ? "var(--color-card)"
              : valor !== null
                ? color(valor)
                : "var(--color-primary)",
          }}
        />
        <span
          className={cn(
            "absolute top-1/2 left-full ml-1.5 -translate-y-1/2 rounded-md bg-card/95 px-1.5 py-0.5 text-xs whitespace-nowrap text-foreground shadow-sm ring-1 ring-foreground/10 group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
            !incluida && "text-muted-foreground"
          )}
        >
          <span className="font-medium">{ciudad}</span>
          {valor !== null && (
            <span className="ml-1 tabular-nums">
              {formatoMedida(valor, unidad)}
            </span>
          )}
        </span>
      </button>
      {ficha}
    </div>
  )
}

/** Ficha anclada sobre el marcador de la ciudad, con una flecha hacia él. */
function FichaCiudad({
  ciudad,
  datos,
  incluida,
  ocupado,
  alternar,
  cerrar,
}: {
  ciudad: Ciudad
  datos: DatosCiudad | undefined
  incluida: boolean
  ocupado: boolean
  alternar: (marcar: boolean) => void
  cerrar: () => void
}) {
  const total = datos ? datos.validos + datos.rechazados : 0
  return (
    <aside
      aria-label={`Ficha de ${ciudad.nombre}`}
      className="absolute bottom-full left-1/2 mb-4 w-64 -translate-x-1/2 animate-in cursor-auto fade-in-0 zoom-in-95"
    >
      <div className="flex flex-col gap-3 rounded-xl bg-card p-3 text-sm text-card-foreground shadow-xl ring-1 ring-foreground/10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{ciudad.nombre}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {ciudad.latitud.toFixed(4)}°, {ciudad.longitud.toFixed(4)}°
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cerrar ficha"
            onClick={cerrar}
          >
            <XIcon aria-hidden />
          </Button>
        </div>

        {datos ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            {(Object.keys(METRICAS) as Metrica[]).map((m) => (
              <div key={m}>
                <dt className="text-xs text-muted-foreground">
                  {METRICAS[m].titulo}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatoMedida(datos[m], METRICAS[m].unidad)}
                </dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-muted-foreground">Horas válidas</dt>
              <dd className="font-medium tabular-nums">
                {formatoEntero(datos.validos)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({formatoPorcentaje(datos.validos, total)})
                </span>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sin datos todavía: extrae para ver temperatura, humedad y
            precipitación.
          </p>
        )}

        <Button
          variant={incluida ? "outline" : "default"}
          size="sm"
          disabled={ocupado}
          onClick={() => alternar(!incluida)}
        >
          {incluida ? "Quitar de la extracción" : "Añadir a la extracción"}
        </Button>
      </div>
      <span
        aria-hidden
        className="absolute top-full left-1/2 size-3 -translate-x-1/2 -translate-y-1.5 rotate-45 bg-card ring-1 ring-foreground/10 [clip-path:polygon(100%_0,100%_100%,0_100%)]"
      />
    </aside>
  )
}

function Leyenda({
  titulo,
  unidad,
  minimo,
  maximo,
  rampa,
}: {
  titulo: string
  unidad: string
  minimo: number
  maximo: number
  rampa: readonly string[]
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">
        {titulo} ({unidad})
      </span>
      <span
        aria-hidden
        className="h-2 rounded-full"
        style={{ background: `linear-gradient(to right, ${rampa.join(", ")})` }}
      />
      <span className="flex justify-between tabular-nums">
        <span>{formatoMedida(minimo, unidad)}</span>
        <span>{formatoMedida(maximo, unidad)}</span>
      </span>
    </div>
  )
}
