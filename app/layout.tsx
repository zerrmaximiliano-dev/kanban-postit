import type { Metadata } from "next";
import { Inter, Caveat, Archivo } from "next/font/google";
import "./globals.css";
import { AppQueryProvider } from "@/src/lib/queryClient";
import { ToastProvider } from "@/src/modules/ui/Toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["800"],
});

export const metadata: Metadata = {
  title: "Janus",
  description: "Janus — tableros Kanban y calendario colaborativo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${caveat.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppQueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </AppQueryProvider>
      </body>
    </html>
  );
}
