import "./globals.css";
import type { ReactNode } from "react";
import FirebaseInit from "@/components/FirebaseInit";
import { AuthProvider } from "@/contexts/AuthContext";
import { Montserrat, Atkinson_Hyperlegible } from "next/font/google";

export const metadata = { title: "Handwriting Recognition" };

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${atkinson.variable}`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <FirebaseInit />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
