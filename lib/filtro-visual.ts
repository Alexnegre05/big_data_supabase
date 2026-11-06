/**
 * Filtros visuales: cambian el aspecto de toda la página (colores, fuentes,
 * textura y mapa), nunca los datos. Cada filtro se pinta en app/globals.css
 * con el selector `html[data-filtro="…"]`.
 */
export const FILTROS = {
  original: { titulo: "Original" },
  vintage: { titulo: "Vintage" },
} as const

export type Filtro = keyof typeof FILTROS

export const CLAVE_FILTRO = "filtro-visual"

export function esFiltro(valor: unknown): valor is Filtro {
  return typeof valor === "string" && Object.keys(FILTROS).includes(valor)
}

/** Se ejecuta antes de pintar para que al recargar no parpadee el aspecto original. */
export const SCRIPT_FILTRO = `try{var f=localStorage.getItem(${JSON.stringify(CLAVE_FILTRO)});if(f!=="original"&&${JSON.stringify(Object.keys(FILTROS))}.indexOf(f)>=0)document.documentElement.dataset.filtro=f}catch(e){}`
