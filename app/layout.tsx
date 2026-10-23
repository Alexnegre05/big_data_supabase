import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
const inter=Inter({subsets:["latin"],variable:"--font-sans"})
const fontMono=Geist_Mono({subsets:["latin"],variable:"--font-mono"})
export const metadata:Metadata={title:"Pipeline meteorológico | Big Data",description:"Práctica guiada de extracción, transformación y carga de Open-Meteo a Supabase"}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es" suppressHydrationWarning className={cn("antialiased",fontMono.variable,"font-sans",inter.variable)}><body><ThemeProvider>{children}</ThemeProvider></body></html>}
