'use client';

import React from 'react';
import './FullScreenLoader.css';

const FullScreenLoader = () => {
  return (
    <div className="fullscreen-loader">
      <div className="fullscreen-loader-content">
        <div className="fullscreen-loading-dots">
          <div className="fullscreen-dot"></div>
          <div className="fullscreen-dot"></div>
          <div className="fullscreen-dot"></div>
        </div>
        <p className="fullscreen-loading-text">Loading...</p>
      </div>
    </div>
  );
};

export default FullScreenLoader;
