import type { Metadata } from "next";
import { Inter, Lexend, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// DESIGN-SYSTEM.md §3: Inter stays the workhorse body/data font — tabular figures,
// proven legibility in dense tables, zero blast radius to swap. Lexend is layered in as a
// separate --font-display, used only for hero/page-header/KPI display numerals (UI Revamp
// Round 2) — the doc's own §3 names Lexend as the accessibility-oriented alternative.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const lexend = Lexend({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MV-VRA",
  description: "MoneyView Vendor Risk Assessment",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${lexend.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
