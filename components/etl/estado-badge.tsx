import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Loader2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { EstadoFase } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"

export const ESTADOS: Record<
  EstadoFase,
  { texto: string; icono: typeof CheckCircle2Icon; clase: string }
> = {
  pendiente: {
    texto: "Pendiente",
    icono: CircleDashedIcon,
    clase: "border-border bg-transparent text-muted-foreground",
  },
  en_curso: {
    texto: "En curso",
    icono: Loader2Icon,
    clase: "border-marca/40 bg-accent text-accent-foreground dark:bg-marca/15",
  },
  completada: {
    texto: "Completada",
    icono: CheckCircle2Icon,
    clase:
      "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  error: {
    texto: "Con errores",
    icono: AlertTriangleIcon,
    clase:
      "border-red-600/30 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
}

/** El estado se comunica con icono + texto, no solo con color. */
export function EstadoBadge({
  estado,
  texto,
  className,
}: {
  estado: EstadoFase
  texto?: string
  className?: string
}) {
  const { texto: base, icono: Icono, clase } = ESTADOS[estado]
  return (
    <Badge variant="outline" className={cn("gap-1", clase, className)}>
      <Icono
        aria-hidden
        className={cn(estado === "en_curso" && "animate-spin")}
      />
      {texto ?? base}
    </Badge>
  )
}
