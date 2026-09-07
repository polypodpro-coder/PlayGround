import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { FarmQuoteProvider } from './context/FarmQuoteContext.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { CreationProvider } from './context/CreationContext.jsx';
createRoot(document.getElementById('root')).render(<StrictMode><ErrorBoundary><HashRouter><AppProvider><FarmQuoteProvider><CreationProvider><App /></CreationProvider></FarmQuoteProvider></AppProvider></HashRouter></ErrorBoundary></StrictMode>);


