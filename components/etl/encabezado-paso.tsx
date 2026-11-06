/** Encabezado común de los pasos 1-3: número en relieve, título y explicación. */
export function EncabezadoPaso({
  numero,
  id,
  titulo,
  descripcion,
  children,
}: {
  numero: number
  id: string
  titulo: string
  descripcion: string
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl neu-sm text-lg font-semibold text-marca"
        >
          {numero}
        </span>
        <div>
          <h2 id={id} className="text-lg font-semibold tracking-tight">
            <span className="sr-only">Paso {numero}: </span>
            {titulo}
          </h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      {children}
    </header>
  )
}
