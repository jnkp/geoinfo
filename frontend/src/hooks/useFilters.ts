/**
 * Custom hooks for filter state management and data fetching with filters.
 *
 * This module provides:
 * - useFilters: Main hook for accessing filter context (re-export)
 * - useFilteredStatistics: Hook for fetching statistics with current filters
 * - useTimeRange: Hook for managing time range state
 * - useRegionFilter: Hook for region-specific filtering
 * - useIndustryFilter: Hook for industry-specific filtering
 * - useDatasetFilter: Hook for dataset selection
 *
 * @example
 * // Basic filter usage
 * const { filters, setYear, toQueryParams } = useFilters();
 *
 * // Fetch data with current filters
 * const { data, isLoading } = useFilteredStatistics();
 */

import { useMemo, useCallback } from 'react';
import { useStatistics } from '../api/statistics';
import {
  useFilterContext,
  type TimeResolution,
  type RegionLevel,
  type IndustryLevel,
} from '../context/FilterContext';
import type { StatisticQueryParams } from '../types/api';

// =============================================================================
// Re-export main hook
// =============================================================================

/**
 * Main hook for accessing filter context.
 * Alias for useFilterContext.
 *
 * @example
 * const { filters, setYear, setRegion, resetFilters } = useFilters();
 */
export { useFilterContext as useFilters } from '../context/FilterContext';

// =============================================================================
// Filtered Data Hooks
// =============================================================================

export interface UseFilteredStatisticsOptions {
  /** Additional query parameters to merge with filters */
  additionalParams?: StatisticQueryParams;
  /** Whether to enable the query */
  enabled?: boolean;
  /** Page number for pagination */
  page?: number;
  /** Page size for pagination */
  pageSize?: number;
}

/**
 * Hook for fetching statistics with current filter state applied.
 *
 * Automatically converts filter context to API query parameters
 * and fetches data using useStatistics.
 *
 * @param options - Configuration options
 * @returns Query result with statistics data
 *
 * @example
 * const { data, isLoading, error } = useFilteredStatistics({
 *   page: 1,
 *   pageSize: 100,
 * });
 */
export function useFilteredStatistics(options: UseFilteredStatisticsOptions = {}) {
  const { toQueryParams } = useFilterContext();
  const { additionalParams, enabled = true, page = 1, pageSize = 100 } = options;

  const queryParams = useMemo((): StatisticQueryParams => {
    const filterParams = toQueryParams();
    return {
      ...filterParams,
      ...additionalParams,
      page,
      page_size: pageSize,
    };
  }, [toQueryParams, additionalParams, page, pageSize]);

  return useStatistics(queryParams, {
    enabled,
  });
}

// =============================================================================
// Time Filter Hooks
// =============================================================================

export interface TimeRangeState {
  /** Current year (exact match or null) */
  year: number | null;
  /** Start year of range */
  yearFrom: number | null;
  /** End year of range */
  yearTo: number | null;
  /** Current quarter (1-4 or null) */
  quarter: number | null;
  /** Current month (1-12 or null) */
  month: number | null;
  /** Current time resolution */
  timeResolution: TimeResolution;
}

export interface TimeRangeActions {
  /** Set exact year */
  setYear: (year: number | null) => void;
  /** Set year range */
  setYearRange: (from: number | null, to: number | null) => void;
  /** Set quarter */
  setQuarter: (quarter: number | null) => void;
  /** Set month */
  setMonth: (month: number | null) => void;
  /** Set time resolution */
  setTimeResolution: (resolution: TimeResolution) => void;
  /** Reset all time filters */
  resetTimeFilters: () => void;
  /** Navigate to previous time period */
  goToPreviousPeriod: () => void;
  /** Navigate to next time period */
  goToNextPeriod: () => void;
}

/**
 * Hook for managing time-based filtering.
 *
 * Provides state and actions for temporal navigation including
 * year selection, range queries, and period navigation.
 *
 * @returns Time range state and actions
 *
 * @example
 * const { year, setYear, goToNextPeriod, goToPreviousPeriod } = useTimeRange();
 */
