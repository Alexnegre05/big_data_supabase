"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { paginar } from "@/lib/etl/filtros"
import { cn } from "@/lib/utils"

import { formatoEntero } from "./formato"
import { Selector } from "./selector"

export interface Columna<T> {
  id: string
  titulo: React.ReactNode
  celda: (fila: T) => React.ReactNode
  numerica?: boolean
}

interface SeleccionTabla {
  seleccionadas: ReadonlySet<string>
  alternar: (clave: string) => void
  marcar: (claves: string[], marcar: boolean) => void
}

const TAMANOS = [25, 50, 100]

/**
 * Tabla con paginación local. La paginación solo recorta lo que se ve:
 * recibe las filas ya filtradas y ordenadas.
 */
export function TablaPaginada<T>({
  filas,
  columnas,
  claveFila,
  etiqueta,
  vacio,
  seleccion,
  claseFila,
}: {
  filas: T[]
  columnas: Columna<T>[]
  claveFila: (fila: T) => string
  etiqueta: string
  vacio: string
  seleccion?: SeleccionTabla
  claseFila?: (fila: T) => string | undefined
}) {
  const [pagina, setPagina] = React.useState(1)
  const [tamano, setTamano] = React.useState(TAMANOS[0])
  const vista = paginar(filas, pagina, tamano)
  const clavesPagina = vista.filas.map(claveFila)
  const marcadasPagina = seleccion
    ? clavesPagina.filter((c) => seleccion.seleccionadas.has(c)).length
    : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border">
        <Table aria-label={etiqueta}>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {seleccion && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Seleccionar las filas de esta página"
                    checked={
                      clavesPagina.length > 0 &&
                      marcadasPagina === clavesPagina.length
                    }
                    indeterminate={
                      marcadasPagina > 0 && marcadasPagina < clavesPagina.length
                    }
                    disabled={clavesPagina.length === 0}
                    onCheckedChange={(valor) =>
                      seleccion.marcar(clavesPagina, valor)
                    }
                  />
                </TableHead>
              )}
              {columnas.map((c) => (
                <TableHead
                  key={c.id}
                  scope="col"
                  className={cn(c.numerica && "text-right")}
                >
                  {c.titulo}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vista.filas.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas.length + (seleccion ? 1 : 0)}
                  className="h-20 text-center whitespace-normal text-muted-foreground"
                >
                  {vacio}
                </TableCell>
              </TableRow>
            )}
            {vista.filas.map((fila) => {
              const clave = claveFila(fila)
              const marcada = seleccion?.seleccionadas.has(clave) ?? false
              return (
                <TableRow
                  key={clave}
                  data-state={marcada ? "selected" : undefined}
                  className={claseFila?.(fila)}
                >
                  {seleccion && (
                    <TableCell>
                      <Checkbox
                        aria-label={`Seleccionar ${clave}`}
                        checked={marcada}
                        onCheckedChange={() => seleccion.alternar(clave)}
                      />
                    </TableCell>
                  )}
                  {columnas.map((c) => (
                    <TableCell
                      key={c.id}
                      className={cn(c.numerica && "text-right tabular-nums")}
                    >
                      {c.celda(fila)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p aria-live="polite">
          Filas {formatoEntero(vista.desde)}–{formatoEntero(vista.hasta)} de{" "}
          {formatoEntero(filas.length)}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            Filas por página
            <Selector
              value={tamano}
              onChange={(e) => {
                setTamano(Number(e.target.value))
                setPagina(1)
              }}
            >
              {TAMANOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Selector>
          </label>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={vista.pagina <= 1}
            onClick={() => setPagina(vista.pagina - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="tabular-nums">
            Página {vista.pagina} de {vista.totalPaginas}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Página siguiente"
            disabled={vista.pagina >= vista.totalPaginas}
            onClick={() => setPagina(vista.pagina + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
