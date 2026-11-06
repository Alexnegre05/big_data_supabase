"use client"

import {
  CheckCircle2Icon,
  CloudDownloadIcon,
  FilterIcon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"

import { useResumido } from "./detalle-panel"
import { formatoEntero, formatoPorcentaje } from "./formato"

interface Kpi {
  titulo: string
  valor: number | null
  ayuda: string
  icono: typeof CheckCircle2Icon
  porcentaje?: string
}

/** Los cinco contadores que la práctica pide distinguir siempre. */
export function TarjetasKpi({ etl }: { etl: PipelineEtl }) {
  const resumido = useResumido()
  const { procesado, filtradosOrdenados, conjuntoCarga, extraccion } = etl
  const total = procesado?.transformacion.registros.length ?? 0
  const validos = procesado?.limpieza.validos.length ?? 0
  const rechazados = procesado?.limpieza.rechazados.length ?? 0
  const ciudades = extraccion?.descargas.filter((d) => d.estado === "ok").length

  const kpis: Kpi[] = [
    {
      titulo: "Total extraído",
      valor: procesado ? total : null,
      ayuda: procesado
        ? `Una fila por ciudad y hora · ${ciudades} ciudades`
        : "Una fila por ciudad y hora",
      icono: CloudDownloadIcon,
    },
    {
      titulo: "Válidos",
      valor: procesado ? validos : null,
      ayuda: "Superan las reglas de calidad",
      icono: CheckCircle2Icon,
      porcentaje: procesado ? formatoPorcentaje(validos, total) : undefined,
    },
    {
      titulo: "Rechazados",
      valor: procesado ? rechazados : null,
      ayuda: "Descartes por calidad o duplicado",
      icono: XCircleIcon,
      porcentaje: procesado ? formatoPorcentaje(rechazados, total) : undefined,
    },
    {
      titulo: "Coinciden con los filtros",
      valor: procesado ? filtradosOrdenados.length : null,
      ayuda: "Válidos que cumplen los filtros actuales",
      icono: FilterIcon,
    },
    {
      titulo: "Seleccionados para cargar",
      valor: procesado ? conjuntoCarga.registros.length : null,
      ayuda: "Seleccionados y dentro de los filtros",
      icono: UploadCloudIcon,
    },
  ]

  const aviso = conjuntoCarga.seleccionadosFueraDeFiltro > 0 && (
    <p className="text-sm text-amber-800 dark:text-amber-300" role="status">
      ⚠ {formatoEntero(conjuntoCarga.seleccionadosFueraDeFiltro)} fila(s)
      seleccionada(s) quedan fuera de los filtros actuales y no se subirán.
    </p>
  )

  if (resumido) {
    return (
      <section aria-label="Contadores" className="flex flex-col gap-2">
        <dl className="grid grid-cols-2 gap-1 rounded-2xl neu p-2 @md:grid-cols-3 @3xl:grid-cols-5">
          {kpis.map(({ titulo, valor, ayuda, porcentaje }) => (
            <div
              key={titulo}
              title={ayuda}
              className="flex flex-col gap-0.5 rounded-xl px-3 py-2"
            >
              <dt className="order-2 text-xs leading-tight text-muted-foreground">
                {titulo}
              </dt>
              <dd className="order-1 flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tracking-tight tabular-nums">
                  {valor === null ? "—" : formatoEntero(valor)}
                </span>
                {porcentaje && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {porcentaje}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {aviso}
      </section>
    )
  }

  return (
    <section
      aria-label="Indicadores principales"
      className="flex flex-col gap-2"
    >
      <dl className="grid grid-cols-2 gap-4 @3xl:grid-cols-3 @5xl:grid-cols-5 @5xl:gap-6">
        {kpis.map(({ titulo, valor, ayuda, icono: Icono, porcentaje }) => (
          <div
            key={titulo}
            className="flex flex-col gap-3 rounded-3xl neu p-4 @xl:p-5"
          >
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-2xl neu-hundido"
            >
              <Icono className="size-5 text-marca" />
            </span>
            <div className="flex flex-col gap-1">
              <dt className="order-2 text-sm text-muted-foreground">
                {titulo}
              </dt>
              <dd className="order-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums @xl:text-3xl">
                  {valor === null ? "—" : formatoEntero(valor)}
                </span>
                {porcentaje && (
                  <span className="rounded-md neu-hundido px-1.5 py-0.5 text-xs font-medium tabular-nums">
                    {porcentaje}
                  </span>
                )}
              </dd>
              <dd className="order-3 text-xs text-muted-foreground">{ayuda}</dd>
            </div>
          </div>
        ))}
      </dl>
      {aviso}
    </section>
  )
}
