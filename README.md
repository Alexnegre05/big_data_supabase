# Pipeline meteorológico

Práctica ETL con Next.js 16, TypeScript, Tailwind y componentes shadcn/ui. Extrae variables horarias de Open-Meteo Archive, normaliza en UTC, aplica controles de calidad y deduplicación, permite filtrar/ordenar/seleccionar filas y carga el conjunto seleccionado en Supabase.

## Instalación y ejecución

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Configura en `.env.local` del servidor `SUPABASE_URL` (se acepta también `NEXT_PUBLIC_SUPABASE_URL` para la URL pública del proyecto) y `SUPABASE_SECRET_KEY`. Para proyectos antiguos se acepta `SUPABASE_SERVICE_ROLE_KEY`. Nunca uses `NEXT_PUBLIC_` para una clave secreta. Aplica `supabase/migrations/20261023000000_create_mediciones_meteorologicas.sql` en el SQL Editor de Supabase.

RLS queda activado sin políticas públicas de escritura. La ruta utiliza una clave privilegiada solo en servidor. La práctica no incluye autenticación: está habilitada para desarrollo local y debe protegerse antes de publicar el endpoint.

## Pipeline

1. **Extracción:** ciudades configurables, rango inclusivo de hasta 31 días, GMT/UTC, °C y mm. Un fallo se puede reintentar por ciudad.
2. **Transformación y limpieza:** arrays paralelos a filas por ciudad/hora; tipos numéricos finitos; nulos y medidas inválidas se rechazan; humedad 0–100 y precipitación ≥ 0. Los duplicados ciudad/hora conservan la primera fila.
3. **Filtrado y selección:** filtros de ciudad, fecha/hora, temperatura, humedad, precipitación y lluvia; ordenación; selección independiente de la paginación. La vista previa es el conjunto exacto de filas seleccionadas que aún cumplen los filtros.
4. **Carga:** orden congelado al iniciar, upsert por `(ciudad, fecha_hora)` en lotes de hasta 500, estados reales por lote, reintento de filas fallidas y verificación de claves en destino. Upsert evita duplicar claves al repetir una carga; Supabase no informa si cada fila se insertó o actualizó. La base de datos no conserva orden de inserción: las consultas necesitan `ORDER BY`.

La pestaña de destino permite consultar páginas de 20 filas, filtrar por ciudad/fechas, ordenar y actualizar. Los JSON originales permanecen en memoria durante la sesión y se pueden descargar.

## Verificación

- `npm test`: 7 fixtures aislados para arrays UTC, nulos, longitudes incoherentes, duplicados, filtros antes de paginar, selección entre páginas e idempotencia de claves.
- `npm run typecheck`, `npm run lint` y `npm run build`.
- Petición real de Barcelona (1-09-2026): API respondió GMT, 24 timestamps y 24 valores para cada variable (00:00–23:00 UTC).
- La consulta de integración de Supabase devolvió falta de configuración del servidor. No se pudo confirmar lectura/escritura, segunda carga real ni fallo parcial contra el proyecto. No se copiaron ni mostraron valores de `.env.local`; Next.js lo carga automáticamente cuando está disponible.