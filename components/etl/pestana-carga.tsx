"use client"

import * as React from "react"
import {
  InfoIcon,
  Loader2Icon,
  RotateCcwIcon,
  SearchCheckIcon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { EstadoCargaSupabase, PipelineEtl } from "@/hooks/use-pipeline-etl"
import { resumirCarga, TAMANO_LOTE, type EstadoLote } from "@/lib/etl/carga"
import { ETIQUETAS_ORDEN } from "@/lib/etl/filtros"
import type { EstadoFase, RegistroValido } from "@/lib/etl/tipos"

import { EstadoBadge } from "./estado-badge"
import { formatoDuracion, formatoEntero } from "./formato"
import { COLUMNAS_VALIDO } from "./pestana-validos"
import { SinDatos } from "./sin-datos"
import { TablaPaginada, type Columna } from "./tabla-paginada"

interface FilaVistaPrevia {
  posicion: number
  lote: number
  registro: RegistroValido
}

const COLUMNAS: Columna<FilaVistaPrevia>[] = [
  { id: "pos", titulo: "Nº", celda: (f) => f.posicion, numerica: true },
  { id: "lote", titulo: "Lote", celda: (f) => f.lote, numerica: true },
  ...COLUMNAS_VALIDO.map((c) => ({
    ...c,
    celda: (f: FilaVistaPrevia) => c.celda(f.registro),
  })),
]

/** Por qué no se puede subir todavía (null si se puede). Lo usa también la guía de pasos. */
export function motivoBloqueoCarga(etl: PipelineEtl): string | null {
  const { estadoSupabase } = etl
  return !estadoSupabase
    ? "Comprobando la conexión con Supabase…"
    : !estadoSupabase.configurado
      ? `Supabase no está configurado: faltan ${estadoSupabase.faltan.join(", ")}.`
      : !estadoSupabase.tablaAccesible
        ? estadoSupabase.mensaje
        : etl.filtrosInterpretados.errores.length > 0
          ? "Corrige los filtros antes de subir."
          : etl.conjuntoCarga.registros.length === 0
            ? "No hay filas seleccionadas que cumplan los filtros."
            : null
}

export function PestanaCarga({ etl }: { etl: PipelineEtl }) {
  const { conjuntoCarga, carga, estadoSupabase, orden } = etl
  const filas = React.useMemo(
    () =>
      conjuntoCarga.registros.map((registro, i) => ({
        posicion: i + 1,
        lote: Math.floor(i / TAMANO_LOTE) + 1,
        registro,
      })),
    [conjuntoCarga.registros]
  )

  if (!etl.procesado && !carga) {
    return (
      <SinDatos>
        Primero descarga los datos (pestaña Extracción); después podrás
        guardarlos aquí.
      </SinDatos>
    )
  }

  const n = conjuntoCarga.registros.length
  const lotesPrevistos = Math.ceil(n / TAMANO_LOTE)
  const motivoBloqueo = motivoBloqueoCarga(etl)

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <InfoIcon aria-hidden />
        <AlertTitle>
          El orden de esta vista no se guarda en la base de datos
        </AlertTitle>
        <AlertDescription>
          Las filas se envían en este orden ({ETIQUETAS_ORDEN[orden.campo]},{" "}
          {orden.direccion === "asc" ? "ascendente" : "descendente"}), pero una
          tabla SQL no conserva el orden de inserción. Para leerlas ordenadas,
          cualquier consulta posterior necesita <code>ORDER BY</code>, por
          ejemplo <code>ORDER BY ciudad, fecha_hora</code>.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          onClick={() => void etl.iniciarCarga()}
          disabled={motivoBloqueo !== null || Boolean(carga?.enCurso)}
        >
          {carga?.enCurso ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <UploadCloudIcon aria-hidden />
          )}
          Guardar {formatoEntero(n)} filas en Supabase
        </Button>
        <span className="text-sm text-muted-foreground">
          {n > 0 &&
            `${lotesPrevistos} lote(s) de hasta ${TAMANO_LOTE} · upsert por (ciudad, fecha_hora)`}
        </span>
      </div>
      {motivoBloqueo && !carga?.enCurso && (
        <p className="text-sm text-muted-foreground" role="status">
          {motivoBloqueo}{" "}
          {estadoSupabase && !estadoSupabase.tablaAccesible && (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => void etl.refrescarEstadoSupabase()}
            >
              Comprobar de nuevo
            </Button>
          )}
        </p>
      )}

      {carga && <InformeCarga etl={etl} carga={carga} />}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          Vista previa: conjunto exacto que se enviará ({formatoEntero(n)}{" "}
          filas)
        </h3>
        <TablaPaginada
          filas={filas}
          columnas={COLUMNAS}
          claveFila={(f) => f.registro.clave}
          etiqueta="Vista previa de la carga"
          vacio="No hay filas seleccionadas que cumplan los filtros."
        />
      </div>
    </div>
  )
}

const ESTADO_LOTE: Record<EstadoLote, EstadoFase> = {
  pendiente: "pendiente",
  enviando: "en_curso",
  completado: "completada",
  error: "error",
}

