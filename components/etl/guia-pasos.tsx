"use client"

import * as React from "react"
import {
  ChartColumnBigIcon,
  CheckIcon,
  CloudDownloadIcon,
  DatabaseIcon,
  Loader2Icon,
  RotateCcwIcon,
  Table2Icon,
  UploadCloudIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { resumirCarga } from "@/lib/etl/carga"
import { cn } from "@/lib/utils"

import type { Destino } from "./aplicacion-etl"
import { formatoEntero } from "./formato"
import { motivoBloqueoCarga } from "./pestana-carga"
import { calcularFases } from "./pipeline-visual"

const PASOS = ["Descargar", "Guardar", "Listo"] as const

/** Botón principal: grande, a todo el ancho y con el verbo de lo que hace. */
function BotonPrincipal({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      size="lg"
      className="h-12 w-full gap-2.5 rounded-2xl text-base font-semibold shadow-md [&_svg:not([class*='size-'])]:size-5"
      {...props}
    >
      {children}
    </Button>
  )
}

/** Acciones secundarias: pequeñas y discretas, debajo del botón principal. */
function Secundarias({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-1">{children}</div>
}

/** Una línea de aviso, solo cuando hay algo que corregir o esperar. */
function Aviso({
  children,
  error,
}: {
  children: React.ReactNode
  error?: boolean
}) {
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "text-center text-xs",
        error ? "font-medium text-destructive" : "text-muted-foreground"
      )}
    >
      {children}
    </p>
  )
}

/**
 * El siguiente paso y un único botón grande para darlo. Sin explicaciones: la
 * tira de tres pasos ya dice dónde estás, y solo se escribe algo si hay un
 * problema (una ciudad que falló, o por qué aún no se puede guardar).
 */
export function GuiaPasos({
  etl,
  navegar,
  vistaActual,
}: {
  etl: PipelineEtl
  navegar: (destino: Destino) => void
  /** Oculta el botón que llevaría a la vista en la que ya está. */
  vistaActual?: "extraccion" | "resumen"
}) {
  const { extraccion, carga } = etl
  const fases = calcularFases(etl)
  const paso =
    !extraccion || fases[0].estado !== "completada"
      ? 0
      : fases[fases.length - 1].estado === "completada"
        ? 2
        : 1

  return (
    <section
      aria-label="Siguiente paso"
      className="flex flex-col gap-3 rounded-3xl neu p-4"
    >
      <ol
        aria-label="Progreso"
        className="flex items-center justify-center gap-2 text-xs"
      >
        {PASOS.map((titulo, i) => (
          <li key={titulo} className="flex items-center gap-2">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "h-px w-6 @md:w-10",
                  i <= paso ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <span
              aria-current={i === paso ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5",
                i === paso ? "font-medium" : "text-muted-foreground"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[0.65rem] tabular-nums",
                  i < paso && "bg-primary text-primary-foreground",
                  i === paso && "bg-marca text-marca-foreground",
                  i > paso && "ring-1 ring-border"
                )}
              >
                {i < paso ? <CheckIcon className="size-3" /> : i + 1}
              </span>
              {titulo}
              {i < paso && <span className="sr-only">(hecho)</span>}
            </span>
          </li>
        ))}
      </ol>

      {/* Al cambiar de paso, el lector de pantalla lee el nuevo botón. */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {paso === 0 && <PasoDescargar etl={etl} />}
        {paso === 1 && (
          <PasoGuardar etl={etl} navegar={navegar} vistaActual={vistaActual} />
        )}
        {paso === 2 && carga && (
          <>
            <BotonPrincipal onClick={() => navegar("supabase")}>
              <DatabaseIcon aria-hidden />
              Ver lo guardado (
              {formatoEntero(resumirCarga(carga.lotes).completados)} filas)
            </BotonPrincipal>
            <Secundarias>
              <BotonDescargarOtraVez etl={etl} />
            </Secundarias>
          </>
        )}
      </div>
    </section>
  )
}

function BotonDescargarOtraVez({ etl }: { etl: PipelineEtl }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void etl.extraer()}
      disabled={
        Boolean(etl.extraccion?.enCurso) ||
        Boolean(etl.carga?.enCurso) ||
        etl.validacion.errores.length > 0
      }
      title="Vuelve a descargar con las ciudades y fechas elegidas abajo"
    >
      <RotateCcwIcon aria-hidden />
      Descargar otra vez
    </Button>
  )
}

