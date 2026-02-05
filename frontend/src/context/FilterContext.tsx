/**
 * Filter state management context for shared filter state across visualization components.
 *
 * This module provides:
 * - FilterContext: React Context for accessing filter state
 * - FilterProvider: Provider component that manages filter state
 * - URL synchronization for shareable filter states
 *
 * Filter state includes:
 * - Time dimensions: year, quarter, month, year_from, year_to
 * - Geographic dimensions: region_code, region_level
 * - Industry dimensions: industry_code, industry_level
 * - Dataset dimensions: dataset_id, value_label
 *
 * @example
 * // Wrap your app or page with FilterProvider
 * <FilterProvider>
 *   <Dashboard />
 * </FilterProvider>
 *
 * // Access filter state in child components
 * const { filters, setYear, setRegion } = useFilterContext();
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import type { StatisticQueryParams } from '../types/api';

// =============================================================================
// Types
// =============================================================================

/** Region level types for Finnish administrative hierarchy */
export type RegionLevel = 'kunta' | 'seutukunta' | 'maakunta' | null;

/** Industry level types for TOL 2008 classification */
export type IndustryLevel = 'section' | 'division' | 'group' | 'class' | null;

/** Time resolution for temporal filtering */
export type TimeResolution = 'year' | 'quarter' | 'month';

/**
 * Filter state interface representing all available filter dimensions.
 * All filters are optional (null means no filter applied).
 */
export interface FilterState {
  // Time dimensions
  /** Selected year (exact match) */
  year: number | null;
  /** Starting year for range queries */
  yearFrom: number | null;
  /** Ending year for range queries */
  yearTo: number | null;
  /** Selected quarter (1-4) */
  quarter: number | null;
  /** Selected month (1-12) */
  month: number | null;
  /** Current time resolution for display */
  timeResolution: TimeResolution;

  // Geographic dimensions
  /** Selected region code */
  regionCode: string | null;
  /** Selected region level for aggregation */
  regionLevel: RegionLevel;

  // Industry dimensions
  /** Selected industry code */
  industryCode: string | null;
  /** Selected industry level for aggregation */
  industryLevel: IndustryLevel;

  // Dataset dimensions
  /** Selected dataset ID */
  datasetId: string | null;
  /** Selected datasets for comparison (multiple selection) */
  datasetIds: string[];
  /** Selected value label within dataset */
  valueLabel: string | null;
}

/**
 * Actions that can modify the filter state.
 */
export type FilterAction =
  | { type: 'SET_YEAR'; payload: number | null }
  | { type: 'SET_YEAR_RANGE'; payload: { from: number | null; to: number | null } }
  | { type: 'SET_QUARTER'; payload: number | null }
  | { type: 'SET_MONTH'; payload: number | null }
  | { type: 'SET_TIME_RESOLUTION'; payload: TimeResolution }
  | { type: 'SET_REGION_CODE'; payload: string | null }
  | { type: 'SET_REGION_LEVEL'; payload: RegionLevel }
  | { type: 'SET_REGION'; payload: { code: string | null; level: RegionLevel } }
  | { type: 'SET_INDUSTRY_CODE'; payload: string | null }
  | { type: 'SET_INDUSTRY_LEVEL'; payload: IndustryLevel }
  | { type: 'SET_INDUSTRY'; payload: { code: string | null; level: IndustryLevel } }
  | { type: 'SET_DATASET_ID'; payload: string | null }
  | { type: 'SET_DATASET_IDS'; payload: string[] }
  | { type: 'ADD_DATASET_ID'; payload: string }
  | { type: 'REMOVE_DATASET_ID'; payload: string }
  | { type: 'SET_VALUE_LABEL'; payload: string | null }
  | { type: 'SET_FILTERS'; payload: Partial<FilterState> }
  | { type: 'RESET_FILTERS' }
  | { type: 'RESET_TIME_FILTERS' }
  | { type: 'RESET_GEOGRAPHIC_FILTERS' }
  | { type: 'RESET_INDUSTRY_FILTERS' };

