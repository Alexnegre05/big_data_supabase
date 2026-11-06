"use client"

import * as React from "react"
import {
  DatabaseIcon,
  HardDriveIcon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import {
  consultarDatos,
  type FilaPersistida,
  type ParametrosDatos,
} from "@/lib/etl/api-cliente"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { claveDe } from "@/lib/etl/tipos"

import {
  entradaUtcAIso,
  formatoEntero,
  formatoFechaUtc,
  formatoNumero,
} from "./formato"
import { Selector } from "./selector"

const ORDENES = {
  fecha_hora: "Fecha y hora (UTC)",
  ciudad: "Ciudad",
  temperatura_c: "Temperatura (°C)",
  humedad_pct: "Humedad (%)",
  precipitacion_mm: "Precipitación (mm)",
  importado_en: "Importado en",
  id: "id",
}

interface Formulario {
  ciudad: string
  desde: string
  hasta: string
  orden: string
  direccion: "asc" | "desc"
  tamano: number
}

const INICIAL: Formulario = {
  ciudad: "",
  desde: "",
  hasta: "",
  orden: "fecha_hora",
  direccion: "asc",
  tamano: 25,
}

export function PestanaSupabase({ etl }: { etl: PipelineEtl }) {
  const [form, setForm] = React.useState(INICIAL)
  const [pagina, setPagina] = React.useState(1)
  const [resultado, setResultado] = React.useState<{
    filas: FilaPersistida[]
    total: number
    leidoEn: string
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const peticion = React.useRef(0)

  const leer = React.useCallback(async (p: ParametrosDatos) => {
    const id = ++peticion.current
    setCargando(true)
    setError(null)
    try {
      const r = await consultarDatos(p)
      // Descarta respuestas antiguas si el usuario cambió los filtros entretanto.
      if (id === peticion.current) {
        setResultado({ ...r, leidoEn: new Date().toISOString() })
      }
    } catch (e) {
      if (id === peticion.current) setError((e as Error).message)
    } finally {
      if (id === peticion.current) setCargando(false)
    }
  }, [])

  const parametros: ParametrosDatos = {
    ciudad: form.ciudad,
    desde: entradaUtcAIso(form.desde),
    hasta: entradaUtcAIso(form.hasta),
    orden: form.orden,
    direccion: form.direccion,
    tamano: form.tamano,
    pagina,
  }
  const claveParametros = JSON.stringify(parametros)
  const tablaAccesible = etl.estadoSupabase?.tablaAccesible

  React.useEffect(() => {
    if (!tablaAccesible) return
    // Lectura de un sistema externo (Supabase) cuando cambian los parámetros.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void leer(JSON.parse(claveParametros))
  }, [claveParametros, leer, tablaAccesible])

  const cambiar = <K extends keyof Formulario>(k: K, v: Formulario[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setPagina(1)
  }

  // Datos locales todavía no confirmados en destino.
  const confirmadas = new Set(
    (etl.carga?.lotes ?? [])
      .filter((l) => l.estado === "completado")
      .flatMap((l) => l.registros.map((r) => claveDe(r.ciudad, r.fecha_hora)))
  )
  const pendientesLocales = etl.conjuntoCarga.registros.filter(
    (r) => !confirmadas.has(r.clave)
  ).length

  const totalPaginas = resultado
    ? Math.max(1, Math.ceil(resultado.total / form.tamano))
    : 1

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 @xl:grid-cols-2">
        <div className="flex gap-3 rounded-lg border border-dashed p-3 text-sm">
          <HardDriveIcon
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div>
            <p className="font-medium">Local (solo en tu navegador)</p>
            <p className="text-muted-foreground">
              {formatoEntero(pendientesLocales)} registros seleccionados
              pendientes de subir. No existen en Supabase hasta que su lote se
              confirme.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-lg border p-3 text-sm">
          <DatabaseIcon
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div>
            <p className="font-medium">Persistido en Supabase</p>
            <p className="text-muted-foreground">
              {resultado
                ? `${formatoEntero(resultado.total)} filas cumplen esta consulta (leído ${new Date(resultado.leidoEn).toLocaleTimeString("es-ES")}).`
                : (etl.estadoSupabase?.mensaje ?? "Comprobando conexión…")}
            </p>
          </div>
        </div>
      </div>

      {!tablaAccesible ? (
        <Alert variant="destructive">
          <XCircleIcon aria-hidden />
          <AlertDescription>
            {etl.estadoSupabase?.mensaje ?? "Comprobando conexión…"}{" "}
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => void etl.refrescarEstadoSupabase()}
            >
              Comprobar de nuevo
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ciudad
              <Selector
                value={form.ciudad}
                onChange={(e) => cambiar("ciudad", e.target.value)}
              >
                <option value="">Todas</option>
                {NOMBRES_CIUDADES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Selector>
            </label>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sb-desde">Desde (UTC)</Label>
              <Input
                id="sb-desde"
                type="datetime-local"
                value={form.desde}
                onChange={(e) => cambiar("desde", e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sb-hasta">Hasta (UTC)</Label>
              <Input
                id="sb-hasta"
                type="datetime-local"
                value={form.hasta}
                onChange={(e) => cambiar("hasta", e.target.value)}
                className="w-auto"
              />
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              ORDER BY
              <Selector
                value={form.orden}
                onChange={(e) => cambiar("orden", e.target.value)}
              >
                {Object.entries(ORDENES).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </Selector>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Dirección
              <Selector
                value={form.direccion}
                onChange={(e) =>
                  cambiar("direccion", e.target.value as "asc" | "desc")
                }
              >
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </Selector>
            </label>
            <Button
              variant="outline"
              onClick={() => {
                void leer(parametros)
                void etl.refrescarEstadoSupabase()
              }}
              disabled={cargando}
            >
              <RefreshCwIcon
                className={cargando ? "animate-spin" : undefined}
                aria-hidden
              />
              Actualizar
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircleIcon aria-hidden />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div
            className="overflow-x-auto rounded-lg border"
            aria-busy={cargando}
          >
            <table className="w-full text-sm">
              <caption className="sr-only">
                Filas almacenadas en Supabase
              </caption>
              <thead className="bg-muted/50 text-left">
                <tr className="border-b">
                  <th scope="col" className="p-2 text-right font-medium">
                    id
                  </th>
                  <th scope="col" className="p-2 font-medium">
                    Ciudad
                  </th>
                  <th scope="col" className="p-2 font-medium">
                    Fecha y hora (UTC)
                  </th>
                  <th scope="col" className="p-2 text-right font-medium">
                    Temperatura (°C)
                  </th>
                  <th scope="col" className="p-2 text-right font-medium">
                    Humedad (%)
                  </th>
                  <th scope="col" className="p-2 text-right font-medium">
                    Precipitación (mm)
                  </th>
                  <th scope="col" className="p-2 font-medium">
                    Importado en (UTC)
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultado?.filas.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="h-20 text-center text-muted-foreground"
                    >
                      La consulta no devuelve filas.
                    </td>
                  </tr>
                )}
                {resultado?.filas.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="p-2 text-right tabular-nums">{f.id}</td>
                    <td className="p-2">{f.ciudad}</td>
                    <td className="p-2 whitespace-nowrap">
                      {formatoFechaUtc(f.fecha_hora)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {formatoNumero(f.temperatura_c)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {formatoNumero(f.humedad_pct)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {formatoNumero(f.precipitacion_mm)}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {formatoFechaUtc(f.importado_en)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {resultado && `${formatoEntero(resultado.total)} filas en total`}
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5">
                Filas por página
                <Selector
                  value={form.tamano}
                  onChange={(e) => cambiar("tamano", Number(e.target.value))}
                >
                  {[25, 50, 100].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Selector>
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || cargando}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="tabular-nums">
                Página {pagina} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= totalPaginas || cargando}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
