"use client"

import * as React from "react"
import type { Map as MapaLibre, Marker } from "maplibre-gl"

/*
 * Ilustraciones del mapa "Vintage", como en las cartas dibujadas a mano:
 * - Montañas, bosques y faros: iconos pintados con Canvas que el estilo usa en
 *   una capa de símbolos (van por debajo de los rótulos y se mueven con el mapa).
 * - Barcos, peces y tiburones: marcadores con SVG y animación CSS (globals.css).
 * La mayoría están en la península; alrededor solo unos pocos.
 */

type Icono = "montana" | "monte" | "bosque" | "faro"

const P = (
  tipo: Icono,
  lon: number,
  lat: number,
  escala = 1
): {
  type: "Feature"
  properties: { tipo: Icono; escala: number }
  geometry: { type: "Point"; coordinates: [number, number] }
} => ({
  type: "Feature",
  properties: { tipo, escala },
  geometry: { type: "Point", coordinates: [lon, lat] },
})

export const DECORACION = {
  type: "FeatureCollection" as const,
  features: [
    // Pirineos
    P("montana", -1.2, 42.85),
    P("montana", -0.4, 42.75, 1.15),
    P("montana", 0.4, 42.65, 1.2),
    P("montana", 1.2, 42.55),
    P("monte", 2.1, 42.45),
    // Cordillera Cantábrica y Picos de Europa
    P("montana", -6.4, 43.0),
    P("montana", -4.8, 43.12, 1.1),
    P("monte", -3.9, 43.05),
    // Montes de León y Galicia
    P("monte", -6.5, 42.35),
    P("monte", -7.4, 42.3, 0.9),
    // Sistema Central
    P("montana", -6.0, 40.3),
    P("montana", -5.1, 40.28, 1.1),
    P("monte", -4.25, 40.82),
    // Sistema Ibérico
    P("monte", -2.7, 41.95),
    P("montana", -2.0, 41.25),
    P("monte", -1.3, 40.45),
    // Sierra Morena y Montes de Toledo
    P("monte", -6.1, 38.05),
    P("monte", -4.8, 38.35),
    P("monte", -4.4, 39.55, 0.9),
    // Béticas y Sierra Nevada
    P("montana", -3.3, 37.08, 1.25),
    P("montana", -2.3, 37.35),
    P("monte", -4.4, 36.85),
    P("monte", -1.8, 38.15),
    // Portugal
    P("montana", -7.6, 40.32, 1.1),
    P("monte", -8.0, 41.75),
    P("monte", -8.55, 37.32, 0.9),
    // Mallorca (Tramuntana)
    P("monte", 2.8, 39.8, 0.8),
    // Bosques
    P("bosque", -8.0, 42.75),
    P("bosque", -5.8, 43.25),
    P("bosque", -1.7, 43.0, 0.9),
    P("bosque", -7.9, 39.4),
    P("bosque", -3.8, 41.6, 0.85),
    // Faros en los cabos
    P("faro", -9.27, 42.88),
    P("faro", -8.99, 37.02),
    P("faro", -2.19, 36.72),
    P("faro", 3.3, 42.3, 0.9),
    // Alrededor, pocos y más pequeños: Rif, Atlas del Tell, Macizo Central, Cerdeña
    P("monte", -4.6, 35.0, 0.8),
    P("monte", 1.6, 36.15, 0.75),
    P("monte", 3.6, 36.4, 0.75),
    P("monte", 2.9, 45.0, 0.75),
    P("monte", 9.1, 40.1, 0.75),
  ],
}

/** Dibuja en un lienzo a doble resolución y devuelve los píxeles para addImage. */
function dibujar(
  ancho: number,
  alto: number,
  pintar: (ctx: CanvasRenderingContext2D) => void
) {
  const lienzo = document.createElement("canvas")
  lienzo.width = ancho * 2
  lienzo.height = alto * 2
  const ctx = lienzo.getContext("2d")!
  ctx.scale(2, 2)
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  pintar(ctx)
  return ctx.getImageData(0, 0, lienzo.width, lienzo.height)
}

