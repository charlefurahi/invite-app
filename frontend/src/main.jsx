import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './style.css';
import { ensureAwake } from './api.js';
ensureAwake(); // start waking the free server as soon as any page opens
createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
