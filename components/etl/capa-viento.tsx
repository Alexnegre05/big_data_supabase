"use client"

import * as React from "react"
import type { Map as MapaLibre } from "maplibre-gl"

import { CIUDADES } from "@/lib/etl/ciudades"

const URL_PREVISION = "https://api.open-meteo.com/v1/forecast"

/** Viento actual en una ciudad: velocidad (km/h) y dirección de la que viene (°). */
export interface VientoCiudad {
  latitud: number
  longitud: number
  velocidad: number
  direccion: number
}

/**
 * Viento de ahora mismo en todas las ciudades, en una sola petición. Es solo un
 * recurso visual: no pasa por el pipeline ni se carga en Supabase.
 */
export function useVientoActual(activo: boolean) {
  const [viento, setViento] = React.useState<VientoCiudad[] | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!activo || viento || error) return
    const control = new AbortController()
    const params = new URLSearchParams({
      latitude: CIUDADES.map((c) => c.latitud).join(","),
      longitude: CIUDADES.map((c) => c.longitud).join(","),
      current: "wind_speed_10m,wind_direction_10m",
      wind_speed_unit: "kmh",
    })
    fetch(`${URL_PREVISION}?${params}`, { signal: control.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<unknown>
      })
      .then((json) => {
        // Con varias coordenadas Open-Meteo devuelve un array; con una, un objeto.
        const lista = (Array.isArray(json) ? json : [json]) as {
          current?: { wind_speed_10m?: unknown; wind_direction_10m?: unknown }
        }[]
        const datos = CIUDADES.flatMap((c, i) => {
          const velocidad = lista[i]?.current?.wind_speed_10m
          const direccion = lista[i]?.current?.wind_direction_10m
          return typeof velocidad === "number" && typeof direccion === "number"
            ? [{ latitud: c.latitud, longitud: c.longitud, velocidad, direccion }]
            : []
        })
        if (datos.length) setViento(datos)
        else setError(true)
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return
        console.warn("Viento:", e)
        setError(true)
      })
    return () => control.abort()
  }, [activo, viento, error])

  return { viento, error }
}

/** Píxeles por fotograma por cada km/h. */
const ESCALA = 0.05
/** Fotogramas que vive una partícula antes de reaparecer en otro sitio. */
const VIDA_MIN = 40
const VIDA_MAX = 110

interface Particula {
  x: number
  y: number
  edad: number
  vida: number
}

/**
 * Partículas que siguen el viento interpolado entre ciudades (IDW), dibujadas en
 * un lienzo propio dentro del mapa y por debajo de los marcadores. Con
 * movimiento reducido se dibujan líneas de corriente estáticas.
 */