/**
 * Context value providing filter state and dispatch actions.
 */
export interface FilterContextValue {
  /** Current filter state */
  filters: FilterState;
  /** Dispatch function for filter actions */
  dispatch: React.Dispatch<FilterAction>;

  // Convenience setters for common operations
  setYear: (year: number | null) => void;
  setYearRange: (from: number | null, to: number | null) => void;
  setQuarter: (quarter: number | null) => void;
  setMonth: (month: number | null) => void;
  setTimeResolution: (resolution: TimeResolution) => void;
  setRegionCode: (code: string | null) => void;
  setRegionLevel: (level: RegionLevel) => void;
  setRegion: (code: string | null, level: RegionLevel) => void;
  setIndustryCode: (code: string | null) => void;
  setIndustryLevel: (level: IndustryLevel) => void;
  setIndustry: (code: string | null, level: IndustryLevel) => void;
  setDatasetId: (id: string | null) => void;
  setDatasetIds: (ids: string[]) => void;
  addDatasetId: (id: string) => void;
  removeDatasetId: (id: string) => void;
  setValueLabel: (label: string | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  resetTimeFilters: () => void;
  resetGeographicFilters: () => void;
  resetIndustryFilters: () => void;

  // Utility for API queries
  /** Convert current filter state to API query parameters */
  toQueryParams: () => StatisticQueryParams;
  /** Check if any filters are currently active */
  hasActiveFilters: boolean;
}

// =============================================================================
// Default State
// =============================================================================

/** Default filter state with no filters applied */
const defaultFilterState: FilterState = {
  // Time dimensions
  year: null,
  yearFrom: null,
  yearTo: null,
  quarter: null,
  month: null,
  timeResolution: 'year',

  // Geographic dimensions
  regionCode: null,
  regionLevel: null,

  // Industry dimensions
  industryCode: null,
  industryLevel: null,

  // Dataset dimensions
  datasetId: null,
  datasetIds: [],
  valueLabel: null,
};

// =============================================================================
// Reducer
// =============================================================================

/**
 * Reducer function for filter state management.
 */
function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_YEAR':
      return { ...state, year: action.payload };

    case 'SET_YEAR_RANGE':
      return {
        ...state,
        yearFrom: action.payload.from,
        yearTo: action.payload.to,
        year: null, // Clear exact year when setting range
      };

    case 'SET_QUARTER':
      return { ...state, quarter: action.payload };

    case 'SET_MONTH':
      return { ...state, month: action.payload };

    case 'SET_TIME_RESOLUTION':
      return {
        ...state,
        timeResolution: action.payload,
        // Clear sub-resolution filters when changing resolution
        quarter: action.payload === 'year' ? null : state.quarter,
        month: action.payload !== 'month' ? null : state.month,
      };

    case 'SET_REGION_CODE':
      return { ...state, regionCode: action.payload };

    case 'SET_REGION_LEVEL':
      return { ...state, regionLevel: action.payload };

    case 'SET_REGION':
      return {
        ...state,
        regionCode: action.payload.code,
        regionLevel: action.payload.level,
      };

    case 'SET_INDUSTRY_CODE':
      return { ...state, industryCode: action.payload };

    case 'SET_INDUSTRY_LEVEL':
      return { ...state, industryLevel: action.payload };

    case 'SET_INDUSTRY':
      return {
        ...state,
        industryCode: action.payload.code,
        industryLevel: action.payload.level,
      };

    case 'SET_DATASET_ID':
      return { ...state, datasetId: action.payload };

    case 'SET_DATASET_IDS':
      return { ...state, datasetIds: action.payload };

    case 'ADD_DATASET_ID':
      if (state.datasetIds.includes(action.payload)) {
        return state;
      }
      return { ...state, datasetIds: [...state.datasetIds, action.payload] };

