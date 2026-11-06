import type { Metadata } from "next"
import { Cinzel, EB_Garamond, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SCRIPT_FILTRO } from "@/lib/filtro-visual"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// Fuentes del filtro "Vintage": sin precarga, solo se descargan si se activa.
const fontVintage = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-vintage",
  preload: false,
})

const fontVintageTitulo = Cinzel({
  subsets: ["latin"],
  variable: "--font-vintage-titulo",
  preload: false,
})

export const metadata: Metadata = {
  title: "Pipeline ETL · Open-Meteo → Supabase",
  description:
    "Práctica de Big Data: extracción, transformación, limpieza, filtrado y carga de datos meteorológicos.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable,
        fontVintage.variable,
        fontVintageTitulo.variable
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_FILTRO }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
