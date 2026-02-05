/**
 * Central export point for all custom React hooks.
 *
 * This module re-exports all custom hooks:
 * - Filter hooks: useFilters, useTimeRange, useRegionFilter, etc.
 * - Data fetching hooks with filters: useFilteredStatistics
 *
 * @example
 * import { useFilters, useFilteredStatistics, useTimeRange } from '@/hooks';
 */

// Main filter hook (alias for useFilterContext)
export { useFilters } from './useFilters';

// Filtered data fetching hooks
export {
  useFilteredStatistics,
  type UseFilteredStatisticsOptions,
} from './useFilters';

// Time filter hooks
export {
  useTimeRange,
  type TimeRangeState,
  type TimeRangeActions,
} from './useFilters';

// Region filter hooks
export {
  useRegionFilter,
  type RegionFilterState,
  type RegionFilterActions,
} from './useFilters';

// Industry filter hooks
export {
  useIndustryFilter,
  type IndustryFilterState,
  type IndustryFilterActions,
} from './useFilters';

// Dataset filter hooks
export {
  useDatasetFilter,
  type DatasetFilterState,
  type DatasetFilterActions,
} from './useFilters';

// Utility hooks
export { useFilterSummary } from './useFilters';

// Re-export types from context
export type {
  FilterState,
  TimeResolution,
  RegionLevel,
  IndustryLevel,
} from './useFilters';
