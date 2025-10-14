import "@/styles/globals.css";
import type { ReactNode } from "react";
import FirebaseInit from "@/components/FirebaseInit";

export const metadata = { title: "Handwriting Recognition Prototype" };

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>
                <FirebaseInit />
                {children}
            </body>
        </html>
    );
}
