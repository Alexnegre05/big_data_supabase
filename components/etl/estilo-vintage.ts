import type { StyleSpecification } from "maplibre-gl"

import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"

import { DECORACION } from "./decoracion-vintage"

/*
 * Mapa base del filtro "Vintage": carta antigua dibujada con los datos gratuitos
 * de OpenFreeMap (no necesita clave). Tierra de pergamino con el relieve de
 * Natural Earth II desaturado, mar con líneas de costa repetidas (waterlining),
 * fronteras a tinta con franja de color, retícula de meridianos y paralelos y
 * rótulos en versalitas espaciadas.
 */

const PALETAS = {
  claro: {
    tierra: "#efe3c4",
    agua: "#dcd3b0",
    tinta: "#4a3420",
    tintaAgua: "#5d6b66",
    rio: "#6f8288",
    bosque: "#8fa06a",
    franja: "#b07a8e",
    relieve: 0.5,
    relieveBrillo: 1,
  },
  // Pergamino al atardecer: más oscuro que el claro, pero sigue siendo beige.
  oscuro: {
    tierra: "#8a7556",
    agua: "#6e5f48",
    tinta: "#f6ead0",
    tintaAgua: "#e3dcc8",
    rio: "#c3cdca",
    bosque: "#a3ab78",
    franja: "#c995a8",
    relieve: 0.4,
    relieveBrillo: 0.8,
  },
}

const NOMBRE = [
  "coalesce",
  ["get", "name:es"],
  ["get", "name:latin"],
  ["get", "name"],
]

const ES_POLIGONO = [
  "match",
  ["geometry-type"],
  ["Polygon", "MultiPolygon"],
  true,
  false,
]
const AGUA = ["all", ES_POLIGONO, ["!=", ["get", "brunnel"], "tunnel"]]
const FRONTERA = [
  "all",
  ["==", ["get", "admin_level"], 2],
  ["!=", ["get", "maritime"], 1],
]

/** Meridianos y paralelos cada 2° alrededor de la península. */
function reticula() {
  const lineas: [number, number][][] = []
  for (let lon = -30; lon <= 20; lon += 2)
    lineas.push([
      [lon, 24],
      [lon, 58],
    ])
  for (let lat = 24; lat <= 58; lat += 2)
    lineas.push([
      [-30, lat],
      [20, lat],
    ])
  return {
    type: "FeatureCollection" as const,
    features: lineas.map((coordinates) => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates },
    })),
  }
}

