import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import DisableInspect from "@/components/disableinspect";
import { Providers } from "@/components/providers";

const Monserrat = Montserrat({
  weight: ["200", "300", "400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IEADEL Finance",
  description: "Sistema financeiro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body className={`${Monserrat.className} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
