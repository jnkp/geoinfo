/**
 * Main application component with routing setup.
 *
 * This component provides:
 * - React Router configuration for SPA navigation
 * - Application layout (header, main, footer)
 * - Navigation component
 */

import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

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
 * Inner app component that uses routing hooks
 * Must be inside BrowserRouter
 */
function AppContent() {
  return (
    <div className="app">
      <header className="header">
        <Navigation />
      </header>
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
 * Main application component with routing setup
 */
function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
