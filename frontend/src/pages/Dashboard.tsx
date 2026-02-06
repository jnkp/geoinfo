/**
 * Dashboard page component for statistics visualization.
 *
 * This is the main landing page that displays:
 * - Time-series charts with DataChart component
 * - Filter controls (time slider, region, industry) with FilterPanel
 * - Dataset selector for comparing multiple datasets
 * - Dataset overview
 *
 * Integrates with FilterContext for shared filter state across components.
 */

import { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useDatasets, statisticsKeys, apiClient, buildQueryString } from '../api';
import { FilterProvider, useFilterContext } from '../context/FilterContext';
import { FilterPanel } from '../components/FilterPanel';
import { DataChart } from '../components/DataChart';
import { DatasetSelector, createDatasetColorMap, DATASET_COLORS } from '../components/DatasetSelector';
import type { StatisticListResponse, StatisticResponse } from '../types/api';

// =============================================================================
// Types
// =============================================================================

interface StatsSummaryProps {
  label: string;
  value: string | number;
  description?: string;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  sidebarSection: {
    marginTop: 'var(--spacing-4)',
    paddingTop: 'var(--spacing-4)',
    borderTop: '1px solid var(--color-gray-200)',
  },
};

// =============================================================================
// Components
// =============================================================================

/**
 * Statistics summary card component
 */
function StatsSummary({ label, value, description }: StatsSummaryProps) {
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
 * Dashboard content component that uses FilterContext.
 * Must be wrapped in FilterProvider to access filter state.
 */
function DashboardContent() {
  const { toQueryParams } = useFilterContext();

  // State for selected datasets for comparison
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);

  // Fetch datasets summary
  const {
    data: datasets,
    isLoading: datasetsLoading,
    error: datasetsError,
  } = useDatasets({
    page: 1,
    page_size: 100,
  });

  // Build query params from filter context
  const baseQueryParams = toQueryParams();

  // Fetch statistics for all selected datasets (or all data if none selected)
  const statisticsQueries = useQueries({
    queries: selectedDatasetIds.length > 0
      ? selectedDatasetIds.map((datasetId) => ({
          queryKey: statisticsKeys.list({ ...baseQueryParams, dataset_id: datasetId, page: 1, page_size: 1000 }),
          queryFn: async () => {
            const params = { ...baseQueryParams, dataset_id: datasetId, page: 1, page_size: 1000 };
            const queryString = buildQueryString(params as Record<string, string | number | null | undefined>);
            return apiClient.get<StatisticListResponse>(`/statistics${queryString}`);
          },
        }))
      : [{
          queryKey: statisticsKeys.list({ ...baseQueryParams, page: 1, page_size: 1000 }),
          queryFn: async () => {
            const params = { ...baseQueryParams, page: 1, page_size: 1000 };
            const queryString = buildQueryString(params as Record<string, string | number | null | undefined>);
            return apiClient.get<StatisticListResponse>(`/statistics${queryString}`);
          },
        }],
  });

  // Derive loading and error states from queries
  const statisticsLoading = statisticsQueries.some((q) => q.isLoading);
  const statisticsError = statisticsQueries.find((q) => q.error)?.error;

  // Combine statistics data for chart
  const { primaryData, comparisonData, totalCount, chartTitle, primaryLabel, comparisonLabel } = useMemo(() => {
    if (selectedDatasetIds.length === 0) {
      // No datasets selected - show all statistics
      const allData = statisticsQueries[0]?.data?.items ?? [];
      return {
        primaryData: allData,
        comparisonData: undefined,
        totalCount: statisticsQueries[0]?.data?.total ?? 0,
        chartTitle: 'Statistics Over Time',
        primaryLabel: 'Value',
        comparisonLabel: undefined,
      };
    }

    if (selectedDatasetIds.length === 1) {
      // Single dataset selected
      const data = statisticsQueries[0]?.data?.items ?? [];
      const dataset = datasets?.items.find((d) => d.id === selectedDatasetIds[0]);
      const datasetName = dataset?.name_fi || dataset?.name_en || selectedDatasetIds[0];
      return {
        primaryData: data,
        comparisonData: undefined,
        totalCount: statisticsQueries[0]?.data?.total ?? 0,
        chartTitle: datasetName,
        primaryLabel: datasetName,
        comparisonLabel: undefined,
      };
    }

    // Multiple datasets selected - use first two for comparison
    const primary = statisticsQueries[0]?.data?.items ?? [];
    const comparison = statisticsQueries[1]?.data?.items ?? [];
    const totalCount = statisticsQueries.reduce((sum, q) => sum + (q.data?.total ?? 0), 0);

    const dataset1 = datasets?.items.find((d) => d.id === selectedDatasetIds[0]);
    const dataset2 = datasets?.items.find((d) => d.id === selectedDatasetIds[1]);
    const name1 = dataset1?.name_fi || dataset1?.name_en || selectedDatasetIds[0];
    const name2 = dataset2?.name_fi || dataset2?.name_en || selectedDatasetIds[1];

    return {
      primaryData: primary,
      comparisonData: comparison,
      totalCount,
      chartTitle: 'Dataset Comparison',
      primaryLabel: name1,
      comparisonLabel: name2,
    };
  }, [selectedDatasetIds, statisticsQueries, datasets?.items]);

  // Get colors for selected datasets
  const colorMap = createDatasetColorMap(selectedDatasetIds);

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
          value={totalCount.toLocaleString()}
          description={selectedDatasetIds.length > 0 ? `From ${selectedDatasetIds.length} selected dataset(s)` : 'Matching statistics records'}
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
          gridTemplateColumns: '1fr 320px',
          gap: 'var(--spacing-4)',
        }}
      >
        {/* Chart Area */}
        <div className="card">
          <DataChart
            data={primaryData}
            comparisonData={comparisonData}
            loading={statisticsLoading}
            error={statisticsError?.message ?? null}
            title={chartTitle}
            chartType="line"
            primaryLabel={primaryLabel}
            comparisonLabel={comparisonLabel}
            showLegend={selectedDatasetIds.length > 1}
            showGrid={true}
            primaryColor={selectedDatasetIds.length > 0 ? colorMap[selectedDatasetIds[0]] : undefined}
            comparisonColor={selectedDatasetIds.length > 1 ? colorMap[selectedDatasetIds[1]] : undefined}
          />
        </div>

        {/* Sidebar - Filters and Dataset Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          {/* Dataset Selector */}
          {datasetCount > 0 && (
            <div
              style={{
                padding: 'var(--spacing-4)',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-gray-200)',
              }}
            >
              <DatasetSelector
                selectedIds={selectedDatasetIds}
                onChange={setSelectedDatasetIds}
                maxSelections={2}
                compact={true}
                title="Compare Datasets"
                showClearAll={true}
              />
            </div>
          )}

          {/* Filter Panel */}
          <FilterPanel
            showTimeFilter={true}
            showRegionFilter={true}
            showIndustryFilter={true}
            showSummary={true}
            showClearAll={true}
            collapsible={true}
            defaultCollapsed={false}
          />
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

// =============================================================================
// Main Component
// =============================================================================

/**
 * Main Dashboard page component.
 * Wraps DashboardContent with FilterProvider for filter state management.
 */
export default function Dashboard() {
  return (
    <FilterProvider syncWithURL={true}>
      <DashboardContent />
    </FilterProvider>
  );
}