function InformeCarga({
  etl,
  carga,
}: {
  etl: PipelineEtl
  carga: EstadoCargaSupabase
}) {
  const resumen = resumirCarga(carga.lotes)
  const v = carga.verificacion

  // ¿La vista previa actual sigue siendo idéntica (mismas filas, mismo orden) a lo congelado?
  const actual = etl.conjuntoCarga.registros
  const coincide =
    actual.length === carga.registros.length &&
    actual.every(
      (r, i) =>
        r.ciudad === carga.registros[i].ciudad &&
        r.fecha_hora === carga.registros[i].fecha_hora
    )

  return (
    <section
      aria-label="Estado de la carga"
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          Carga congelada el{" "}
          {new Date(carga.congeladoEn).toLocaleString("es-ES")} ·{" "}
          {formatoEntero(carga.registros.length)} registros
        </h3>
        <span className="text-xs text-muted-foreground">
          {coincide
            ? "✓ La vista previa actual coincide con el conjunto enviado."
            : "≠ La vista previa ha cambiado después de congelar la carga; la carga no se ve afectada."}
        </span>
      </div>

      <dl
        className="grid grid-cols-2 gap-2 text-sm @xl:grid-cols-4"
        aria-live="polite"
      >
        <Dato titulo="Procesados correctamente" valor={resumen.completados} />
        <Dato titulo="Fallidos" valor={resumen.fallidos} />
        <Dato titulo="Pendientes" valor={resumen.pendientes} />
        <Dato titulo="Duración" texto={formatoDuracion(carga.duracionMs)} />
      </dl>
      <p className="text-xs text-muted-foreground">
        Un upsert no indica qué filas eran nuevas y cuáles se actualizaron: por
        eso solo se informa de filas procesadas (insertadas o actualizadas).
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">Estado por lote</caption>
          <thead className="bg-muted/50 text-left">
            <tr className="border-b">
              <th scope="col" className="p-2 font-medium">
                Lote
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Registros
              </th>
              <th scope="col" className="p-2 font-medium">
                Estado
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Procesados
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Intentos
              </th>
              <th scope="col" className="p-2 text-right font-medium">
                Duración
              </th>
              <th scope="col" className="p-2 font-medium">
                Error
              </th>
            </tr>
          </thead>
          <tbody>
            {carga.lotes.map((l) => (
              <tr key={l.numero} className="border-b last:border-0">
                <td className="p-2 tabular-nums">{l.numero}</td>
                <td className="p-2 text-right tabular-nums">
                  {formatoEntero(l.registros.length)}
                </td>
                <td className="p-2">
                  <EstadoBadge
                    estado={ESTADO_LOTE[l.estado]}
                    texto={
                      {
                        pendiente: "Pendiente",
                        enviando: "Enviando",
                        completado: "Completado",
                        error: "Error",
                      }[l.estado]
                    }
                  />
                </td>
                <td className="p-2 text-right tabular-nums">
                  {l.procesados === null ? "—" : formatoEntero(l.procesados)}
                </td>
                <td className="p-2 text-right tabular-nums">{l.intentos}</td>
                <td className="p-2 text-right tabular-nums">
                  {formatoDuracion(l.duracionMs)}
                </td>
                <td className="max-w-md p-2 text-xs whitespace-normal text-red-700 dark:text-red-300">
                  {l.error ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        {resumen.lotesFallidos > 0 && (
          <Button
            variant="outline"
            onClick={() => void etl.reintentarLotesFallidos()}
            disabled={carga.enCurso}
          >
            <RotateCcwIcon aria-hidden />
            Reintentar {resumen.lotesFallidos} lote(s) fallido(s)
          </Button>
        )}
        {resumen.completados > 0 && (
          <Button
            variant="ghost"
            onClick={() => void etl.verificar()}
            disabled={carga.enCurso || v.estado === "en_curso"}
          >
            <SearchCheckIcon aria-hidden />
            Volver a verificar en destino
          </Button>
        )}
      </div>

      <div className="text-sm" role="status">
        <strong>Verificación en destino: </strong>
        {v.estado === "pendiente" &&
          "pendiente (se ejecuta al terminar los lotes)."}
        {v.estado === "en_curso" && "consultando Supabase por lotes…"}
        {v.estado === "error" && (
          <span className="text-red-700 dark:text-red-300">
            <XCircleIcon className="inline size-4" aria-hidden /> {v.error}
          </span>
        )}
        {v.estado === "completada" && (
          <>
            {formatoEntero(v.resultado.encontradas)} de{" "}
            {formatoEntero(v.resultado.comprobadas)} claves enviadas con éxito
            existen en la tabla.
            {v.resultado.faltantes.length > 0 && (
              <span className="text-red-700 dark:text-red-300">
                {" "}
                No se encuentran {v.resultado.faltantes.length}, por ejemplo:{" "}
                {v.resultado.faltantes
                  .slice(0, 5)
                  .map((f) => `${f.ciudad} ${f.fecha_hora}`)
                  .join(", ")}
              </span>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function Dato({
  titulo,
  valor,
  texto,
}: {
  titulo: string
  valor?: number
  texto?: string
}) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <dt className="text-xs text-muted-foreground">{titulo}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {texto ?? formatoEntero(valor ?? 0)}
      </dd>
    </div>
  )
}
