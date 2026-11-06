"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

/**
 * Un solo botón que alterna entre tema claro y oscuro. Iconos y textos dependen
 * de la clase `dark` (CSS), así que no hay desajuste de hidratación.
 */
export function BotonTema({
  conTexto,
  className,
}: {
  /** Muestra "Modo oscuro" / "Modo claro" junto al icono. */
  conTexto?: boolean
  className?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const alternar = () => setTheme(resolvedTheme === "dark" ? "light" : "dark")

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label="Cambiar entre tema claro y oscuro"
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm ring-1 ring-foreground/10 transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        !conTexto && "w-9 justify-center px-0",
        className
      )}
    >
      <span aria-hidden className="relative size-4 shrink-0">
        <SunIcon className="absolute inset-0 size-4 transition-transform duration-500 group-hover:rotate-90 dark:scale-0" />
        <MoonIcon className="absolute inset-0 size-4 scale-0 transition-transform duration-500 group-hover:-rotate-[25deg] dark:scale-100" />
      </span>
      {conTexto && (
        <span>
          <span className="dark:hidden">Modo claro</span>
          <span className="hidden dark:inline">Modo oscuro</span>
        </span>
      )}

      {/* Aviso al pasar el ratón o al llegar con el teclado. */}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-30 rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background opacity-0 shadow-md transition-all duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
          conTexto
            ? "bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 group-hover:translate-y-0"
            : "top-full right-0 mt-2 -translate-y-1 group-hover:translate-y-0"
        )}
      >
        <span className="dark:hidden">Cambiar a modo oscuro</span>
        <span className="hidden dark:inline">Cambiar a modo claro</span>
        <kbd className="ml-1.5 rounded bg-background/20 px-1 font-mono">D</kbd>
      </span>
    </button>
  )
}
