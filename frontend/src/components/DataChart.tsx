/**
 * Data visualization chart component for time-series statistics.
 *
 * This component provides:
 * - Line chart visualization for time-series data
 * - Area chart option for cumulative displays
 * - Bar chart option for discrete time periods
 * - Automatic data aggregation by time dimension
 * - Integration with FilterContext for filter-aware updates
 * - Responsive sizing and tooltips
 *
 * Built on Recharts library for React-native chart rendering.
 *
 * @example
 * // Basic usage - renders with current filter context
 * <DataChart data={statistics} />
 *
 * // With custom chart type
 * <DataChart data={statistics} chartType="area" />
 *
 * // Compact mode for sidebars
 * <DataChart data={statistics} compact />
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { useFilterContext, type TimeResolution } from '../context/FilterContext';
import type { StatisticResponse } from '../types/api';

// =============================================================================
// Types
// =============================================================================

/** Available chart visualization types */
export type ChartType = 'line' | 'area' | 'bar';

/** Data point structure for chart rendering */
export interface ChartDataPoint {
  /** Time dimension label (e.g., "2020", "Q1 2020", "Jan 2020") */
  period: string;
  /** Sort key for ordering data points */
  sortKey: number;
  /** Primary value */
  value: number | null;
  /** Optional secondary value for comparisons */
  value2?: number | null;
  /** Count of aggregated data points */
  count: number;
}

/** Props for the DataChart component */
export interface DataChartProps {
  /** Statistics data to visualize */
  data: StatisticResponse[];
  /** Secondary data series for comparison */
  comparisonData?: StatisticResponse[];
  /** Type of chart to render */
  chartType?: ChartType;
  /** Custom title for the chart */
  title?: string;
  /** Whether the component is in a loading state */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Compact mode for smaller containers */
  compact?: boolean;
  /** Custom height in pixels */
  height?: number;
  /** Label for primary data series */
  primaryLabel?: string;
  /** Label for comparison data series */
  comparisonLabel?: string;
  /** Whether to show the legend */
  showLegend?: boolean;
  /** Whether to show the grid */
  showGrid?: boolean;
  /** Custom color for primary series */
  primaryColor?: string;
  /** Custom color for comparison series */
  comparisonColor?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_HEIGHT = 400;
const COMPACT_HEIGHT = 250;
const CHART_COLORS = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary, #82ca9d)',
  grid: 'var(--color-gray-200)',
  text: 'var(--color-gray-600)',
};

