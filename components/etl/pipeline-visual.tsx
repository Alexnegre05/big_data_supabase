"use client"

import {
  ArrowRightIcon,
  CloudDownloadIcon,
  DatabaseZapIcon,
  FilterIcon,
  ShuffleIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { resumirCarga } from "@/lib/etl/carga"
import { calcularVolumen } from "@/lib/etl/extraccion"
import type { EstadoFase } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"

import { useResumido } from "./detalle-panel"
import { EncabezadoPaso } from "./encabezado-paso"
import { EstadoBadge } from "./estado-badge"
import { formatoDuracion, formatoEntero } from "./formato"
import type { Pestana } from "./inspeccion-datos"

export interface Fase {
  id: string
  titulo: string
  explicacion: string
  estado: EstadoFase
  textoEstado?: string
  entrada: string
  salida: string
  extra?: string
  duracionMs: number | null
  pestana: Pestana
}

export function calcularFases(etl: PipelineEtl): Fase[] {
  const { extraccion, procesado, carga, conjuntoCarga, filtradosOrdenados } =
    etl

  // 1. Extracción
  const descargas = extraccion?.descargas ?? []
  const fallidas = descargas.filter((d) => d.estado === "error").length
  const filasRecibidas = procesado?.transformacion.diagnosticos.reduce(
    (s, d) => s + d.registrosGenerados,
    0
  )
  const horasPrevistas = extraccion
    ? descargas.length *
      24 *
      (Math.round(
        (Date.parse(extraccion.config.fechaFin) -
          Date.parse(extraccion.config.fechaInicio)) /
          86_400_000
      ) +
        1)
    : 0
  const estadoExtraccion: EstadoFase = !extraccion
    ? "pendiente"
    : extraccion.enCurso
      ? "en_curso"
      : fallidas > 0
        ? "error"
        : "completada"

  // 2. Transformación
  const diagnosticos = procesado?.transformacion.diagnosticos ?? []
  const conAvisosEstructurales = diagnosticos.filter((d) => !d.coherente).length
  const estadoTransformacion: EstadoFase = !procesado
    ? "pendiente"
    : conAvisosEstructurales > 0
      ? "error"
      : "completada"

  // 3. Limpieza
  const limpieza = procesado?.limpieza
  const estadoLimpieza: EstadoFase = limpieza ? "completada" : "pendiente"

  // 4. Filtrado y selección
  const nValidos = limpieza?.validos.length ?? 0
  const nSeleccion = conjuntoCarga.registros.length
  const automatico = etl.modoSeleccion === "automatico"
  // En modo automático la fase se completa sola: la selección es el resultado de los filtros.
  const estadoFiltrado: EstadoFase = !limpieza
    ? "pendiente"
    : etl.filtrosInterpretados.errores.length > 0
      ? "error"
      : automatico || nSeleccion > 0
        ? "completada"
        : "en_curso"

  // 5. Carga
  const resumen = carga ? resumirCarga(carga.lotes) : null
  const estadoCarga: EstadoFase = !carga
    ? "pendiente"
    : carga.enCurso
      ? "en_curso"
      : resumen!.fallidos > 0 ||
          carga.verificacion.estado === "error" ||
          (carga.verificacion.estado === "completada" &&
            carga.verificacion.resultado.faltantes.length > 0)
        ? "error"
        : "completada"

  return [
    {
      id: "extraccion",
      titulo: "Extracción",
      explicacion:
        "Una petición HTTP por ciudad a la API histórica. Se guarda el JSON original sin tocar.",
      estado: estadoExtraccion,
      entrada: extraccion
        ? `${descargas.length} ciudades · ${formatoEntero(horasPrevistas)} h previstas`
        : "—",
      salida:
        filasRecibidas !== undefined
          ? `${formatoEntero(filasRecibidas)} posiciones horarias`
          : "—",
      extra: fallidas > 0 ? `${fallidas} ciudad(es) con error` : undefined,
      duracionMs: extraccion?.duracionMs ?? null,
      pestana: "json",
    },
    {
      id: "transformacion",
      titulo: "Transformación",
      explicacion:
        "Los arrays paralelos (time, temperature_2m…) se convierten en un registro por ciudad y hora, con fecha en UTC.",
      estado: estadoTransformacion,
      textoEstado:
        conAvisosEstructurales > 0 ? "Arrays incoherentes" : undefined,
      entrada:
        filasRecibidas !== undefined
          ? `${formatoEntero(filasRecibidas)} posiciones`
          : "—",
      salida: procesado
        ? `${formatoEntero(procesado.transformacion.registros.length)} registros`
        : "—",
      duracionMs: procesado?.transformacion.duracionMs ?? null,
      pestana: "transformados",
    },
    {
      id: "limpieza",
      titulo: "Limpieza",
      explicacion:
        "Se rechazan filas sin fecha o sin alguna medición, humedad fuera de 0–100, lluvia negativa y duplicados.",
      estado: estadoLimpieza,
      entrada: procesado
        ? `${formatoEntero(procesado.transformacion.registros.length)} registros`
        : "—",
      salida: limpieza ? `${formatoEntero(nValidos)} válidos` : "—",
      extra: limpieza
        ? `${formatoEntero(limpieza.rechazados.length)} rechazados`
        : undefined,
      duracionMs: limpieza?.duracionMs ?? null,
      pestana: "rechazados",
    },
    {
      id: "filtrado",
      titulo: "Filtrado y selección",
      explicacion:
        "Filtros → orden → selección. Por defecto se selecciona automáticamente todo lo que cumple los filtros; puedes ajustarlo a mano.",
      estado: estadoFiltrado,
      textoEstado:
        estadoFiltrado === "en_curso"
          ? "Esperando selección"
          : estadoFiltrado === "error"
            ? "Filtros no válidos"
            : undefined,
      entrada: limpieza ? `${formatoEntero(nValidos)} válidos` : "—",
      salida: limpieza ? `${formatoEntero(nSeleccion)} seleccionados` : "—",
      extra: limpieza
        ? `${formatoEntero(filtradosOrdenados.length)} coinciden · selección ${automatico ? "automática" : "manual"}`
        : undefined,
      duracionMs: limpieza ? etl.duracionFiltradoMs : null,
      pestana: "validos",
    },
    {
      id: "carga",
      titulo: "Carga",
      explicacion:
        "Upsert en Supabase por (ciudad, fecha_hora) en lotes de 500 y verificación posterior de las claves.",
      estado: estadoCarga,
      entrada: carga
        ? `${formatoEntero(carga.registros.length)} congelados`
        : "—",
      salida: resumen
        ? `${formatoEntero(resumen.completados)} confirmados`
        : "—",
      extra:
        resumen && resumen.fallidos > 0
          ? `${formatoEntero(resumen.fallidos)} fallidos`
          : carga?.verificacion.estado === "completada"
            ? `${formatoEntero(carga.verificacion.resultado.encontradas)} verificados en destino`
            : undefined,
      duracionMs: carga?.duracionMs ?? null,
      pestana: "carga",
    },
  ]
}

/** Qué hace cada fase, en palabras de todos los días (para quien no sabe qué es ETL). */
export const ACCIONES_FASE: Record<string, string> = {
  extraccion: "Descargar datos",
  transformacion: "Pasar a tabla",
  limpieza: "Quitar errores",
  filtrado: "Elegir filas",
  carga: "Guardar en Supabase",
}

export const ICONOS_FASE: Record<string, LucideIcon> = {
  extraccion: CloudDownloadIcon,
  transformacion: ShuffleIcon,
  limpieza: SparklesIcon,
  filtrado: FilterIcon,
  carga: DatabaseZapIcon,
}

export function PipelineVisual({
  etl,
  alInspeccionar,
}: {
  etl: PipelineEtl
  alInspeccionar: (pestana: Pestana) => void
}) {
  const resumido = useResumido()
  const fases = calcularFases(etl)
  const completadas = fases.filter((f) => f.estado === "completada").length

  return (
    <section aria-labelledby="titulo-pipeline" className="flex flex-col gap-4">
      <EncabezadoPaso
        numero={2}
        id="titulo-pipeline"
        titulo="Pipeline"
        descripcion={
          resumido
            ? "Lo que le pasa a los datos en cada fase. Pulsa una fase para inspeccionar sus registros."
            : "Lo que le pasa a los datos en cada fase. Pulsa una fase o una barra del embudo para inspeccionar sus registros."
        }
      >
        <span className="rounded-full neu-sm px-3 py-1 text-xs tabular-nums">
          {completadas} de {fases.length} fases completadas
        </span>
      </EncabezadoPaso>

      {resumido ? (
        <FilasFases fases={fases} alInspeccionar={alInspeccionar} />
      ) : (
        <>
          <div className="rounded-3xl neu p-5 @xl:p-6">
            <Embudo etl={etl} alInspeccionar={alInspeccionar} />
          </div>
          <TarjetasFases fases={fases} alInspeccionar={alInspeccionar} />
        </>
      )}
    </section>
  )
}

/** Versión compacta: una fila por fase con lo que pide la práctica y nada más. */
function FilasFases({
  fases,
  alInspeccionar,
}: {
  fases: Fase[]
  alInspeccionar: (pestana: Pestana) => void
}) {
  return (
    <ol className="flex flex-col divide-y overflow-hidden rounded-2xl neu">
      {fases.map((f, i) => {
        const Icono = ICONOS_FASE[f.id]
        return (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => alInspeccionar(f.pestana)}
              aria-label={`Fase ${i + 1}: ${f.titulo}. Inspeccionar resultados`}
              className={cn(
                "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                f.estado === "error" && "bg-red-500/5",
                f.estado === "en_curso" && "bg-marca/5"
              )}
            >
              <Icono aria-hidden className="size-4 text-marca" />
              <span className="truncate font-medium">
                <span className="text-muted-foreground">{i + 1}.</span>{" "}
                {f.titulo}
              </span>
              <EstadoBadge estado={f.estado} texto={f.textoEstado} />
              <span className="col-span-2 col-start-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground tabular-nums">
                <span className="sr-only">Entrada:</span>
                {f.entrada}
                <ArrowRightIcon aria-hidden className="size-3 text-marca" />
                <span className="sr-only">Salida:</span>
                <span className="font-medium text-foreground">{f.salida}</span>
                {f.extra && <span>· {f.extra}</span>}
                <span>· {formatoDuracion(f.duracionMs)}</span>
              </span>
              <span className="col-span-2 col-start-2 text-xs text-muted-foreground">
                {f.explicacion}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** Versión completa: una tarjeta por fase. */
function TarjetasFases({
  fases,
  alInspeccionar,
}: {
  fases: Fase[]
  alInspeccionar: (pestana: Pestana) => void
}) {
  return (
    <ol className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-5">
      {fases.map((f, i) => {
        const Icono = ICONOS_FASE[f.id]
        return (
          <li key={f.id} className="flex">
            <button
              type="button"
              onClick={() => alInspeccionar(f.pestana)}
              className={cn(
                "group flex flex-1 flex-col gap-3 rounded-3xl neu p-4 text-left text-sm transition-all outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
                f.estado === "error" && "ring-2 ring-red-600/40",
                f.estado === "en_curso" && "ring-2 ring-marca/50"
              )}
              aria-label={`Fase ${i + 1}: ${f.titulo}. Inspeccionar resultados`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl neu-hundido">
                  <Icono aria-hidden className="size-4 text-marca" />
                </span>
                <EstadoBadge estado={f.estado} texto={f.textoEstado} />
              </div>
              <span className="font-medium">
                <span className="text-muted-foreground">{i + 1}.</span>{" "}
                {f.titulo}
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {f.explicacion}
              </p>
              <dl className="mt-auto flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">Entrada</dt>
                  <dd className="text-muted-foreground tabular-nums">
                    {f.entrada}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowRightIcon
                    aria-hidden
                    className="size-3 shrink-0 text-marca"
                  />
                  <dt className="sr-only">Salida</dt>
                  <dd className="font-medium tabular-nums">{f.salida}</dd>
                </div>
                {f.extra && (
                  <div>
                    <dt className="sr-only">Detalle</dt>
                    <dd className="text-muted-foreground tabular-nums">
                      {f.extra}
                    </dd>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Duración</dt>
                  <dd className="tabular-nums">
                    {formatoDuracion(f.duracionMs)}
                  </dd>
                </div>
              </dl>
              <span className="flex items-center gap-1 text-xs font-medium text-marca">
                Inspeccionar
                <ArrowRightIcon
                  aria-hidden
                  className="size-3 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** Cuántos registros sobreviven a cada paso, como barras proporcionales. */
function Embudo({
  etl,
  alInspeccionar,
}: {
  etl: PipelineEtl
  alInspeccionar: (pestana: Pestana) => void
}) {
  const { extraccion, procesado, conjuntoCarga, carga } = etl
  const previstas = extraccion
    ? (calcularVolumen(extraccion.config)?.registrosPrevistos ?? null)
    : null
  const recibidas =
    procesado?.transformacion.diagnosticos.reduce(
      (s, d) => s + d.registrosGenerados,
      0
    ) ?? null
  const filas: {
    titulo: string
    valor: number | null
    pestana: Pestana
    perdida: string
  }[] = [
    {
      titulo: "Horas previstas",
      valor: previstas,
      pestana: "json",
      perdida: "",
    },
    {
      titulo: "Recibidas de la API",
      valor: recibidas,
      pestana: "json",
      perdida: "sin respuesta",
    },
    {
      titulo: "Transformadas",
      valor: procesado ? procesado.transformacion.registros.length : null,
      pestana: "transformados",
      perdida: "descartadas",
    },
    {
      titulo: "Válidas",
      valor: procesado ? procesado.limpieza.validos.length : null,
      pestana: "rechazados",
      perdida: "rechazadas",
    },
    {
      titulo: "Seleccionadas",
      valor: procesado ? conjuntoCarga.registros.length : null,
      pestana: "carga",
      perdida: "fuera de filtros",
    },
    {
      titulo: "Cargadas en Supabase",
      valor: carga ? resumirCarga(carga.lotes).completados : null,
      pestana: "supabase",
      perdida: "sin cargar",
    },
  ]
  const maximo = Math.max(1, ...filas.map((f) => f.valor ?? 0))

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Embudo de datos</h3>
      <ul className="flex flex-col gap-2">
        {filas.map((f, i) => {
          const anterior = i > 0 ? filas[i - 1].valor : null
          const perdidas =
            f.valor !== null && anterior !== null ? anterior - f.valor : 0
          return (
            <li key={f.titulo}>
              <button
                type="button"
                onClick={() => alInspeccionar(f.pestana)}
                className="group grid w-full grid-cols-[8rem_1fr] items-center gap-3 rounded-xl p-1 text-left text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 @xl:grid-cols-[11rem_1fr_9rem]"
              >
                <span className="text-muted-foreground group-hover:text-foreground">
                  {f.titulo}
                </span>
                <span className="h-7 overflow-hidden rounded-lg neu-hundido p-1">
                  {f.valor !== null && (
                    <span
                      className={cn(
                        "flex h-full items-center justify-end rounded-md px-2 font-medium tabular-nums transition-[width] duration-700",
                        i === filas.length - 1
                          ? "bg-marca text-marca-foreground"
                          : "bg-chart-2 text-primary-foreground"
                      )}
                      style={{
                        width: `${Math.max(6, (f.valor / maximo) * 100)}%`,
                      }}
                    >
                      {formatoEntero(f.valor)}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "col-start-2 text-muted-foreground tabular-nums @xl:col-start-3",
                    perdidas > 0 && "text-red-700 dark:text-red-300"
                  )}
                >
                  {f.valor === null
                    ? "—"
                    : perdidas > 0
                      ? `−${formatoEntero(perdidas)} ${f.perdida}`
                      : i > 0
                        ? "sin pérdidas"
                        : ""}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
