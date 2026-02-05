/**
 * Dashboard page component for statistics visualization.
 *
 * This is the main landing page that displays:
 * - Time-series charts
 * - Filter controls (time slider, region, industry)
 * - Dataset overview
 *
 * Components like DataChart, TimeSlider, and FilterPanel
 * will be integrated in later phases.
 */

import { useDatasets } from '../api';
import { useStatistics } from '../api';

/**
 * Statistics summary card component
 */
function StatsSummary({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="card">
      <div className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 700,
          color: 'var(--color-primary)',
        }}
      >
        {value}
      </div>
      {description && (
        <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
          {description}
        </div>
      )}
    </div>
  );
}

/**
 * Placeholder for the chart component (to be implemented in phase 6)
 */
function ChartPlaceholder() {
  return (
    <div
      className="card"
      style={{
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-gray-50)',
      }}
    >
      <div className="text-center text-muted">
        <div style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--spacing-2)' }}>
          📊
        </div>
        <p>Time-series chart will be displayed here</p>
        <p style={{ fontSize: 'var(--font-size-sm)' }}>
          Select a dataset to visualize statistics
        </p>
      </div>
    </div>
  );
}

/**
 * Placeholder for the filter panel (to be implemented in phase 6)
 */
function FilterPanelPlaceholder() {
  return (
    <div className="card">
      <h4>Filters</h4>
      <div style={{ marginTop: 'var(--spacing-4)' }}>
        <div className="form-group">
          <label className="form-label">Time Period</label>
          <select className="form-select" disabled>
            <option>Time slider (coming soon)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Region</label>
          <select className="form-select" disabled>
            <option>All regions</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Industry</label>
          <select className="form-select" disabled>
            <option>All industries</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Dashboard page component
 */
export default function Dashboard() {
  // Fetch datasets summary
  const { data: datasets, isLoading: datasetsLoading, error: datasetsError } = useDatasets({
    page: 1,
    page_size: 100,
  });

  // Fetch recent statistics (sample query)
  const { data: statistics, isLoading: statisticsLoading } = useStatistics({
    page: 1,
    page_size: 10,
  });

  // Show loading state
  if (datasetsLoading) {
    return (
      <div className="page">
        <div className="loading">
          <div className="spinner" />
          <span style={{ marginLeft: 'var(--spacing-3)' }}>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (datasetsError) {
    return (
      <div className="page">
        <div className="error">
          <div className="error-title">Failed to load dashboard</div>
          <p>{datasetsError.message}</p>
          <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-2)' }}>
            Make sure the backend API is running at http://localhost:8000
          </p>
        </div>
      </div>
    );
  }

  const datasetCount = datasets?.total ?? 0;
  const statisticCount = statistics?.total ?? 0;

  return (
    <div className="page">
      <div className="flex justify-between items-center mb-4">
        <h2 style={{ marginBottom: 0 }}>Dashboard</h2>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-6)',
        }}
      >
        <StatsSummary
          label="Datasets"
          value={datasetCount}
          description="Configured data sources"
        />
        <StatsSummary
          label="Data Points"
          value={statisticCount.toLocaleString()}
          description="Total statistics records"
        />
        <StatsSummary
          label="Status"
          value={datasetCount > 0 ? 'Active' : 'Setup Required'}
          description={
            datasetCount > 0 ? 'Data collection configured' : 'Add datasets to start'
          }
        />
      </div>

      {/* Main Content Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: 'var(--spacing-4)',
        }}
      >
        {/* Chart Area */}
        <div>
          <ChartPlaceholder />
        </div>

        {/* Filter Sidebar */}
        <div>
          <FilterPanelPlaceholder />
        </div>
      </div>

      {/* Dataset List */}
      {datasetCount > 0 && (
        <div className="card" style={{ marginTop: 'var(--spacing-6)' }}>
          <div className="card-header">
            <h4 className="card-title">Available Datasets</h4>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--spacing-2)',
                    borderBottom: '1px solid var(--color-gray-200)',
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--spacing-2)',
                    borderBottom: '1px solid var(--color-gray-200)',
                  }}
                >
                  Time Resolution
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-2)',
                    borderBottom: '1px solid var(--color-gray-200)',
                  }}
                >
                  Regions
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-2)',
                    borderBottom: '1px solid var(--color-gray-200)',
                  }}
                >
                  Industries
                </th>
              </tr>
            </thead>
            <tbody>
              {datasets?.items.map((dataset) => (
                <tr key={dataset.id}>
                  <td style={{ padding: 'var(--spacing-2)' }}>
                    {dataset.name_fi || dataset.name_en || dataset.id}
                  </td>
                  <td
                    style={{
                      padding: 'var(--spacing-2)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {dataset.time_resolution}
                  </td>
                  <td style={{ padding: 'var(--spacing-2)', textAlign: 'center' }}>
                    {dataset.has_region_dimension ? '✓' : '—'}
                  </td>
                  <td style={{ padding: 'var(--spacing-2)', textAlign: 'center' }}>
                    {dataset.has_industry_dimension ? '✓' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {datasetCount === 0 && !datasetsLoading && (
        <div
          className="card"
          style={{
            marginTop: 'var(--spacing-6)',
            textAlign: 'center',
            padding: 'var(--spacing-8)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-4)' }}>📈</div>
          <h3>No Datasets Configured</h3>
          <p className="text-muted">
            Go to <strong>Fetch Config</strong> to configure which StatFin datasets to
            fetch.
          </p>
        </div>
      )}
    </div>
  );
}
