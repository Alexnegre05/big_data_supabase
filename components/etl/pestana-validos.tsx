"use client"

import * as React from "react"
import {
  CheckSquareIcon,
  ChevronDownIcon,
  FilterXIcon,
  MousePointerClickIcon,
  SquareIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  cumpleFiltros,
  ETIQUETAS_ORDEN,
  FILTROS_INICIALES,
  ORDEN_INICIAL,
  type CampoOrden,
  type Filtros,
} from "@/lib/etl/filtros"
import type { RegistroValido } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"

import { formatoEntero, formatoFechaUtc, formatoNumero } from "./formato"
import { Selector } from "./selector"
import { SinDatos } from "./sin-datos"
import { TablaPaginada, type Columna } from "./tabla-paginada"

export const COLUMNAS_VALIDO: Columna<RegistroValido>[] = [
  { id: "ciudad", titulo: "Ciudad", celda: (r) => r.ciudad },
  {
    id: "fecha",
    titulo: "Fecha y hora (UTC)",
    celda: (r) => formatoFechaUtc(r.fecha_hora),
  },
  {
    id: "temp",
    titulo: "Temperatura (°C)",
    celda: (r) => formatoNumero(r.temperatura_c),
    numerica: true,
  },
  {
    id: "hum",
    titulo: "Humedad (%)",
    celda: (r) => formatoNumero(r.humedad_pct),
    numerica: true,
  },
  {
    id: "prec",
    titulo: "Precipitación (mm)",
    celda: (r) => formatoNumero(r.precipitacion_mm),
    numerica: true,
  },
]

type Vista = "coinciden" | "excluidos"

