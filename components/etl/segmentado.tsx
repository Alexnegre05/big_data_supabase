"use client"

import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface OpcionSegmentada<T extends string> {
  valor: T
  titulo: string
  icono?: LucideIcon
}

/** Control segmentado neumórfico: pista hundida y opción activa en relieve. */
export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  soloIconos,
  disabled,
  className,
}: {
  etiqueta: string
  opciones: OpcionSegmentada<T>[]
  valor: T
  alCambiar: (v: T) => void
  /** Oculta el texto en pantallas pequeñas (queda como aria-label/tooltip). */
  soloIconos?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className={cn("flex gap-1 rounded-xl neu-hundido p-1", className)}
    >
      {opciones.map(({ valor: v, titulo, icono: Icono }) => {
        const activo = v === valor
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={titulo}
            title={titulo}
            disabled={disabled}
            onClick={() => alCambiar(v)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
              activo
                ? "neu-sm font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icono && (
              <Icono
                aria-hidden
                className={cn("size-3.5", activo && "text-marca")}
              />
            )}
            <span className={cn(soloIconos && Icono && "hidden @xl:inline")}>
              {titulo}
            </span>
          </button>
        )
      })}
    </div>
  )
}