function PasoDescargar({ etl }: { etl: PipelineEtl }) {
  const { extraccion, validacion } = etl
  const ocupado = Boolean(extraccion?.enCurso) || Boolean(etl.carga?.enCurso)
  const [reintentando, setReintentando] = React.useState(false)
  const fallidas =
    extraccion?.descargas.filter((d) => d.estado === "error") ?? []
  const procesadas =
    extraccion?.descargas.filter(
      (d) => d.estado === "ok" || d.estado === "error"
    ).length ?? 0

  if (extraccion?.enCurso) {
    return (
      <BotonPrincipal disabled>
        <Loader2Icon aria-hidden className="animate-spin" />
        Descargando {procesadas} de {extraccion.descargas.length}…
      </BotonPrincipal>
    )
  }

  if (fallidas.length > 0) {
    const reintentar = async () => {
      setReintentando(true)
      for (const d of fallidas) await etl.reintentarCiudad(d.ciudad)
      setReintentando(false)
    }
    return (
      <>
        <BotonPrincipal
          onClick={() => void reintentar()}
          disabled={reintentando || ocupado}
        >
          {reintentando ? (
            <Loader2Icon aria-hidden className="animate-spin" />
          ) : (
            <RotateCcwIcon aria-hidden />
          )}
          Reintentar {fallidas.map((d) => d.ciudad).join(", ")}
        </BotonPrincipal>
        <Aviso error>No se pudo descargar. Suele ser un fallo puntual.</Aviso>
      </>
    )
  }

  const error = validacion.errores[0]
  return (
    <>
      <BotonPrincipal
        onClick={() => void etl.extraer()}
        disabled={ocupado || Boolean(error)}
      >
        <CloudDownloadIcon aria-hidden />
        Descargar los datos
      </BotonPrincipal>
      {error && <Aviso error>{error}</Aviso>}
    </>
  )
}

function PasoGuardar({
  etl,
  navegar,
  vistaActual,
}: {
  etl: PipelineEtl
  navegar: (destino: Destino) => void
  vistaActual?: "extraccion" | "resumen"
}) {
  const { carga, conjuntoCarga } = etl
  const n = conjuntoCarga.registros.length
  const motivo = motivoBloqueoCarga(etl)
  const resumen = carga ? resumirCarga(carga.lotes) : null
  const lotesHechos =
    carga?.lotes.filter((l) => l.estado === "completado").length ?? 0

  return (
    <>
      {carga?.enCurso ? (
        <BotonPrincipal disabled>
          <Loader2Icon aria-hidden className="animate-spin" />
          Guardando… {Math.min(lotesHechos + 1, carga.lotes.length)} de{" "}
          {carga.lotes.length}
        </BotonPrincipal>
      ) : resumen && resumen.fallidos > 0 ? (
        <>
          <BotonPrincipal onClick={() => void etl.reintentarLotesFallidos()}>
            <RotateCcwIcon aria-hidden />
            Reintentar {formatoEntero(resumen.fallidos)} filas
          </BotonPrincipal>
          <Aviso error>Algunas filas no se pudieron guardar.</Aviso>
        </>
      ) : (
        <>
          <BotonPrincipal
            onClick={() => void etl.iniciarCarga()}
            disabled={motivo !== null}
          >
            <UploadCloudIcon aria-hidden />
            Guardar {formatoEntero(n)} filas en Supabase
          </BotonPrincipal>
          {motivo && <Aviso>{motivo}</Aviso>}
        </>
      )}
      <Secundarias>
        <Button variant="ghost" size="sm" onClick={() => navegar("validos")}>
          <Table2Icon aria-hidden />
          Ver tabla
        </Button>
        {vistaActual !== "resumen" && (
          <Button variant="ghost" size="sm" onClick={() => navegar("resumen")}>
            <ChartColumnBigIcon aria-hidden />
            Ver gráficos
          </Button>
        )}
        <BotonDescargarOtraVez etl={etl} />
      </Secundarias>
    </>
  )
}