export function PestanaValidos({ etl }: { etl: PipelineEtl }) {
  const [vista, setVista] = React.useState<Vista>("coinciden")
  const validos = etl.procesado?.limpieza.validos
  const excluidos = React.useMemo(
    () =>
      vista === "excluidos" && validos
        ? validos.filter((r) => !cumpleFiltros(r, etl.filtrosInterpretados))
        : [],
    [vista, validos, etl.filtrosInterpretados]
  )

  if (!validos) {
    return <SinDatos>Aún no hay registros válidos.</SinDatos>
  }

  const automatico = etl.modoSeleccion === "automatico"
  const nCoinciden = etl.filtradosOrdenados.length
  const nExcluidos = validos.length - nCoinciden

  return (
    <div className="flex flex-col gap-4">
      <PanelFiltros etl={etl} />

      <div
        className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3"
        aria-label="Selección"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={automatico ? "secondary" : "outline"}
            className="gap-1"
          >
            {automatico ? (
              <ZapIcon aria-hidden />
            ) : (
              <MousePointerClickIcon aria-hidden />
            )}
            Selección {automatico ? "automática" : "manual"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {automatico
              ? "Se sube todo lo que cumple los filtros; se recalcula al cambiarlos."
              : "Has modificado la selección a mano: cambiar los filtros ya no añade filas."}
          </span>
        </div>
        <p className="text-sm" aria-live="polite">
          <strong>{formatoEntero(nCoinciden)}</strong> de{" "}
          {formatoEntero(validos.length)} válidos coinciden con los filtros ·{" "}
          <strong>{formatoEntero(etl.conjuntoCarga.registros.length)}</strong>{" "}
          seleccionados para cargar
          {etl.conjuntoCarga.seleccionadosFueraDeFiltro > 0 && (
            <>
              {" "}
              ·{" "}
              <span className="text-amber-800 dark:text-amber-300">
                {formatoEntero(etl.conjuntoCarga.seleccionadosFueraDeFiltro)}{" "}
                seleccionados fuera de los filtros (no se subirán)
              </span>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {!automatico && (
            <Button variant="outline" onClick={etl.activarSeleccionAutomatica}>
              <ZapIcon aria-hidden />
              Volver a selección automática
            </Button>
          )}
          {!automatico && (
            <Button
              variant="outline"
              onClick={etl.seleccionarTodasFiltradas}
              disabled={nCoinciden === 0}
            >
              <CheckSquareIcon aria-hidden />
              Seleccionar las {formatoEntero(nCoinciden)} que cumplen los
              filtros
            </Button>
          )}
          <Button
            variant="outline"
            onClick={etl.vaciarSeleccion}
            disabled={etl.seleccion.size === 0}
          >
            <SquareIcon aria-hidden />
            Vaciar selección
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Marcar una fila pasa a selección manual. La casilla de la cabecera
          solo afecta a la página visible.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Qué filas mostrar"
        className="flex flex-wrap gap-2"
      >
        <Button
          role="radio"
          aria-checked={vista === "coinciden"}
          variant={vista === "coinciden" ? "secondary" : "ghost"}
          onClick={() => setVista("coinciden")}
        >
          Coinciden con los filtros ({formatoEntero(nCoinciden)})
        </Button>
        <Button
          role="radio"
          aria-checked={vista === "excluidos"}
          variant={vista === "excluidos" ? "secondary" : "ghost"}
          onClick={() => setVista("excluidos")}
        >
          Excluidos por filtros ({formatoEntero(nExcluidos)})
        </Button>
      </div>

      {vista === "coinciden" ? (
        <TablaPaginada
          // Vuelve a la página 1 cuando cambian filtros u orden.
          key={JSON.stringify([etl.filtros, etl.orden])}
          filas={etl.filtradosOrdenados}
          columnas={COLUMNAS_VALIDO}
          claveFila={(r) => r.clave}
          etiqueta="Registros válidos que coinciden con los filtros"
          vacio="Ningún registro válido cumple los filtros actuales."
          seleccion={{
            seleccionadas: etl.seleccion,
            alternar: etl.alternarFila,
            marcar: etl.marcarFilas,
          }}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Registros válidos que no cumplen los filtros. No son errores de
            calidad (esos están en «Rechazados») y no se pueden subir mientras
            los filtros los excluyan.
          </p>
          <TablaPaginada
            filas={excluidos}
            columnas={COLUMNAS_VALIDO}
            claveFila={(r) => r.clave}
            etiqueta="Registros válidos excluidos por los filtros"
            vacio="Los filtros no excluyen ningún registro."
          />
        </>
      )}
    </div>
  )
}

function CampoRango({
  etiqueta,
  unidad,
  min,
  max,
  alCambiar,
}: {
  etiqueta: string
  unidad: string
  min: string
  max: string
  alCambiar: (limite: "min" | "max", valor: string) => void
}) {
  const id = React.useId()
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">
        {etiqueta} ({unidad})
      </legend>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={`${id}-min`} className="sr-only">
          {etiqueta} mínima
        </Label>
        <Input
          id={`${id}-min`}
          inputMode="decimal"
          placeholder="mín."
          value={min}
          onChange={(e) => alCambiar("min", e.target.value)}
          className="w-20"
        />
        <span aria-hidden className="text-muted-foreground">
          –
        </span>
        <Label htmlFor={`${id}-max`} className="sr-only">
          {etiqueta} máxima
        </Label>
        <Input
          id={`${id}-max`}
          inputMode="decimal"
          placeholder="máx."
          value={max}
          onChange={(e) => alCambiar("max", e.target.value)}
          className="w-20"
        />
      </div>
    </fieldset>
  )
}

function PanelFiltros({ etl }: { etl: PipelineEtl }) {
  const { filtros, setFiltros, orden, setOrden } = etl
  const cambiar = <K extends keyof Filtros>(clave: K, valor: Filtros[K]) =>
    setFiltros((f) => ({ ...f, [clave]: valor }))
  const ciudadesDisponibles =
    etl.extraccion?.config.ciudades ?? NOMBRES_CIUDADES
  // Plegado por defecto: la tabla es lo primero que se ve.
  const [abierto, setAbierto] = React.useState(false)
  const idContenido = React.useId()
  const activos = (Object.keys(FILTROS_INICIALES) as (keyof Filtros)[]).filter(
    (k) => JSON.stringify(filtros[k]) !== JSON.stringify(FILTROS_INICIALES[k])
  ).length
  const ordenCambiado =
    orden.campo !== ORDEN_INICIAL.campo ||
    orden.direccion !== ORDEN_INICIAL.direccion

  return (
    <section
      aria-label="Filtros y ordenación"
      className="flex flex-col gap-4 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3>
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls={idContenido}
            onClick={() => setAbierto(!abierto)}
            className="flex items-center gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronDownIcon
              aria-hidden
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                abierto && "rotate-180"
              )}
            />
            <span className="font-medium">Filtros y ordenación</span>
            <span className="text-xs text-muted-foreground">
              {activos === 0
                ? "sin filtros"
                : `${activos} ${activos === 1 ? "filtro activo" : "filtros activos"}`}{" "}
              · {ETIQUETAS_ORDEN[orden.campo]}{" "}
              {orden.direccion === "asc" ? "↑" : "↓"}
            </span>
          </button>
        </h3>
        {(activos > 0 || ordenCambiado) && (
          <Button variant="ghost" size="sm" onClick={etl.restablecerFiltros}>
            <FilterXIcon aria-hidden />
            Restablecer filtros
          </Button>
        )}
      </div>

      {abierto && (
        <div id={idContenido} className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">
              Ciudades{" "}
              <span className="font-normal text-muted-foreground">
                (ninguna marcada = todas)
              </span>
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {ciudadesDisponibles.map((c) => (
                <Label key={c} className="font-normal">
                  <Checkbox
                    checked={filtros.ciudades.includes(c)}
                    onCheckedChange={(v) =>
                      cambiar(
                        "ciudades",
                        v
                          ? [...filtros.ciudades, c]
                          : filtros.ciudades.filter((x) => x !== c)
                      )
                    }
                  />
                  {c}
                </Label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 @xl:grid-cols-2 @5xl:grid-cols-4">
            <fieldset className="flex flex-col gap-1.5 @xl:col-span-2">
              <legend className="mb-1.5 text-sm font-medium">
                Intervalo de fecha y hora (UTC, ambos extremos incluidos)
              </legend>
              <div className="flex flex-wrap items-center gap-1.5">
                <Label htmlFor="filtro-desde" className="sr-only">
                  Desde
                </Label>
                <Input
                  id="filtro-desde"
                  type="datetime-local"
                  value={filtros.desde}
                  onChange={(e) => cambiar("desde", e.target.value)}
                  className="w-auto"
                />
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <Label htmlFor="filtro-hasta" className="sr-only">
                  Hasta
                </Label>
                <Input
                  id="filtro-hasta"
                  type="datetime-local"
                  value={filtros.hasta}
                  onChange={(e) => cambiar("hasta", e.target.value)}
                  className="w-auto"
                />
              </div>
            </fieldset>
            <CampoRango
              etiqueta="Temperatura"
              unidad="°C"
              min={filtros.temperaturaMin}
              max={filtros.temperaturaMax}
              alCambiar={(l, v) =>
                cambiar(l === "min" ? "temperaturaMin" : "temperaturaMax", v)
              }
            />
            <CampoRango
              etiqueta="Humedad"
              unidad="%"
              min={filtros.humedadMin}
              max={filtros.humedadMax}
              alCambiar={(l, v) =>
                cambiar(l === "min" ? "humedadMin" : "humedadMax", v)
              }
            />
            <CampoRango
              etiqueta="Precipitación"
              unidad="mm"
              min={filtros.precipitacionMin}
              max={filtros.precipitacionMax}
              alCambiar={(l, v) =>
                cambiar(
                  l === "min" ? "precipitacionMin" : "precipitacionMax",
                  v
                )
              }
            />
            <div className="flex items-end">
              <Label className="font-normal">
                <Checkbox
                  checked={filtros.soloLluvia}
                  onCheckedChange={(v) => cambiar("soloLluvia", v)}
                />
                Solo registros con lluvia (precipitación &gt; 0 mm)
              </Label>
            </div>
            <div className="flex flex-wrap items-end gap-2 @xl:col-span-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Ordenar por
                <Selector
                  value={orden.campo}
                  onChange={(e) =>
                    setOrden((o) => ({
                      ...o,
                      campo: e.target.value as CampoOrden,
                    }))
                  }
                >
                  {Object.entries(ETIQUETAS_ORDEN).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </Selector>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Dirección
                <Selector
                  value={orden.direccion}
                  onChange={(e) =>
                    setOrden((o) => ({
                      ...o,
                      direccion: e.target.value as "asc" | "desc",
                    }))
                  }
                >
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </Selector>
              </label>
            </div>
          </div>
        </div>
      )}

      {etl.filtrosInterpretados.errores.length > 0 && (
        <Alert variant="destructive">
          <XCircleIcon aria-hidden />
          <AlertDescription>
            Revisa los filtros (un límite que no es un número se ignora):
            <ul className="list-disc pl-4">
              {etl.filtrosInterpretados.errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}
