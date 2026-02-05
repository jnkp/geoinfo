import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

/**
 * Placeholder page components - will be replaced with actual implementations
 */
function DashboardPlaceholder() {
  return (
    <div className="page">
      <h2>Dashboard</h2>
      <p>Statistics visualization dashboard will be displayed here.</p>
    </div>
  )
}

function FetchConfigPlaceholder() {
  return (
    <div className="page">
      <h2>Fetch Configuration</h2>
      <p>Configure StatFin data fetching here.</p>
    </div>
  )
}

function MapViewPlaceholder() {
  return (
    <div className="page">
      <h2>Map View</h2>
      <p>Finnish region map visualization will be displayed here.</p>
    </div>
  )
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
          <Link to="/">Dashboard</Link>
        </li>
        <li>
          <Link to="/config">Fetch Config</Link>
        </li>
        <li>
          <Link to="/map">Map</Link>
        </li>
      </ul>
    </nav>
  )
}

/**
 * Main application component with routing setup
 */
function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="header">
          <Navigation />
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<DashboardPlaceholder />} />
            <Route path="/config" element={<FetchConfigPlaceholder />} />
            <Route path="/map" element={<MapViewPlaceholder />} />
          </Routes>
        </main>
        <footer className="footer">
          <p>GeoInfo - Finnish Public Statistics Platform</p>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
