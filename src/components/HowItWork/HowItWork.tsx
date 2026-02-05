import React from 'react';
import styles from './HowItWork.module.css';

const HowItWork = () => {
  const steps = [
    {
      number: '01',
      title: 'Upload Your Document',
      description: 'Simply upload an image or scan of your handwritten document.'
    },
    {
      number: '02',
      title: 'AI Processing',
      description: 'Our advanced AI analyzes the handwriting, recognizing characters and words with high accuracy.'
    },
    {
      number: '03',
      title: 'Receive Digital Text',
      description: 'Instantly receive a digital version of your handwritten text, ready for editing or sharing.'
    }
  ];

  return (
    <section className={styles.howItWork}>
      <div className={styles.container}>
        <h2 className={styles.heading}>
          How to Use the Handwriting Recognition Tool
        </h2>
        
        <div className={styles.stepsGrid}>
          {steps.map((step, index) => (
            <div key={index} className={styles.stepCard}>
              <div className={styles.stepNumber}>{step.number}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWork;