import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import DisableInspect from "@/components/disableinspect";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";

const Monserrat = Montserrat({
  weight: ["200", "300", "400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IEADEL Finance",
  description: "Sistema financeiro",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IEADEL Finance",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body className={`${Monserrat.className} antialiased`}>
        <PwaRegister />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
