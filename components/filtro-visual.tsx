"use client"

import * as React from "react"

import { CLAVE_FILTRO, esFiltro, type Filtro } from "@/lib/filtro-visual"

const EVENTO = "filtro-visual"

function leer(): Filtro {
  const f = document.documentElement.dataset.filtro
  return esFiltro(f) ? f : "original"
}

function suscribir(aviso: () => void) {
  window.addEventListener(EVENTO, aviso)
  return () => window.removeEventListener(EVENTO, aviso)
}

/**
 * Filtro visual activo. Vive como atributo `data-filtro` en <html> (lo pone un
 * script en el layout antes de pintar) y se recuerda en localStorage.
 */
export function useFiltroVisual() {
  const filtro = React.useSyncExternalStore(
    suscribir,
    leer,
    (): Filtro => "original"
  )

  const setFiltro = React.useCallback((nuevo: Filtro) => {
    const aplicar = () => {
      if (nuevo === "original") delete document.documentElement.dataset.filtro
      else document.documentElement.dataset.filtro = nuevo
      window.dispatchEvent(new Event(EVENTO))
    }
    try {
      localStorage.setItem(CLAVE_FILTRO, nuevo)
    } catch {
      // Sin almacenamiento (modo privado): el filtro dura hasta recargar.
    }
    // Fundido entre aspectos en los navegadores que lo admiten.
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reducido && document.startViewTransition) {
      document.startViewTransition(aplicar)
    } else {
      aplicar()
    }
  }, [])

  return [filtro, setFiltro] as const
}
