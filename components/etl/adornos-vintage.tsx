"use client"

import * as React from "react"
import type { Map as MapaLibre } from "maplibre-gl"

import { cn } from "@/lib/utils"

/** Diferencia angular más corta de a hacia b, en grados (−180…180). */
function diferencia(a: number, b: number) {
  return ((((b - a) % 360) + 540) % 360) - 180
}

/**
 * Rosa de los vientos que se comporta como una brújula: la carta apunta al
 * norte real (sigue el giro del mapa), tiembla al mover el ratón por el mapa y
 * da una vuelta al pasar por encima antes de asentarse con un muelle
 * amortiguado. Al pulsarla, el mapa vuelve a orientarse al norte.
 */
export function RosaVientos({
  mapaRef,
  mapaListo,
  className,
}: {
  mapaRef: React.RefObject<MapaLibre | null>
  mapaListo: boolean
  className?: string
}) {
  const botonRef = React.useRef<HTMLButtonElement>(null)
  const cartaRef = React.useRef<SVGGElement>(null)

  React.useEffect(() => {
    const mapa = mapaRef.current
    const carta = cartaRef.current
    const boton = botonRef.current
    if (!mapaListo || !mapa || !carta || !boton) return

    const reducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const norte = () => -mapa.getBearing()
    let angulo = norte()
    let velocidad = 0
    let fotograma = 0
    let anterior = 0

    const pintar = () => carta.setAttribute("transform", `rotate(${angulo})`)

    // Muelle amortiguado: oscila unas pocas veces y se queda en el norte.
    const paso = (t: number) => {
      const dt = Math.min(0.05, (t - anterior) / 1000)
      anterior = t
      const desvio = diferencia(norte(), angulo)
      velocidad += (-38 * desvio - 3.6 * velocidad) * dt
      angulo += velocidad * dt
      pintar()
      if (Math.abs(velocidad) < 0.5 && Math.abs(desvio) < 0.2) {
        angulo = norte()
        pintar()
        fotograma = 0
        return
      }
      fotograma = requestAnimationFrame(paso)
    }

    const empujar = (impulso: number) => {
      if (reducido) {
        angulo = norte()
        pintar()
        return
      }
      velocidad = Math.max(-720, Math.min(720, velocidad + impulso))
      if (!fotograma) {
        anterior = performance.now()
        fotograma = requestAnimationFrame(paso)
      }
    }

    const alGirarMapa = () => empujar(0)
    const alMoverRaton = (e: PointerEvent) =>
      empujar(Math.max(-30, Math.min(30, e.movementX * 0.7)))
    const alEntrar = () => empujar(Math.random() < 0.5 ? -420 : 420)

    const contenedor = mapa.getContainer()
    pintar()
    mapa.on("rotate", alGirarMapa)
    contenedor.addEventListener("pointermove", alMoverRaton)
    boton.addEventListener("pointerenter", alEntrar)
    return () => {
      cancelAnimationFrame(fotograma)
      mapa.off("rotate", alGirarMapa)
      contenedor.removeEventListener("pointermove", alMoverRaton)
      boton.removeEventListener("pointerenter", alEntrar)
    }
  }, [mapaRef, mapaListo])

  const punta = (giro: number, largo: number, ancho: number) => (
    <g key={giro} transform={`rotate(${giro})`}>
      <path
        d={`M0 0 L0 ${-largo} L${-ancho} ${-ancho}Z`}
        fill="var(--foreground)"
      />
      <path d={`M0 0 L0 ${-largo} L${ancho} ${-ancho}Z`} fill="var(--card)" />
    </g>
  )

  return (
    <button
      ref={botonRef}
      type="button"
      aria-label="Orientar el mapa al norte"
      title="Orientar el mapa al norte"
      onClick={() => mapaRef.current?.easeTo({ bearing: 0, pitch: 0 })}
      className={cn(
        "rounded-full opacity-80 transition-[opacity,scale] duration-300 outline-none hover:scale-105 hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <svg
        aria-hidden
        viewBox="-52 -52 104 104"
        className="size-full drop-shadow-sm"
        stroke="var(--foreground)"
        strokeWidth={0.5}
        strokeLinejoin="round"
      >
        {/* Bisel fijo con las marcas de grados. */}
        <circle r={50} fill="var(--card)" fillOpacity={0.55} strokeWidth={1} />
        <circle r={45} fill="none" />
        {Array.from({ length: 72 }, (_, i) => (
          <line
            key={i}
            y1={-45}
            y2={i % 9 === 0 ? -50 : i % 3 === 0 ? -48 : -46.5}
            transform={`rotate(${i * 5})`}
          />
        ))}
        {/* Carta giratoria: puntas, iniciales y centro. */}
        <g ref={cartaRef}>
          <circle r={36} fill="none" strokeDasharray="1 2" />
          {[45, 135, 225, 315].map((a) => punta(a, 26, 5))}
          {[0, 90, 180, 270].map((a) => punta(a, 40, 7))}
          {(
            [
              ["N", 0],
              ["E", 90],
              ["S", 180],
              ["O", 270],
            ] as const
          ).map(([letra, giro]) => (
            <text
              key={letra}
              transform={`rotate(${giro}) translate(0 -29)`}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={letra === "N" ? 9 : 7}
              fill={letra === "N" ? "var(--marca)" : "var(--foreground)"}
              stroke="none"
              style={{ fontFamily: "var(--font-vintage-titulo), serif" }}
            >
              {letra}
            </text>
          ))}
          <circle r={4} fill="var(--card)" />
          <circle r={1.6} fill="var(--foreground)" />
        </g>
      </svg>
    </button>
  )
}

/** Medallón de esquina: círculo doble con una estrella de cuatro puntas. */
function Medallon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="-16 -16 32 32"
      className={cn("absolute size-9", className)}
      stroke="currentColor"
      strokeWidth={0.8}
    >
      <circle r={15} fill="var(--card)" />
      <circle r={11.5} fill="none" />
      <path
        d="M0-10L2.2-2.2L10 0L2.2 2.2L0 10L-2.2 2.2L-10 0L-2.2-2.2Z"
        fill="currentColor"
        fillOpacity={0.25}
      />
      <circle r={1.5} fill="currentColor" />
    </svg>
  )
}

