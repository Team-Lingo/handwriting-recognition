"use client";
import React from "react";
import Navbar from "@/components/Navbar/Navbar";
import Hero from "@/components/Hero/Hero";
import IntroSection from "@/components/Intro/Intro";
import Stats from "@/components/Stats/Stats";
import Features from "@/components/Features/Features";
import Contact from "@/components/Contact/Contact";
import Footer from "@/components/Footer/Footer";

const LandingPage = () => {
  return (
    <>
      <Navbar />
      <Hero />
      <IntroSection />
      <Stats />
      <Features />
      <Contact />
      <Footer />
    </>
  );
};

export default LandingPage;