export function useTimeRange(): TimeRangeState & TimeRangeActions {
  const {
    filters,
    setYear,
    setYearRange,
    setQuarter,
    setMonth,
    setTimeResolution,
    resetTimeFilters,
  } = useFilterContext();

  const goToPreviousPeriod = useCallback(() => {
    const { year, quarter, month, timeResolution } = filters;

    switch (timeResolution) {
      case 'month':
        if (month !== null && year !== null) {
          if (month === 1) {
            setYear(year - 1);
            setMonth(12);
          } else {
            setMonth(month - 1);
          }
        }
        break;
      case 'quarter':
        if (quarter !== null && year !== null) {
          if (quarter === 1) {
            setYear(year - 1);
            setQuarter(4);
          } else {
            setQuarter(quarter - 1);
          }
        }
        break;
      case 'year':
      default:
        if (year !== null) {
          setYear(year - 1);
        }
        break;
    }
  }, [filters, setYear, setQuarter, setMonth]);

  const goToNextPeriod = useCallback(() => {
    const { year, quarter, month, timeResolution } = filters;

    switch (timeResolution) {
      case 'month':
        if (month !== null && year !== null) {
          if (month === 12) {
            setYear(year + 1);
            setMonth(1);
          } else {
            setMonth(month + 1);
          }
        }
        break;
      case 'quarter':
        if (quarter !== null && year !== null) {
          if (quarter === 4) {
            setYear(year + 1);
            setQuarter(1);
          } else {
            setQuarter(quarter + 1);
          }
        }
        break;
      case 'year':
      default:
        if (year !== null) {
          setYear(year + 1);
        }
        break;
    }
  }, [filters, setYear, setQuarter, setMonth]);

  return {
    year: filters.year,
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
    quarter: filters.quarter,
    month: filters.month,
    timeResolution: filters.timeResolution,
    setYear,
    setYearRange,
    setQuarter,
    setMonth,
    setTimeResolution,
    resetTimeFilters,
    goToPreviousPeriod,
    goToNextPeriod,
  };
}

// =============================================================================
// Region Filter Hooks
// =============================================================================

export interface RegionFilterState {
  /** Selected region code */
  regionCode: string | null;
  /** Selected region level */
  regionLevel: RegionLevel;
}

export interface RegionFilterActions {
  /** Set region code */
  setRegionCode: (code: string | null) => void;
  /** Set region level */
  setRegionLevel: (level: RegionLevel) => void;
  /** Set both region code and level */
  setRegion: (code: string | null, level: RegionLevel) => void;
  /** Reset geographic filters */
  resetRegionFilters: () => void;
  /** Check if filtering to specific region */
  isRegionSelected: boolean;
}

/**
 * Hook for managing region-based filtering.
 *
 * Provides state and actions for geographic filtering at different
 * administrative levels (kunta, seutukunta, maakunta).
 *
 * @returns Region filter state and actions
 *
 * @example
 * const { regionCode, setRegion, resetRegionFilters } = useRegionFilter();
 */
export function useRegionFilter(): RegionFilterState & RegionFilterActions {
  const {
    filters,
    setRegionCode,
    setRegionLevel,
    setRegion,
    resetGeographicFilters,
  } = useFilterContext();

  const isRegionSelected = filters.regionCode !== null;

  return {
    regionCode: filters.regionCode,
    regionLevel: filters.regionLevel,
    setRegionCode,
    setRegionLevel,
    setRegion,
    resetRegionFilters: resetGeographicFilters,
    isRegionSelected,
  };
}

// =============================================================================
// Industry Filter Hooks
// =============================================================================

export interface IndustryFilterState {
  /** Selected industry code */
  industryCode: string | null;
  /** Selected industry level */
  industryLevel: IndustryLevel;
}

export interface IndustryFilterActions {
  /** Set industry code */
  setIndustryCode: (code: string | null) => void;
  /** Set industry level */
  setIndustryLevel: (level: IndustryLevel) => void;
  /** Set both industry code and level */
  setIndustry: (code: string | null, level: IndustryLevel) => void;
  /** Reset industry filters */
  resetIndustryFilters: () => void;
  /** Check if filtering to specific industry */
  isIndustrySelected: boolean;
}

/**
 * Hook for managing industry-based filtering.
 *
 * Provides state and actions for filtering by TOL 2008 industry
 * classification at different levels (section, division, group, class).
 *
 * @returns Industry filter state and actions
 *
 * @example
 * const { industryCode, setIndustry, resetIndustryFilters } = useIndustryFilter();
 */
export function useIndustryFilter(): IndustryFilterState & IndustryFilterActions {
  const {
    filters,
    setIndustryCode,
    setIndustryLevel,
    setIndustry,
    resetIndustryFilters,
  } = useFilterContext();

  const isIndustrySelected = filters.industryCode !== null;

  return {
    industryCode: filters.industryCode,
    industryLevel: filters.industryLevel,
    setIndustryCode,
    setIndustryLevel,
    setIndustry,
    resetIndustryFilters,
    isIndustrySelected,
  };
}

// =============================================================================
// Dataset Filter Hooks
// =============================================================================

export interface DatasetFilterState {
  /** Selected primary dataset ID */
  datasetId: string | null;
  /** Selected dataset IDs for comparison */
  datasetIds: string[];
  /** Selected value label */
  valueLabel: string | null;
}

export interface DatasetFilterActions {
  /** Set primary dataset ID */
  setDatasetId: (id: string | null) => void;
  /** Set multiple dataset IDs */
  setDatasetIds: (ids: string[]) => void;
  /** Add dataset to comparison */
  addDatasetId: (id: string) => void;
  /** Remove dataset from comparison */
  removeDatasetId: (id: string) => void;
  /** Set value label filter */
  setValueLabel: (label: string | null) => void;
  /** Check if any dataset is selected */
  hasDatasetSelected: boolean;
  /** Check if multiple datasets selected for comparison */
  isComparing: boolean;
}

/**
 * Hook for managing dataset selection.
 *
 * Provides state and actions for selecting which datasets to visualize,
 * including support for comparing multiple datasets.
 *
 * @returns Dataset filter state and actions
 *
 * @example
 * const { datasetId, setDatasetId, addDatasetId, isComparing } = useDatasetFilter();
 */
export function useDatasetFilter(): DatasetFilterState & DatasetFilterActions {
  const {
    filters,
    setDatasetId,
    setDatasetIds,
    addDatasetId,
    removeDatasetId,
    setValueLabel,
  } = useFilterContext();

  const hasDatasetSelected =
    filters.datasetId !== null || filters.datasetIds.length > 0;
  const isComparing = filters.datasetIds.length > 1;

  return {
    datasetId: filters.datasetId,
    datasetIds: filters.datasetIds,
    valueLabel: filters.valueLabel,
    setDatasetId,
    setDatasetIds,
    addDatasetId,
    removeDatasetId,
    setValueLabel,
    hasDatasetSelected,
    isComparing,
  };
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook that returns a summary of all active filters.
 *
 * Useful for displaying current filter state in UI components.
 *
 * @returns Object with filter summary information
 *
 * @example
 * const { activeFilterCount, filterSummary } = useFilterSummary();
 */
export function useFilterSummary() {
  const { filters, hasActiveFilters } = useFilterContext();

  const filterSummary = useMemo(() => {
    const parts: string[] = [];

    // Time filters
    if (filters.year !== null) {
      parts.push(`Year: ${filters.year}`);
    } else if (filters.yearFrom !== null || filters.yearTo !== null) {
      const from = filters.yearFrom ?? '...';
      const to = filters.yearTo ?? '...';
      parts.push(`Years: ${from}-${to}`);
    }
    if (filters.quarter !== null) {
      parts.push(`Q${filters.quarter}`);
    }
    if (filters.month !== null) {
      parts.push(`Month: ${filters.month}`);
    }

    // Geographic filters
    if (filters.regionCode) {
      parts.push(`Region: ${filters.regionCode}`);
    } else if (filters.regionLevel) {
      parts.push(`Level: ${filters.regionLevel}`);
    }

    // Industry filters
    if (filters.industryCode) {
      parts.push(`Industry: ${filters.industryCode}`);
    } else if (filters.industryLevel) {
      parts.push(`Level: ${filters.industryLevel}`);
    }

    // Dataset filters
    if (filters.datasetId) {
      parts.push(`Dataset: ${filters.datasetId}`);
    }
    if (filters.datasetIds.length > 0) {
      parts.push(`Comparing: ${filters.datasetIds.length} datasets`);
    }

    return parts.join(' | ');
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.year !== null) count++;
    if (filters.yearFrom !== null) count++;
    if (filters.yearTo !== null) count++;
    if (filters.quarter !== null) count++;
    if (filters.month !== null) count++;
    if (filters.regionCode !== null) count++;
    if (filters.regionLevel !== null) count++;
    if (filters.industryCode !== null) count++;
    if (filters.industryLevel !== null) count++;
    if (filters.datasetId !== null) count++;
    if (filters.datasetIds.length > 0) count++;
    if (filters.valueLabel !== null) count++;
    return count;
  }, [filters]);

  return {
    hasActiveFilters,
    activeFilterCount,
    filterSummary,
    filters,
  };
}

// =============================================================================
// Type exports
// =============================================================================

export type {
  FilterState,
  TimeResolution,
  RegionLevel,
  IndustryLevel,
} from '../context/FilterContext';
