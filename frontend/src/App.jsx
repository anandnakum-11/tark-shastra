import React, { useEffect } from 'react';
import { appMarkup } from './markup';
import { initializeLegacyApp } from './legacy/app';

export default function App() {
  useEffect(() => {
    initializeLegacyApp();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: appMarkup }} />;
}
