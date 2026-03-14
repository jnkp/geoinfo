/**
 * Map View page component for geographic visualization.
 *
 * This page displays:
 * - Interactive map of Finnish regions
 * - Data overlay with choropleth coloring
 * - Region selection and filtering
 *
 * The RegionMap component using Leaflet will be
 * integrated in later phases.
 */

import { useState } from 'react';
import { useStatistics } from '../api';

/**
 * Region level selector for different geographic granularities
 */
const REGION_LEVELS = [
  { id: 'maakunta', label: 'Maakunta (Region)', count: 19 },
  { id: 'seutukunta', label: 'Seutukunta (Sub-region)', count: 70 },
  { id: 'kunta', label: 'Kunta (Municipality)', count: 309 },
] as const;

type RegionLevel = (typeof REGION_LEVELS)[number]['id'];

/**
 * Placeholder for the Leaflet map component (to be implemented in phase 6)
 */
function MapPlaceholder({ regionLevel }: { regionLevel: RegionLevel }) {
  return (
    <div
      style={{
        height: '600px',
        backgroundColor: 'var(--color-gray-100)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--color-gray-200)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Simplified Finland outline */}
      <svg
        viewBox="0 0 100 150"
        style={{
          position: 'absolute',
          height: '80%',
          opacity: 0.1,
        }}
      >
        <path
          d="M40,5 L60,5 L70,20 L75,40 L80,60 L75,80 L70,100 L65,120 L55,135 L45,140 L35,135 L25,120 L20,100 L25,80 L30,60 L25,40 L30,20 Z"
          fill="var(--color-primary)"
          stroke="var(--color-primary)"
          strokeWidth="1"
        />
      </svg>

      <div className="text-center" style={{ zIndex: 1 }}>
        <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-4)' }}>🗺️</div>
        <h3>Interactive Map</h3>
        <p className="text-muted" style={{ marginBottom: 'var(--spacing-2)' }}>
          Finnish {REGION_LEVELS.find((l) => l.id === regionLevel)?.label} boundaries
        </p>
        <p
          className="text-muted"
          style={{ fontSize: 'var(--font-size-sm)', maxWidth: '300px' }}
        >
          Leaflet map with GeoJSON boundaries and data overlay will be displayed here
        </p>
      </div>
    </div>
  );
}

/**
 * Legend component for map color scale
 */
function MapLegend() {
  const colors = ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'];

  return (
    <div
      className="card"
      style={{
        position: 'absolute',
        bottom: 'var(--spacing-4)',
        left: 'var(--spacing-4)',
        padding: 'var(--spacing-3)',
        zIndex: 10,
        minWidth: '150px',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-2)' }}>
        Value Scale
      </div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {colors.map((color, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: '12px',
              backgroundColor: color,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-gray-500)',
          marginTop: 'var(--spacing-1)',
        }}
      >
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}

/**
 * Region info panel showing selected region details
 */
function RegionInfoPanel({ regionCode }: { regionCode: string | null }) {
  if (!regionCode) {
    return (
      <div className="card">
        <h4>Region Details</h4>
        <p className="text-muted">
          Click on a region in the map to see detailed statistics.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h4>Region Details</h4>
      <div style={{ marginTop: 'var(--spacing-3)' }}>
        <div className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
          Selected Region
        </div>
        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>
          {regionCode}
        </div>
      </div>
      <div
        style={{
          marginTop: 'var(--spacing-4)',
          padding: 'var(--spacing-3)',
          backgroundColor: 'var(--color-gray-50)',
          borderRadius: 'var(--radius)',
        }}
      >
        <p className="text-muted text-center" style={{ marginBottom: 0 }}>
          Region statistics will be displayed here when data is available.
        </p>
      </div>
    </div>
  );
}

/**
 * Main Map View page component
 */
export default function MapView() {
  const [regionLevel, setRegionLevel] = useState<RegionLevel>('maakunta');
  const [selectedRegion, _setSelectedRegion] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(2023);

  // Fetch statistics for the map
  const { data: statistics, isLoading } = useStatistics({
    year: selectedYear,
    region_level: regionLevel,
    page: 1,
    page_size: 500,
  });

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-4">
        <h2 style={{ marginBottom: 0 }}>Map View</h2>
      </div>

      <p className="text-muted" style={{ marginBottom: 'var(--spacing-4)' }}>
        Explore Finnish regional statistics through an interactive map visualization.
      </p>

      {/* Controls */}
      <div
        className="card"
        style={{
          marginBottom: 'var(--spacing-4)',
          display: 'flex',
          gap: 'var(--spacing-4)',
          alignItems: 'flex-end',
        }}
      >
        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="form-label">Region Level</label>
          <select
            className="form-select"
            value={regionLevel}
            onChange={(e) => setRegionLevel(e.target.value as RegionLevel)}
          >
            {REGION_LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {level.label} ({level.count} regions)
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="form-label">Year</label>
          <input
            type="number"
            className="form-input"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            min={2000}
            max={2025}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="form-label">Dataset</label>
          <select className="form-select" disabled>
            <option>Select a dataset</option>
          </select>
        </div>

        <button className="btn btn-primary" disabled>
          Apply Filters
        </button>
      </div>

      {/* Main Content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: 'var(--spacing-4)',
        }}
      >
        {/* Map Container */}
        <div style={{ position: 'relative' }}>
          {isLoading ? (
            <div
              style={{
                height: '600px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div className="loading">
                <div className="spinner" />
                <span style={{ marginLeft: 'var(--spacing-3)' }}>
                  Loading map data...
                </span>
              </div>
            </div>
          ) : (
            <>
              <MapPlaceholder regionLevel={regionLevel} />
              <MapLegend />
            </>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <RegionInfoPanel regionCode={selectedRegion} />

          {/* Quick Stats */}
          <div className="card">
            <h4>Map Statistics</h4>
            <div style={{ marginTop: 'var(--spacing-3)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-2) 0',
                  borderBottom: '1px solid var(--color-gray-100)',
                }}
              >
                <span className="text-muted">Regions shown</span>
                <span style={{ fontWeight: 500 }}>
                  {REGION_LEVELS.find((l) => l.id === regionLevel)?.count ?? 0}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-2) 0',
                  borderBottom: '1px solid var(--color-gray-100)',
                }}
              >
                <span className="text-muted">Data points</span>
                <span style={{ fontWeight: 500 }}>{statistics?.total ?? 0}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-2) 0',
                }}
              >
                <span className="text-muted">Year</span>
                <span style={{ fontWeight: 500 }}>{selectedYear}</span>
              </div>
            </div>
          </div>

          {/* Help */}
          <div
            className="card"
            style={{ backgroundColor: 'var(--color-gray-50)' }}
          >
            <h5>How to Use</h5>
            <ul
              style={{
                paddingLeft: 'var(--spacing-5)',
                lineHeight: 1.8,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-gray-600)',
              }}
            >
              <li>Select region level to change map granularity</li>
              <li>Click on a region to see details</li>
              <li>Use year selector to view historical data</li>
              <li>Colors indicate relative values</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
