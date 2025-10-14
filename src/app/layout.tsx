import "./globals.css";
import type { ReactNode } from "react";
import FirebaseInit from "@/components/FirebaseInit";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata = { title: "Handwriting Recognition" };

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>
                <AuthProvider>
                    <FirebaseInit />
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