export function useCapaViento(
  mapaRef: React.RefObject<MapaLibre | null>,
  mapaListo: boolean,
  viento: VientoCiudad[] | null,
  color: string
) {
  React.useEffect(() => {
    const mapa = mapaRef.current
    if (!mapaListo || !mapa || !viento?.length) return

    const lienzo = document.createElement("canvas")
    lienzo.setAttribute("aria-hidden", "true")
    Object.assign(lienzo.style, {
      position: "absolute",
      left: "0",
      top: "0",
      pointerEvents: "none",
    })
    // Justo después del lienzo del mapa: los marcadores, que van detrás en el DOM, quedan encima.
    mapa.getCanvasContainer().insertBefore(lienzo, mapa.getCanvas().nextSibling)
    const ctx = lienzo.getContext("2d")
    if (!ctx) return

    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let ancho = 0
    let alto = 0
    let particulas: Particula[] = []

    const nueva = (): Particula => ({
      x: Math.random() * ancho,
      y: Math.random() * alto,
      edad: Math.floor(Math.random() * VIDA_MAX),
      vida: VIDA_MIN + Math.random() * (VIDA_MAX - VIDA_MIN),
    })

    const ajustar = () => {
      const contenedor = mapa.getContainer()
      ancho = contenedor.clientWidth
      alto = contenedor.clientHeight
      lienzo.width = ancho * dpr
      lienzo.height = alto * dpr
      lienzo.style.width = `${ancho}px`
      lienzo.style.height = `${alto}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineWidth = 1.2
      ctx.lineCap = "round"
      ctx.strokeStyle = color
      particulas = Array.from(
        { length: Math.min(900, Math.round((ancho * alto) / 2500)) },
        nueva
      )
    }

    // Vector de cada ciudad en píxeles de pantalla. Se proyecta un punto a sotavento
    // para que respete el giro, la inclinación y la deformación de Mercator.
    let campo: { x: number; y: number; dx: number; dy: number }[] = []
    const proyectarCampo = () => {
      campo = viento.map((v) => {
        const rad = (v.direccion * Math.PI) / 180
        // La dirección meteorológica dice de dónde viene: sopla hacia el lado opuesto.
        const este = -Math.sin(rad)
        const norte = -Math.cos(rad)
        const origen = mapa.project([v.longitud, v.latitud])
        const destino = mapa.project([
          v.longitud + (este * 0.1) / Math.cos((v.latitud * Math.PI) / 180),
          v.latitud + norte * 0.1,
        ])
        const dx = destino.x - origen.x
        const dy = destino.y - origen.y
        const largo = Math.hypot(dx, dy) || 1
        const paso = v.velocidad * ESCALA
        return {
          x: origen.x,
          y: origen.y,
          dx: (dx / largo) * paso,
          dy: (dy / largo) * paso,
        }
      })
    }

    const vientoEn = (x: number, y: number) => {
      let sx = 0
      let sy = 0
      let peso = 0
      for (const p of campo) {
        const d2 = (x - p.x) ** 2 + (y - p.y) ** 2
        if (d2 < 1) return p
        sx += p.dx / d2
        sy += p.dy / d2
        peso += 1 / d2
      }
      return { dx: sx / peso, dy: sy / peso }
    }

    const avanzar = () => {
      ctx.beginPath()
      for (const p of particulas) {
        const { dx, dy } = vientoEn(p.x, p.y)
        ctx.moveTo(p.x, p.y)
        p.x += dx
        p.y += dy
        ctx.lineTo(p.x, p.y)
        p.edad++
        const fuera = p.x < 0 || p.y < 0 || p.x > ancho || p.y > alto
        if (fuera || p.edad > p.vida) Object.assign(p, nueva(), { edad: 0 })
      }
      ctx.stroke()
    }

    const limpiar = () => ctx.clearRect(0, 0, ancho, alto)

    const estatico = () => {
      limpiar()
      for (const p of particulas) Object.assign(p, nueva(), { edad: 0 })
      for (let i = 0; i < 25; i++) avanzar()
    }

    let fotograma = 0
    const animar = () => {
      // Borra un poco del fotograma anterior para dejar estela.
      ctx.globalCompositeOperation = "destination-out"
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)"
      ctx.fillRect(0, 0, ancho, alto)
      ctx.globalCompositeOperation = "source-over"
      avanzar()
      fotograma = requestAnimationFrame(animar)
    }

    // Las estelas están en coordenadas de pantalla: al mover el mapa se reinician.
    const alMover = () => {
      proyectarCampo()
      if (!reducido) limpiar()
    }
    const alTerminar = () => reducido && estatico()
    const alRedimensionar = () => {
      ajustar()
      proyectarCampo()
      if (reducido) estatico()
    }

    ajustar()
    proyectarCampo()
    if (reducido) estatico()
    else fotograma = requestAnimationFrame(animar)
    mapa.on("move", alMover)
    mapa.on("moveend", alTerminar)
    mapa.on("resize", alRedimensionar)

    return () => {
      cancelAnimationFrame(fotograma)
      mapa.off("move", alMover)
      mapa.off("moveend", alTerminar)
      mapa.off("resize", alRedimensionar)
      lienzo.remove()
    }
  }, [mapaRef, mapaListo, viento, color])
}
