import './ui/styles/theme.css';
import './ui/styles/layout.css';
import './ui/styles/components.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import AppWithBoundary from './ui/App.jsx';

createRoot(document.getElementById('root')).render(<AppWithBoundary />);
