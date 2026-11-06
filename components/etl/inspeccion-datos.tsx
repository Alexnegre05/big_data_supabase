"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  DatabaseIcon,
  FileJsonIcon,
  ShuffleIcon,
  UploadCloudIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { cn } from "@/lib/utils"

import { EncabezadoPaso } from "./encabezado-paso"
import { formatoEntero } from "./formato"
import { PestanaCarga } from "./pestana-carga"
import { PestanaJson } from "./pestana-json"
import { PestanaRechazados } from "./pestana-rechazados"
import { PestanaSupabase } from "./pestana-supabase"
import { PestanaTransformados } from "./pestana-transformados"
import { PestanaValidos } from "./pestana-validos"

export type Pestana =
  "json" | "transformados" | "validos" | "rechazados" | "carga" | "supabase"

/**
 * Lleva `el` al principio de su contenedor con scroll más cercano (el panel).
 * No se usa scrollIntoView porque desplaza también los ancestros con
 * `overflow: hidden` (la página entera): subía la aplicación, dejaba un hueco
 * abajo y no se podía volver con la rueda.
 */
function desplazarDentro(el: HTMLElement) {
  let contenedor = el.parentElement
  while (
    contenedor &&
    !/(auto|scroll)/.test(getComputedStyle(contenedor).overflowY)
  ) {
    contenedor = contenedor.parentElement
  }
  if (!contenedor) return
  const distancia =
    el.getBoundingClientRect().top - contenedor.getBoundingClientRect().top - 8
  contenedor.scrollBy({ top: distancia, behavior: "smooth" })
}

/**
 * Los datos de cada fase como un acordeón en el orden del pipeline. Se pueden
 * abrir varias secciones a la vez; solo se montan las abiertas.
 *
 * `pestana` es la última sección pedida (desde la cabecera o desde el riel del
 * pipeline): siempre está abierta y es la que se resalta arriba.
 */
export function InspeccionDatos({
  etl,
  pestana,
  setPestana,
}: {
  etl: PipelineEtl
  pestana: Pestana | null
  setPestana: (p: Pestana | null) => void
}) {
  const p = etl.procesado
  const secciones: {
    valor: Pestana
    titulo: string
    descripcion: string
    icono: LucideIcon
    total?: number
    contenido: () => React.ReactNode
  }[] = [
    {
      valor: "json",
      titulo: "JSON original",
      descripcion: "La respuesta de la API por ciudad, sin tocar.",
      icono: FileJsonIcon,
      total: etl.extraccion?.descargas.filter((d) => d.estado === "ok").length,
      contenido: () => <PestanaJson etl={etl} />,
    },
    {
      valor: "transformados",
      titulo: "Transformados",
      descripcion: "Un registro por ciudad y hora, antes de limpiar.",
      icono: ShuffleIcon,
      total: p?.transformacion.registros.length,
      contenido: () => <PestanaTransformados etl={etl} />,
    },
    {
      valor: "validos",
      titulo: "Válidos",
      descripcion: "Filtra, ordena y elige qué filas subir.",
      icono: CheckCircle2Icon,
      total: p?.limpieza.validos.length,
      contenido: () => <PestanaValidos etl={etl} />,
    },
    {
      valor: "rechazados",
      titulo: "Rechazados",
      descripcion: "Filas descartadas en la limpieza y su motivo.",
      icono: XCircleIcon,
      total: p?.limpieza.rechazados.length,
      contenido: () => <PestanaRechazados etl={etl} />,
    },
    {
      valor: "carga",
      titulo: "Vista previa de la carga",
      descripcion: "Exactamente lo que se enviará a Supabase, en ese orden.",
      icono: UploadCloudIcon,
      total: p ? etl.conjuntoCarga.registros.length : undefined,
      contenido: () => <PestanaCarga etl={etl} />,
    },
    {
      valor: "supabase",
      titulo: "Datos en Supabase",
      descripcion: "Lo que ya está guardado en la base de datos.",
      icono: DatabaseIcon,
      contenido: () => <PestanaSupabase etl={etl} />,
    },
  ]

  // Secciones abiertas a mano, además de `pestana`.
  const [abiertas, setAbiertas] = React.useState<ReadonlySet<Pestana>>(
    () => new Set()
  )
  const estaAbierta = (v: Pestana) => pestana === v || abiertas.has(v)
  const alternar = (v: Pestana) => {
    if (estaAbierta(v)) {
      setAbiertas((a) => {
        const nuevo = new Set(a)
        nuevo.delete(v)
        return nuevo
      })
      if (pestana === v) setPestana(null)
    } else {
      setAbiertas((a) => new Set(a).add(v))
      setPestana(v)
    }
  }

  // Al abrir una sección (también desde el riel del pipeline) se lleva su cabecera arriba.
  const elementosRef = React.useRef<Partial<Record<Pestana, HTMLElement>>>({})
  React.useEffect(() => {
    if (!pestana) return
    const id = requestAnimationFrame(() => {
      const el = elementosRef.current[pestana]
      if (el) desplazarDentro(el)
    })
    return () => cancelAnimationFrame(id)
  }, [pestana])

  return (
    <section
      id="inspeccion"
      aria-labelledby="titulo-inspeccion"
      className="flex flex-col gap-4"
    >
      <EncabezadoPaso
        numero={3}
        id="titulo-inspeccion"
        titulo="Datos"
        descripcion="Abre una o varias fases para revisar y comparar sus registros."
      />
      <ol className="flex flex-col gap-2">
        {secciones.map(
          (
            { valor, titulo, descripcion, icono: Icono, total, contenido },
            i
          ) => {
            const abierta = estaAbierta(valor)
            return (
              <li
                key={valor}
                ref={(el) => {
                  if (el) elementosRef.current[valor] = el
                }}
                className={cn(
                  "scroll-mt-2 overflow-hidden rounded-2xl transition-shadow",
                  abierta ? "neu" : "neu-sm"
                )}
              >
                <h3>
                  <button
                    type="button"
                    id={`cabecera-${valor}`}
                    aria-expanded={abierta}
                    aria-controls={`seccion-${valor}`}
                    onClick={() => alternar(valor)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  >
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl neu-hundido"
                    >
                      <Icono className="size-4 text-marca" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        {titulo}
                        {total !== undefined && (
                          <span className="rounded-full bg-marca/15 px-1.5 text-xs font-normal tabular-nums">
                            <span className="sr-only">(</span>
                            {formatoEntero(total)}
                            <span className="sr-only">)</span>
                          </span>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {descripcion}
                      </span>
                    </span>
                    <ChevronDownIcon
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        abierta && "rotate-180"
                      )}
                    />
                  </button>
                </h3>
                {abierta && (
                  <div
                    id={`seccion-${valor}`}
                    role="region"
                    aria-labelledby={`cabecera-${valor}`}
                    className="border-t p-4 @xl:p-5"
                  >
                    {contenido()}
                  </div>
                )}
              </li>
            )
          }
        )}
      </ol>
    </section>
  )
}