// Month names for formatting
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-3)',
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--color-gray-800)',
    margin: 0,
  },
  chartWrapper: {
    width: '100%',
    position: 'relative' as const,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-gray-50)',
    borderRadius: 'var(--radius)',
    color: 'var(--color-gray-500)',
  },
  error: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-error-50, #fef2f2)',
    borderRadius: 'var(--radius)',
    color: 'var(--color-error, #ef4444)',
    padding: 'var(--spacing-4)',
    textAlign: 'center' as const,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-gray-50)',
    borderRadius: 'var(--radius)',
    color: 'var(--color-gray-500)',
    padding: 'var(--spacing-4)',
    textAlign: 'center' as const,
  },
  emptyIcon: {
    fontSize: 'var(--font-size-3xl)',
    marginBottom: 'var(--spacing-2)',
  },
  emptyText: {
    fontSize: 'var(--font-size-sm)',
    margin: 0,
  },
  tooltip: {
    backgroundColor: 'var(--color-white)',
    border: '1px solid var(--color-gray-200)',
    borderRadius: 'var(--radius)',
    padding: 'var(--spacing-2) var(--spacing-3)',
    boxShadow: 'var(--shadow-md)',
  },
  tooltipLabel: {
    fontWeight: 600,
    marginBottom: 'var(--spacing-1)',
    color: 'var(--color-gray-800)',
  },
  tooltipValue: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-600)',
  },
  compact: {
    title: {
      fontSize: 'var(--font-size-base)',
    },
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Formats a number for display with locale-aware formatting.
 */
function formatValue(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('fi-FI', {
    maximumFractionDigits: 2,
  });
}

/**
 * Generates a period label based on time resolution.
 */
function getPeriodLabel(
  year: number,
  quarter: number | null,
  month: number | null,
  resolution: TimeResolution
): string {
  switch (resolution) {
    case 'month':
      if (month !== null) {
        return `${MONTH_NAMES[month - 1]} ${year}`;
      }
      return year.toString();
    case 'quarter':
      if (quarter !== null) {
        return `Q${quarter} ${year}`;
      }
      return year.toString();
    case 'year':
    default:
      return year.toString();
  }
}

/**
 * Generates a sort key for ordering data points chronologically.
 */
function getSortKey(
  year: number,
  quarter: number | null,
  month: number | null
): number {
  // Format: YYYYMMQQ (year * 10000 + month * 100 + quarter)
  const monthVal = month ?? 0;
  const quarterVal = quarter ?? 0;
  return year * 10000 + monthVal * 100 + quarterVal;
}

/**
 * Aggregates statistics data by time period.
 */
function aggregateByPeriod(
  data: StatisticResponse[],
  resolution: TimeResolution
): ChartDataPoint[] {
  const aggregated = new Map<string, { sum: number; count: number; sortKey: number }>();

  for (const stat of data) {
    if (stat.value === null) continue;

    const period = getPeriodLabel(stat.year, stat.quarter, stat.month, resolution);
    const sortKey = getSortKey(stat.year, stat.quarter, stat.month);

    const existing = aggregated.get(period);
    if (existing) {
      existing.sum += stat.value;
      existing.count += 1;
    } else {
      aggregated.set(period, { sum: stat.value, count: 1, sortKey });
    }
  }

  return Array.from(aggregated.entries())
    .map(([period, { sum, count, sortKey }]) => ({
      period,
      sortKey,
      value: sum / count, // Average value
      count,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

/**
 * Merges primary and comparison data into unified chart data points.
 */
function mergeChartData(
  primaryData: ChartDataPoint[],
  comparisonData?: ChartDataPoint[]
): ChartDataPoint[] {
  if (!comparisonData || comparisonData.length === 0) {
    return primaryData;
  }

  const comparisonMap = new Map(
    comparisonData.map((d) => [d.period, d.value])
  );

  return primaryData.map((point) => ({
    ...point,
    value2: comparisonMap.get(point.period) ?? null,
  }));
}

// =============================================================================
// Custom Tooltip Component
// =============================================================================

interface CustomTooltipProps extends TooltipProps<number, string> {
  primaryLabel: string;
  comparisonLabel?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  primaryLabel,
  comparisonLabel,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div style={styles.tooltip}>
      <div style={styles.tooltipLabel}>{label}</div>
      {payload.map((entry, index) => (
        <div key={index} style={styles.tooltipValue}>
          <span style={{ color: entry.color }}>●</span>{' '}
          {index === 0 ? primaryLabel : comparisonLabel}: {formatValue(entry.value as number | null)}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

/**
 * DataChart component for visualizing time-series statistics.
 *
 * Integrates with FilterContext to automatically use the current time resolution
 * for data aggregation. Supports line, area, and bar chart types.
 */
export function DataChart({
  data,
  comparisonData,
  chartType = 'line',
  title,
  loading = false,
  error = null,
  compact = false,
  height,
  primaryLabel = 'Value',
  comparisonLabel = 'Comparison',
  showLegend = true,
  showGrid = true,
  primaryColor,
  comparisonColor,
}: DataChartProps) {
  const { filters } = useFilterContext();
  const { timeResolution } = filters;

  // Calculate chart height
  const chartHeight = height ?? (compact ? COMPACT_HEIGHT : DEFAULT_HEIGHT);

  // Process and aggregate data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const primaryAggregated = aggregateByPeriod(data, timeResolution);
    const comparisonAggregated = comparisonData
      ? aggregateByPeriod(comparisonData, timeResolution)
      : undefined;

    return mergeChartData(primaryAggregated, comparisonAggregated);
  }, [data, comparisonData, timeResolution]);

  // Determine if we have comparison data
  const hasComparison = comparisonData && comparisonData.length > 0;

  // Chart colors
  const colors = {
    primary: primaryColor ?? CHART_COLORS.primary,
    comparison: comparisonColor ?? CHART_COLORS.secondary,
  };

  // Render loading state
  if (loading) {
    return (
      <div style={styles.container}>
        {title && (
          <div style={styles.header}>
            <h3 style={{ ...styles.title, ...(compact ? styles.compact.title : {}) }}>
              {title}
            </h3>
          </div>
        )}
        <div style={{ ...styles.loading, height: chartHeight }}>
          <div className="spinner" style={{ marginRight: 'var(--spacing-2)' }} />
          Loading chart data...
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div style={styles.container}>
        {title && (
          <div style={styles.header}>
            <h3 style={{ ...styles.title, ...(compact ? styles.compact.title : {}) }}>
              {title}
            </h3>
          </div>
        )}
        <div style={{ ...styles.error, height: chartHeight }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--spacing-2)' }}>
            ⚠️
          </div>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  // Render empty state
  if (chartData.length === 0) {
    return (
      <div style={styles.container}>
        {title && (
          <div style={styles.header}>
            <h3 style={{ ...styles.title, ...(compact ? styles.compact.title : {}) }}>
              {title}
            </h3>
          </div>
        )}
        <div style={{ ...styles.empty, height: chartHeight }}>
          <div style={styles.emptyIcon}>📊</div>
          <p style={styles.emptyText}>No data available for the selected filters</p>
          <p style={{ ...styles.emptyText, marginTop: 'var(--spacing-1)' }}>
            Try adjusting your time range or filters
          </p>
        </div>
      </div>
    );
  }

  // Common chart props
  const commonProps = {
    data: chartData,
    margin: {
      top: 10,
      right: 30,
      left: 20,
      bottom: 10,
    },
  };

  // Common axis and grid components
  const renderCommonElements = () => (
    <>
      {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />}
      <XAxis
        dataKey="period"
        tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
        tickLine={{ stroke: CHART_COLORS.grid }}
        axisLine={{ stroke: CHART_COLORS.grid }}
      />
      <YAxis
        tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
        tickLine={{ stroke: CHART_COLORS.grid }}
        axisLine={{ stroke: CHART_COLORS.grid }}
        tickFormatter={(value) => formatValue(value)}
      />
      <Tooltip
        content={
          <CustomTooltip
            primaryLabel={primaryLabel}
            comparisonLabel={comparisonLabel}
          />
        }
      />
      {showLegend && hasComparison && (
        <Legend
          wrapperStyle={{ paddingTop: 'var(--spacing-2)' }}
        />
      )}
    </>
  );

  // Render the chart based on type
  const renderChart = () => {
    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {renderCommonElements()}
            <Area
              type="monotone"
              dataKey="value"
              name={primaryLabel}
              stroke={colors.primary}
              fill={colors.primary}
              fillOpacity={0.3}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {hasComparison && (
              <Area
                type="monotone"
                dataKey="value2"
                name={comparisonLabel}
                stroke={colors.comparison}
                fill={colors.comparison}
                fillOpacity={0.3}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {renderCommonElements()}
            <Bar
              dataKey="value"
              name={primaryLabel}
              fill={colors.primary}
              radius={[4, 4, 0, 0]}
            />
            {hasComparison && (
              <Bar
                dataKey="value2"
                name={comparisonLabel}
                fill={colors.comparison}
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        );

      case 'line':
      default:
        return (
          <LineChart {...commonProps}>
            {renderCommonElements()}
            <Line
              type="monotone"
              dataKey="value"
              name={primaryLabel}
              stroke={colors.primary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {hasComparison && (
              <Line
                type="monotone"
                dataKey="value2"
                name={comparisonLabel}
                stroke={colors.comparison}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
          </LineChart>
        );
    }
  };

  return (
    <div style={styles.container}>
      {title && (
        <div style={styles.header}>
          <h3 style={{ ...styles.title, ...(compact ? styles.compact.title : {}) }}>
            {title}
          </h3>
        </div>
      )}
      <div style={{ ...styles.chartWrapper, height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default DataChart;