    case 'REMOVE_DATASET_ID':
      return {
        ...state,
        datasetIds: state.datasetIds.filter((id) => id !== action.payload),
      };

    case 'SET_VALUE_LABEL':
      return { ...state, valueLabel: action.payload };

    case 'SET_FILTERS':
      return { ...state, ...action.payload };

    case 'RESET_FILTERS':
      return defaultFilterState;

    case 'RESET_TIME_FILTERS':
      return {
        ...state,
        year: null,
        yearFrom: null,
        yearTo: null,
        quarter: null,
        month: null,
        timeResolution: 'year',
      };

    case 'RESET_GEOGRAPHIC_FILTERS':
      return {
        ...state,
        regionCode: null,
        regionLevel: null,
      };

    case 'RESET_INDUSTRY_FILTERS':
      return {
        ...state,
        industryCode: null,
        industryLevel: null,
      };

    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

/** React Context for filter state */
export const FilterContext = createContext<FilterContextValue | null>(null);

// =============================================================================
// URL Synchronization Utilities
// =============================================================================

/**
 * Parse filter state from URL search params.
 */
function parseFiltersFromURL(searchParams: URLSearchParams): Partial<FilterState> {
  const filters: Partial<FilterState> = {};

  // Time dimensions
  const year = searchParams.get('year');
  if (year) filters.year = parseInt(year, 10);

  const yearFrom = searchParams.get('yearFrom');
  if (yearFrom) filters.yearFrom = parseInt(yearFrom, 10);

  const yearTo = searchParams.get('yearTo');
  if (yearTo) filters.yearTo = parseInt(yearTo, 10);

  const quarter = searchParams.get('quarter');
  if (quarter) filters.quarter = parseInt(quarter, 10);

  const month = searchParams.get('month');
  if (month) filters.month = parseInt(month, 10);

  const timeResolution = searchParams.get('resolution');
  if (timeResolution && ['year', 'quarter', 'month'].includes(timeResolution)) {
    filters.timeResolution = timeResolution as TimeResolution;
  }

  // Geographic dimensions
  const regionCode = searchParams.get('region');
  if (regionCode) filters.regionCode = regionCode;

  const regionLevel = searchParams.get('regionLevel');
  if (regionLevel && ['kunta', 'seutukunta', 'maakunta'].includes(regionLevel)) {
    filters.regionLevel = regionLevel as RegionLevel;
  }

  // Industry dimensions
  const industryCode = searchParams.get('industry');
  if (industryCode) filters.industryCode = industryCode;

  const industryLevel = searchParams.get('industryLevel');
  if (industryLevel && ['section', 'division', 'group', 'class'].includes(industryLevel)) {
    filters.industryLevel = industryLevel as IndustryLevel;
  }

  // Dataset dimensions
  const datasetId = searchParams.get('dataset');
  if (datasetId) filters.datasetId = datasetId;

  const datasets = searchParams.get('datasets');
  if (datasets) filters.datasetIds = datasets.split(',').filter(Boolean);

  const valueLabel = searchParams.get('valueLabel');
  if (valueLabel) filters.valueLabel = valueLabel;

  return filters;
}

/**
 * Serialize filter state to URL search params.
 */
function serializeFiltersToURL(
  filters: FilterState,
  setSearchParams: ReturnType<typeof useSearchParams>[1]
) {
  const params = new URLSearchParams();

  // Time dimensions
  if (filters.year !== null) params.set('year', filters.year.toString());
  if (filters.yearFrom !== null) params.set('yearFrom', filters.yearFrom.toString());
  if (filters.yearTo !== null) params.set('yearTo', filters.yearTo.toString());
  if (filters.quarter !== null) params.set('quarter', filters.quarter.toString());
  if (filters.month !== null) params.set('month', filters.month.toString());
  if (filters.timeResolution !== 'year') params.set('resolution', filters.timeResolution);

  // Geographic dimensions
  if (filters.regionCode) params.set('region', filters.regionCode);
  if (filters.regionLevel) params.set('regionLevel', filters.regionLevel);

  // Industry dimensions
  if (filters.industryCode) params.set('industry', filters.industryCode);
  if (filters.industryLevel) params.set('industryLevel', filters.industryLevel);

  // Dataset dimensions
  if (filters.datasetId) params.set('dataset', filters.datasetId);
  if (filters.datasetIds.length > 0) params.set('datasets', filters.datasetIds.join(','));
  if (filters.valueLabel) params.set('valueLabel', filters.valueLabel);

  setSearchParams(params, { replace: true });
}

// =============================================================================
// Provider Component
// =============================================================================

export interface FilterProviderProps {
  /** Child components that can access filter context */
  children: ReactNode;
  /** Whether to synchronize filter state with URL */
  syncWithURL?: boolean;
  /** Initial filter state (overrides URL if both present) */
  initialFilters?: Partial<FilterState>;
}

/**
 * Provider component for filter state management.
 *
 * Wraps children with filter context and optionally syncs with URL.
 *
 * @example
 * <FilterProvider syncWithURL>
 *   <Dashboard />
 * </FilterProvider>
 */
export function FilterProvider({
  children,
  syncWithURL = true,
  initialFilters,
}: FilterProviderProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params or defaults
  const initialState = useMemo(() => {
    const urlFilters = syncWithURL ? parseFiltersFromURL(searchParams) : {};
    return {
      ...defaultFilterState,
      ...urlFilters,
      ...initialFilters,
    };
  }, []); // Only compute once on mount

  const [filters, dispatch] = useReducer(filterReducer, initialState);

  // Sync filter state to URL when it changes
  useEffect(() => {
    if (syncWithURL) {
      serializeFiltersToURL(filters, setSearchParams);
    }
  }, [filters, syncWithURL, setSearchParams]);

  // Convenience setter functions
  const setYear = useCallback((year: number | null) => {
    dispatch({ type: 'SET_YEAR', payload: year });
  }, []);

  const setYearRange = useCallback((from: number | null, to: number | null) => {
    dispatch({ type: 'SET_YEAR_RANGE', payload: { from, to } });
  }, []);

  const setQuarter = useCallback((quarter: number | null) => {
    dispatch({ type: 'SET_QUARTER', payload: quarter });
  }, []);

  const setMonth = useCallback((month: number | null) => {
    dispatch({ type: 'SET_MONTH', payload: month });
  }, []);

  const setTimeResolution = useCallback((resolution: TimeResolution) => {
    dispatch({ type: 'SET_TIME_RESOLUTION', payload: resolution });
  }, []);

  const setRegionCode = useCallback((code: string | null) => {
    dispatch({ type: 'SET_REGION_CODE', payload: code });
  }, []);

  const setRegionLevel = useCallback((level: RegionLevel) => {
    dispatch({ type: 'SET_REGION_LEVEL', payload: level });
  }, []);

  const setRegion = useCallback((code: string | null, level: RegionLevel) => {
    dispatch({ type: 'SET_REGION', payload: { code, level } });
  }, []);

  const setIndustryCode = useCallback((code: string | null) => {
    dispatch({ type: 'SET_INDUSTRY_CODE', payload: code });
  }, []);

  const setIndustryLevel = useCallback((level: IndustryLevel) => {
    dispatch({ type: 'SET_INDUSTRY_LEVEL', payload: level });
  }, []);

  const setIndustry = useCallback((code: string | null, level: IndustryLevel) => {
    dispatch({ type: 'SET_INDUSTRY', payload: { code, level } });
  }, []);

  const setDatasetId = useCallback((id: string | null) => {
    dispatch({ type: 'SET_DATASET_ID', payload: id });
  }, []);

  const setDatasetIds = useCallback((ids: string[]) => {
    dispatch({ type: 'SET_DATASET_IDS', payload: ids });
  }, []);

  const addDatasetId = useCallback((id: string) => {
    dispatch({ type: 'ADD_DATASET_ID', payload: id });
  }, []);

  const removeDatasetId = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_DATASET_ID', payload: id });
  }, []);

  const setValueLabel = useCallback((label: string | null) => {
    dispatch({ type: 'SET_VALUE_LABEL', payload: label });
  }, []);

  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    dispatch({ type: 'SET_FILTERS', payload: newFilters });
  }, []);

  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET_FILTERS' });
  }, []);

  const resetTimeFilters = useCallback(() => {
    dispatch({ type: 'RESET_TIME_FILTERS' });
  }, []);

  const resetGeographicFilters = useCallback(() => {
    dispatch({ type: 'RESET_GEOGRAPHIC_FILTERS' });
  }, []);

  const resetIndustryFilters = useCallback(() => {
    dispatch({ type: 'RESET_INDUSTRY_FILTERS' });
  }, []);

  // Convert filter state to API query parameters
  const toQueryParams = useCallback((): StatisticQueryParams => {
    const params: StatisticQueryParams = {};

    // Time dimensions
    if (filters.year !== null) params.year = filters.year;
    if (filters.yearFrom !== null) params.year_from = filters.yearFrom;
    if (filters.yearTo !== null) params.year_to = filters.yearTo;
    if (filters.quarter !== null) params.quarter = filters.quarter;
    if (filters.month !== null) params.month = filters.month;

    // Geographic dimensions
    if (filters.regionCode) params.region_code = filters.regionCode;
    if (filters.regionLevel) params.region_level = filters.regionLevel;

    // Industry dimensions
    if (filters.industryCode) params.industry_code = filters.industryCode;
    if (filters.industryLevel) params.industry_level = filters.industryLevel;

    // Dataset dimensions
    if (filters.datasetId) params.dataset_id = filters.datasetId;
    if (filters.valueLabel) params.value_label = filters.valueLabel;

    return params;
  }, [filters]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.year !== null ||
      filters.yearFrom !== null ||
      filters.yearTo !== null ||
      filters.quarter !== null ||
      filters.month !== null ||
      filters.regionCode !== null ||
      filters.regionLevel !== null ||
      filters.industryCode !== null ||
      filters.industryLevel !== null ||
      filters.datasetId !== null ||
      filters.datasetIds.length > 0 ||
      filters.valueLabel !== null
    );
  }, [filters]);

  const contextValue: FilterContextValue = useMemo(
    () => ({
      filters,
      dispatch,
      setYear,
      setYearRange,
      setQuarter,
      setMonth,
      setTimeResolution,
      setRegionCode,
      setRegionLevel,
      setRegion,
      setIndustryCode,
      setIndustryLevel,
      setIndustry,
      setDatasetId,
      setDatasetIds,
      addDatasetId,
      removeDatasetId,
      setValueLabel,
      setFilters,
      resetFilters,
      resetTimeFilters,
      resetGeographicFilters,
      resetIndustryFilters,
      toQueryParams,
      hasActiveFilters,
    }),
    [
      filters,
      setYear,
      setYearRange,
      setQuarter,
      setMonth,
      setTimeResolution,
      setRegionCode,
      setRegionLevel,
      setRegion,
      setIndustryCode,
      setIndustryLevel,
      setIndustry,
      setDatasetId,
      setDatasetIds,
      addDatasetId,
      removeDatasetId,
      setValueLabel,
      setFilters,
      resetFilters,
      resetTimeFilters,
      resetGeographicFilters,
      resetIndustryFilters,
      toQueryParams,
      hasActiveFilters,
    ]
  );

  return (
    <FilterContext.Provider value={contextValue}>{children}</FilterContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access filter context.
 *
 * Must be used within a FilterProvider.
 *
 * @throws Error if used outside FilterProvider
 *
 * @example
 * const { filters, setYear, setRegion, toQueryParams } = useFilterContext();
 */
export function useFilterContext(): FilterContextValue {
  const context = useContext(FilterContext);

  if (!context) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }

  return context;
}