/**
 * Marco de carta antigua: margen de papel, filete exterior, banda con muescas,
 * filete interior y medallones en las esquinas. No recibe el ratón.
 */
export function MarcoVintage() {
  const banda = "absolute border-current opacity-70"
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 text-foreground/75"
    >
      {/* Margen de papel alrededor del mapa. */}
      <div className="absolute inset-1.5 border-[22px] border-card/90" />
      <div className="absolute inset-1.5 border-2 border-current" />
      {/* Banda con muescas, como una regla de grados. */}
      <div
        className={cn(banda, "inset-x-3 top-3 h-2.5 border-y")}
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, currentColor 0 1.5px, transparent 1.5px 9px)",
        }}
      />
      <div
        className={cn(banda, "inset-x-3 bottom-3 h-2.5 border-y")}
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, currentColor 0 1.5px, transparent 1.5px 9px)",
        }}
      />
      <div
        className={cn(banda, "inset-y-3 left-3 w-2.5 border-x")}
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, currentColor 0 1.5px, transparent 1.5px 9px)",
        }}
      />
      <div
        className={cn(banda, "inset-y-3 right-3 w-2.5 border-x")}
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, currentColor 0 1.5px, transparent 1.5px 9px)",
        }}
      />
      <div className="absolute inset-[26px] border border-current" />
      <Medallon className="top-0 left-0" />
      <Medallon className="top-0 right-0" />
      <Medallon className="bottom-0 left-0" />
      <Medallon className="right-0 bottom-0" />
    </div>
  )
}