export function estiloVintage(oscuro: boolean): StyleSpecification {
  const c = PALETAS[oscuro ? "oscuro" : "claro"]
  const halo = { "text-halo-color": c.tierra, "text-halo-width": 1.2 }

  // Las expresiones van como arrays sueltos; MapLibre las valida al cargar.
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      omt: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution:
          '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Datos de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
      relieve: {
        type: "raster",
        tiles: [
          "https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 6,
        attribution:
          '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
      },
      reticula: { type: "geojson", data: reticula() },
      decoracion: { type: "geojson", data: DECORACION },
    },
    layers: [
      {
        id: "tierra",
        type: "background",
        paint: { "background-color": c.tierra },
      },
      {
        id: "relieve",
        type: "raster",
        source: "relieve",
        paint: {
          "raster-opacity": c.relieve,
          "raster-saturation": -0.75,
          "raster-contrast": -0.15,
          "raster-brightness-max": c.relieveBrillo,
          "raster-fade-duration": 0,
        },
      },
      {
        id: "bosque",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "wood"],
        paint: { "fill-color": c.bosque, "fill-opacity": 0.22 },
      },
      {
        id: "agua",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        filter: AGUA,
        paint: { "fill-color": c.agua },
      },
      // Líneas paralelas a la costa hacia el mar, como en los grabados antiguos.
      // Desplazamiento positivo = hacia dentro del polígono de agua.
      {
        id: "agua-linea-2",
        type: "line",
        source: "omt",
        "source-layer": "water",
        filter: AGUA,
        paint: {
          "line-color": c.tinta,
          "line-opacity": 0.12,
          "line-width": 0.6,
          "line-offset": 6,
        },
      },
      {
        id: "agua-linea-1",
        type: "line",
        source: "omt",
        "source-layer": "water",
        filter: AGUA,
        paint: {
          "line-color": c.tinta,
          "line-opacity": 0.22,
          "line-width": 0.6,
          "line-offset": 3,
        },
      },
      {
        id: "costa-sangrado",
        type: "line",
        source: "omt",
        "source-layer": "water",
        filter: AGUA,
        paint: {
          "line-color": c.tinta,
          "line-opacity": 0.18,
          "line-width": 4,
          "line-blur": 3,
        },
      },
      {
        id: "costa",
        type: "line",
        source: "omt",
        "source-layer": "water",
        filter: AGUA,
        paint: {
          "line-color": c.tinta,
          "line-opacity": 0.85,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 8, 1.4],
        },
      },
      {
        id: "rios",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        minzoom: 5,
        filter: ["==", ["get", "class"], "river"],
        paint: { "line-color": c.rio, "line-width": 0.8, "line-opacity": 0.8 },
      },
      {
        id: "reticula",
        type: "line",
        source: "reticula",
        paint: {
          "line-color": c.tinta,
          "line-opacity": 0.22,
          "line-width": 0.6,
        },
      },
      {
        id: "caminos",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 6,
        filter: [
          "match",
          ["get", "class"],
          ["motorway", "trunk", "primary"],
          true,
          false,
        ],
        paint: {
          "line-color": c.tinta,
          "line-opacity": 0.25,
          "line-width": 0.6,
          "line-dasharray": [3, 2],
        },
      },
      // Franja de color a lo largo de la frontera, como en los mapas iluminados a mano.
      {
        id: "frontera-franja",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: FRONTERA,
        paint: {
          "line-color": c.franja,
          "line-opacity": 0.35,
          "line-width": 6,
          "line-blur": 4,
        },
      },
      {
        id: "frontera",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: FRONTERA,
        paint: {
          "line-color": c.tinta,
          "line-opacity": 0.7,
          "line-width": 1.1,
          "line-dasharray": [5, 2, 1, 2],
        },
      },
      {
        id: "regiones",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        minzoom: 5,
        filter: [
          "all",
          ["==", ["get", "admin_level"], 4],
          ["!=", ["get", "maritime"], 1],
        ],
        paint: {
          "line-color": c.tinta,
          "line-opacity": 0.35,
          "line-width": 0.6,
          "line-dasharray": [2, 2],
        },
      },
      // Montañas, bosques y faros dibujados a tinta (decoracion-vintage.tsx).
      // El icono lleva los colores en el nombre; el mapa lo pinta al pedirlo.
      {
        id: "decoracion",
        type: "symbol",
        source: "decoracion",
        layout: {
          "icon-image": [
            "concat",
            "vintage-",
            ["get", "tipo"],
            `-${c.tinta}-${c.tierra}`,
          ],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            ["*", 0.7, ["get", "escala"]],
            8,
            ["*", 1.2, ["get", "escala"]],
          ],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-opacity": 0.9 },
      },
      {
        id: "nombres-mar",
        type: "symbol",
        source: "omt",
        "source-layer": "water_name",
        layout: {
          "text-field": NOMBRE,
          "text-font": ["Noto Sans Italic"],
          "text-letter-spacing": 0.3,
          "text-max-width": 6,
          "text-size": ["interpolate", ["linear"], ["zoom"], 0, 10, 8, 15],
        },
        paint: {
          "text-color": c.tintaAgua,
          "text-halo-color": c.agua,
          "text-halo-width": 1,
        },
      },
      {
        id: "nombres-region",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 5,
        maxzoom: 8,
        filter: ["==", ["get", "class"], "state"],
        layout: {
          "text-field": NOMBRE,
          "text-font": ["Noto Sans Italic"],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.25,
          "text-max-width": 9,
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 9, 8, 12],
        },
        paint: { "text-color": c.tinta, "text-opacity": 0.55, ...halo },
      },
      // Las ciudades del proyecto ya llevan su propio marcador: no se repiten.
      {
        id: "nombres-ciudad",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 5,
        filter: [
          "all",
          ["==", ["get", "class"], "city"],
          ["!", ["in", NOMBRE, ["literal", NOMBRES_CIUDADES]]],
        ],
        layout: {
          "text-field": NOMBRE,
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 8,
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 13],
        },
        paint: { "text-color": c.tinta, "text-opacity": 0.8, ...halo },
      },
      {
        id: "nombres-pais",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        maxzoom: 9,
        filter: ["==", ["get", "class"], "country"],
        layout: {
          "text-field": NOMBRE,
          "text-font": ["Noto Sans Bold"],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.35,
          "text-max-width": 7,
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 7, 18],
        },
        paint: { "text-color": c.tinta, "text-opacity": 0.75, ...halo },
      },
    ],
  } as StyleSpecification
}
