"use client"

import * as React from "react"

import { usePipelineEtl } from "@/hooks/use-pipeline-etl"

import { BarraSuperior } from "./barra-superior"
import type { Pestana } from "./inspeccion-datos"
import { MapaCiudades } from "./mapa-ciudades"
import { PanelTrabajo, type AnchoPanel, type Vista } from "./panel-trabajo"
import { calcularFases } from "./pipeline-visual"

/** Una pestaña de inspección, una vista del panel o el propio mapa. */
export type Destino = Pestana | Exclude<Vista, "datos"> | "mapa"

const CONSULTA_ESCRITORIO = "(min-width: 64rem)"

function useEsEscritorio() {
  return React.useSyncExternalStore(
    (aviso) => {
      const consulta = window.matchMedia(CONSULTA_ESCRITORIO)
      consulta.addEventListener("change", aviso)
      return () => consulta.removeEventListener("change", aviso)
    },
    () => window.matchMedia(CONSULTA_ESCRITORIO).matches,
    () => true
  )
}

/**
 * Una sola pantalla sin scroll: el pipeline arriba como navegación, el mapa
 * como base y un panel de trabajo acoplado a la derecha para configurar,
 * revisar los datos y cargarlos.
 */
export function AplicacionEtl() {
  const etl = usePipelineEtl()
  const esEscritorio = useEsEscritorio()
  const [vista, setVista] = React.useState<Vista>("extraccion")
  // Datos empieza con todas las secciones cerradas.
  const [pestana, setPestana] = React.useState<Pestana | null>(null)
  // Las tablas necesitan sitio: la vista de datos ensancha el panel, salvo
  // que el usuario ya haya elegido un ancho arrastrando el borde.
  const [ancho, setAncho] = React.useState<AnchoPanel>(null)
  // En escritorio el panel empieza abierto; en móvil se empieza por el mapa.
  const [abierto, setAbierto] = React.useState(true)
  const [abiertoMovil, setAbiertoMovil] = React.useState(false)

  const cambiarVista = (v: Vista) => {
    setVista(v)
    if (typeof ancho === "number") return
    // Solo las tablas necesitan el panel ancho; el resto vuelve al tamaño original.
    setAncho(v === "datos" ? "max" : null)
  }

  const abrir = () => {
    setAbierto(true)
    setAbiertoMovil(true)
  }
  const cerrar = () => {
    setAbierto(false)
    setAbiertoMovil(false)
  }

  const navegar = (destino: Destino) => {
    if (destino === "mapa") {
      setAbiertoMovil(false)
      return
    }
    if (
      destino === "extraccion" ||
      destino === "resumen" ||
      destino === "pipeline"
    ) {
      cambiarVista(destino)
    } else {
      setPestana(destino)
      cambiarVista("datos")
    }
    abrir()
  }

  React.useEffect(() => {
    if (!abiertoMovil) return
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbiertoMovil(false)
    }
    window.addEventListener("keydown", alPulsarTecla)
    return () => window.removeEventListener("keydown", alPulsarTecla)
  }, [abiertoMovil])

  const panelAbierto = esEscritorio ? abierto : abiertoMovil
  const faseActiva = !panelAbierto
    ? null
    : vista === "extraccion"
      ? "extraccion"
      : vista === "datos"
        ? (calcularFases(etl).find((f) => f.pestana === pestana)?.id ?? null)
        : null

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <BarraSuperior
        etl={etl}
        faseActiva={faseActiva}
        alAbrir={navegar}
        panelAbierto={panelAbierto}
        alternarPanel={panelAbierto ? cerrar : abrir}
      />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <MapaCiudades etl={etl} />
        </main>
        <PanelTrabajo
          etl={etl}
          vista={vista}
          setVista={cambiarVista}
          pestana={pestana}
          setPestana={setPestana}
          ancho={ancho}
          setAncho={setAncho}
          abierto={abierto}
          abiertoMovil={abiertoMovil}
          cerrar={cerrar}
          navegar={navegar}
        />
      </div>
    </div>
  )
}
