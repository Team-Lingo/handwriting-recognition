"use client";
import React from "react";
import Navbar from "@/components/Navbar/Navbar";
import Hero from "@/components/Hero/Hero";
import IntroSection from "@/components/Intro/Intro";
import Stats from "@/components/Stats/Stats";
import Features from "@/components/Features/Features";
import CTA from "@/components/CTA/CTA";
import HowItWork from "@/components/HowItWork/HowItWork";
import Contact from "@/components/Contact/Contact";
import Footer from "@/components/Footer/Footer";


export default function HomePage() {
    return (
        <>
            <Navbar />
            <Hero />
            <IntroSection />
            <Stats />
            <Features />
            <CTA/>
            <HowItWork/>
            <Contact />
            <Footer />
        </>
    );
}
