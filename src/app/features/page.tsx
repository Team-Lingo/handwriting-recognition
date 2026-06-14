import React from 'react'
import Navbar from '@/components/Navbar/Navbar';
import Features from '@/components/Features/Features';
import HowItWork from '@/components/HowItWork/HowItWork';
import Footer from '@/components/Footer/Footer';

const featuresPage = () => {
  return (
    <>
      <Navbar />
      <Features />
      <HowItWork />
      <Footer />
    </>
  )
}

export default featuresPage
