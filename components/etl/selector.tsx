import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Select nativo con el estilo de los inputs: accesible y fiable en móvil.
 * La lista de opciones la pinta el navegador: sin colores propios heredaba el
 * texto claro del tema oscuro sobre fondo blanco y no se leía.
 */
export function Selector({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 dark:scheme-dark [&_option]:bg-popover [&_option]:text-popover-foreground",
        className
      )}
      {...props}
    />
  )
}
