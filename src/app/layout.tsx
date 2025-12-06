import "~/styles/globals.css";

import { type Metadata } from "next";
import { Crimson_Pro, JetBrains_Mono, Bebas_Neue } from "next/font/google";
import { Toaster } from "~/components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Coup LLM Arena",
  description: "Benchmark LLM models in the art of deception - where AI models bluff, challenge, and conquer",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-crimson",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${crimsonPro.variable} ${jetbrainsMono.variable} ${bebasNeue.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <TRPCReactProvider>
          {children}
          <Toaster />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
