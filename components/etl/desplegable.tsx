"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface OpcionDesplegable<T extends string> {
  valor: T
  titulo: string
  /** Punto de color delante del texto (p. ej. el color de la ciudad). */
  color?: string
}

/**
 * Desplegable de shadcn (Base UI): a diferencia del <select> nativo, la lista
 * se pinta con los colores del tema, así que se lee bien en modo oscuro.
 */
export function Desplegable<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  disabled,
  className,
}: {
  etiqueta: string
  opciones: OpcionDesplegable<T>[]
  valor: T
  alCambiar: (v: T) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Select
      items={opciones.map((o) => ({ value: o.valor, label: o.titulo }))}
      value={valor}
      onValueChange={(v) => v !== null && alCambiar(v as T)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={etiqueta}
        className={cn(
          "h-9 min-w-36 rounded-xl border-0 neu-sm px-3 dark:bg-background dark:hover:bg-background",
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl p-1">
        {opciones.map((o) => (
          <SelectItem
            key={o.valor}
            value={o.valor}
            className="rounded-lg py-1.5"
          >
            {o.color && (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: o.color }}
              />
            )}
            {o.titulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