/** Un pico con la ladera derecha sombreada con rayas, como en los grabados. */
function pico(
  ctx: CanvasRenderingContext2D,
  x0: number,
  base: number,
  xp: number,
  yp: number,
  x1: number
) {
  ctx.beginPath()
  ctx.moveTo(x0, base)
  ctx.lineTo(xp, yp)
  ctx.lineTo(x1, base)
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(x0, base)
  ctx.lineTo(xp, yp)
  ctx.lineTo(x1, base)
  ctx.stroke()
  ctx.lineWidth = 0.6
  for (let i = 1; i <= 4; i++) {
    const t = i / 5
    const x = xp + (x1 - xp) * t
    const y = yp + (base - yp) * t
    ctx.beginPath()
    ctx.moveTo(x - 1, y + 0.6)
    ctx.lineTo(x - 1 - (base - y) * 0.35, base - 0.6)
    ctx.stroke()
  }
}

function abeto(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  h: number
) {
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.moveTo(x, base)
  ctx.lineTo(x, base - h * 0.25)
  ctx.stroke()
  for (const [arriba, ancho] of [
    [h, h * 0.28],
    [h * 0.7, h * 0.38],
  ]) {
    ctx.beginPath()
    ctx.moveTo(x, base - arriba)
    ctx.lineTo(x - ancho, base - arriba + h * 0.5)
    ctx.lineTo(x + ancho, base - arriba + h * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

/**
 * Píxeles del icono pedido por el estilo ("vintage-<icono>-<tinta>-<papel>"),
 * o null si no es uno de los nuestros.
 */
export function iconoVintage(id: string) {
  const partes =
    /^vintage-(montana|monte|bosque|faro)-(#[0-9a-f]{6})-(#[0-9a-f]{6})$/i.exec(
      id
    )
  if (!partes) return null
  const [, tipo, tinta, papel] = partes
  const conColores = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = tinta
    ctx.fillStyle = papel
  }
  switch (tipo as Icono) {
    case "montana":
      return dibujar(42, 30, (ctx) => {
        conColores(ctx)
        pico(ctx, 3, 28, 13, 11, 23)
        pico(ctx, 12, 28, 25, 3, 39)
      })
    case "monte":
      return dibujar(26, 20, (ctx) => {
        conColores(ctx)
        pico(ctx, 3, 18, 13, 4, 23)
      })
    case "bosque":
      return dibujar(34, 22, (ctx) => {
        conColores(ctx)
        abeto(ctx, 9, 20, 13)
        abeto(ctx, 24, 20, 12)
        abeto(ctx, 16.5, 21, 17)
      })
    case "faro":
      return dibujar(22, 30, (ctx) => {
        conColores(ctx)
        ctx.lineWidth = 1
        // Torre
        ctx.beginPath()
        ctx.moveTo(8, 28)
        ctx.lineTo(9.5, 12)
        ctx.lineTo(12.5, 12)
        ctx.lineTo(14, 28)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        for (const y of [17, 22]) {
          ctx.beginPath()
          ctx.moveTo(9.2, y)
          ctx.lineTo(12.8, y)
          ctx.stroke()
        }
        // Linterna y tejado
        ctx.strokeRect(9.3, 8.5, 3.4, 3.5)
        ctx.beginPath()
        ctx.moveTo(8.5, 8.5)
        ctx.lineTo(11, 5.5)
        ctx.lineTo(13.5, 8.5)
        ctx.stroke()
        // Rayos de luz
        ctx.lineWidth = 0.7
        for (const [dx, dy] of [
          [-6, -2],
          [-6, 2],
          [6, -2],
          [6, 2],
        ]) {
          ctx.beginPath()
          ctx.moveTo(11 + Math.sign(dx) * 3, 10.2)
          ctx.lineTo(11 + dx * 1.4, 10.2 + dy)
          ctx.stroke()
        }
        // Rocas
        ctx.beginPath()
        ctx.moveTo(4, 28.5)
        ctx.quadraticCurveTo(11, 25, 18, 28.5)
        ctx.stroke()
      })
  }
}

type Criatura = "barco" | "pez" | "tiburon"

/** Solo en el mar, repartidos alrededor de la península. */
const CRIATURAS: { tipo: Criatura; lon: number; lat: number }[] = [
  { tipo: "barco", lon: -11.6, lat: 39.6 },
  { tipo: "barco", lon: -4.6, lat: 44.55 },
  { tipo: "barco", lon: 4.9, lat: 38.7 },
  { tipo: "barco", lon: -8.2, lat: 35.9 },
  { tipo: "pez", lon: -10.4, lat: 41.9 },
  { tipo: "pez", lon: -3.6, lat: 36.15 },
  { tipo: "pez", lon: 1.4, lat: 38.1 },
  { tipo: "tiburon", lon: -6.6, lat: 44.15 },
  { tipo: "tiburon", lon: -7.4, lat: 36.45 },
  { tipo: "tiburon", lon: 5.6, lat: 40.6 },
]

const SVG = {
  barco: `<div class="vintage-deriva"><div class="vintage-balanceo"><svg width="48" height="44" viewBox="0 0 48 44">
    <path d="M2 39q4-3 8 0t8 0t8 0t8 0t8 0" />
    <path d="M8 30h32l-5 7H13z" fill="var(--card)" />
    <path d="M24 5v25" />
    <path d="M24.5 7q11 7 0 20z" fill="var(--card)" />
    <path d="M23 9q-8 6 0 16z" fill="var(--card)" />
    <path d="M24 5l6 1.5L24 8" fill="currentColor" />
  </svg></div></div>`,
  pez: `<span class="vintage-onda"></span><div class="vintage-salto"><svg width="28" height="16" viewBox="0 0 28 16">
    <path d="M9 8q7-6 16 0q-9 6-16 0z" fill="var(--card)" />
    <path d="M9 8L3 4l1 4-1 4z" fill="var(--card)" />
    <circle cx="21" cy="7" r="0.9" fill="currentColor" />
  </svg></div>`,
  tiburon: `<div class="vintage-patrulla"><svg width="34" height="16" viewBox="0 0 34 16">
    <path d="M11 13q3-8 9-12q-2 6 2 12z" fill="var(--card)" />
    <path d="M2 13q3-2 6 0t6 0t6 0t6 0t6 0" />
  </svg></div>`,
} satisfies Record<Criatura, string>

/** Añade las criaturas animadas mientras el filtro "Vintage" está activo. */
export function useCriaturasVintage(
  mapaRef: React.RefObject<MapaLibre | null>,
  mapaListo: boolean,
  activo: boolean
) {
  React.useEffect(() => {
    const mapa = mapaRef.current
    if (!activo || !mapaListo || !mapa) return
    let cancelado = false
    const marcadores: Marker[] = []
    void import("maplibre-gl").then(({ default: maplibre }) => {
      if (cancelado) return
      CRIATURAS.forEach((c, i) => {
        const el = document.createElement("div")
        el.className = "vintage-criatura"
        el.setAttribute("aria-hidden", "true")
        // Por debajo de los marcadores de las ciudades (z-index 1 o más).
        el.style.zIndex = "0"
        // Desfase para que no se muevan todas a la vez.
        el.style.setProperty("--retraso", `${-i * 2.3}s`)
        el.innerHTML = SVG[c.tipo]
        marcadores.push(
          new maplibre.Marker({ element: el })
            .setLngLat([c.lon, c.lat])
            .addTo(mapa)
        )
      })
    })
    return () => {
      cancelado = true
      for (const m of marcadores) m.remove()
    }
  }, [mapaRef, mapaListo, activo])
}
