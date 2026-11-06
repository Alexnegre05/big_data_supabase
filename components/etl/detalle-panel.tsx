"use client"

import * as React from "react"

/**
 * true si la vista del panel está recogida ("Ver menos"): solo lo que pide la
 * práctica (contadores, estados, tablas). Con "Ver más" se añaden los bloques
 * de apoyo. Lo decide cada vista del panel; por defecto, recogida.
 */
export const ContextoResumido = React.createContext(true)

export const useResumido = () => React.useContext(ContextoResumido)
