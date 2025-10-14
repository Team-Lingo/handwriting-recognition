"use client";
import { useEffect } from "react";
import { analytics } from "@/lib/firebase";

export default function FirebaseInit() {
    useEffect(() => {
        if (analytics) {
            console.log("Firebase Analytics initialized");
        }
    }, []);

    return null;
}
