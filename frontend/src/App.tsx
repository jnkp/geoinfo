/**
 * Main application component with routing setup.
 *
 * This component provides:
 * - React Router configuration for SPA navigation
 * - Application layout (header, main, footer)
 * - Navigation component
 * - Debug mode banner
 */

import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

// Context providers
import { DebugProvider, useDebug } from './context/DebugContext';

// Page components
import Dashboard from './pages/Dashboard';
import FetchConfig from './pages/FetchConfig';
import MapView from './pages/MapView';

/**
 * Navigation link component with active state styling
 */
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      style={{
        fontWeight: 500,
        padding: 'var(--spacing-2) var(--spacing-3)',
        borderRadius: 'var(--radius)',
        transition: 'all var(--transition-fast)',
        backgroundColor: isActive ? 'var(--color-gray-100)' : 'transparent',
        color: isActive ? 'var(--color-primary)' : 'var(--color-gray-600)',
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Navigation component for the application header
 */
function Navigation() {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <Link to="/">GeoInfo</Link>
      </div>
      <ul className="nav-links">
        <li>
          <NavLink to="/">Dashboard</NavLink>
        </li>
        <li>
          <NavLink to="/config">Fetch Config</NavLink>
        </li>
        <li>
          <NavLink to="/map">Map</NavLink>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Debug mode banner component
 *
 * Displays a visual indicator when debug mode is enabled.
 * Provides a toggle button to enable/disable debug mode.
 */
function DebugBanner() {
  const { debugMode, toggleDebug } = useDebug();

  if (!debugMode) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-warning)',
        color: 'var(--color-gray-900)',
        padding: 'var(--spacing-2) var(--spacing-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-4)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 500,
        borderBottom: '1px solid var(--color-gray-300)',
        boxShadow: 'var(--shadow-sm)',
      }}
      data-testid="debug-banner"
    >
      <span>
        ⚠️ Debug Mode Enabled - Verbose error reporting is active
      </span>
      <button
        onClick={toggleDebug}
        style={{
          padding: 'var(--spacing-1) var(--spacing-3)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 500,
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-gray-700)',
          backgroundColor: 'var(--color-white)',
          color: 'var(--color-gray-700)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        data-testid="debug-toggle-button"
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
          e.currentTarget.style.borderColor = 'var(--color-gray-900)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-white)';
          e.currentTarget.style.borderColor = 'var(--color-gray-700)';
        }}
      >
        Disable Debug Mode
      </button>
    </div>
  );
}

/**
 * Inner app component that uses routing hooks
 * Must be inside BrowserRouter
 */
function AppContent() {
  return (
    <div className="app">
      <header className="header">
        <Navigation />
      </header>
      <DebugBanner />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/config" element={<FetchConfig />} />
          <Route path="/map" element={<MapView />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>GeoInfo - Finnish Public Statistics Platform</p>
      </footer>
    </div>
  );
}

/**
 * Main application component with routing setup and context providers
 */
function App() {
  return (
    <BrowserRouter>
      <DebugProvider>
        <AppContent />
      </DebugProvider>
    </BrowserRouter>
  );
}

export default App;
