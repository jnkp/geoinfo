/**
 * Filter logic tests for FilterContext reducer and utilities.
 *
 * Tests cover:
 * - Filter reducer actions for all filter dimensions
 * - Filter state transitions
 * - URL parameter parsing and serialization
 * - Query parameter conversion
 * - Active filter detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  FilterState,
  FilterAction,
  RegionLevel,
  IndustryLevel,
  TimeResolution,
} from '../context/FilterContext';

// =============================================================================
// Test Utilities - Inline Reducer for Testing
// =============================================================================

/**
 * Default filter state with no filters applied (mirrors FilterContext)
 */
const defaultFilterState: FilterState = {
  year: null,
  yearFrom: null,
  yearTo: null,
  quarter: null,
  month: null,
  timeResolution: 'year',
  regionCode: null,
  regionLevel: null,
  industryCode: null,
  industryLevel: null,
  datasetId: null,
  datasetIds: [],
  valueLabel: null,
};

/**
 * Reducer function for filter state management (mirrors FilterContext).
 * Inlined for unit testing without React dependencies.
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
        year: null,
      };

    case 'SET_QUARTER':
      return { ...state, quarter: action.payload };

    case 'SET_MONTH':
      return { ...state, month: action.payload };

    case 'SET_TIME_RESOLUTION':
      return {
        ...state,
        timeResolution: action.payload,
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

/**
 * Parse filter state from URL search params (mirrors FilterContext).
 */
function parseFiltersFromURL(searchParams: URLSearchParams): Partial<FilterState> {
  const filters: Partial<FilterState> = {};

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

  const regionCode = searchParams.get('region');
  if (regionCode) filters.regionCode = regionCode;

  const regionLevel = searchParams.get('regionLevel');
  if (regionLevel && ['kunta', 'seutukunta', 'maakunta'].includes(regionLevel)) {
    filters.regionLevel = regionLevel as RegionLevel;
  }

  const industryCode = searchParams.get('industry');
  if (industryCode) filters.industryCode = industryCode;

  const industryLevel = searchParams.get('industryLevel');
  if (industryLevel && ['section', 'division', 'group', 'class'].includes(industryLevel)) {
    filters.industryLevel = industryLevel as IndustryLevel;
  }

  const datasetId = searchParams.get('dataset');
  if (datasetId) filters.datasetId = datasetId;

  const datasets = searchParams.get('datasets');
  if (datasets) filters.datasetIds = datasets.split(',').filter(Boolean);

  const valueLabel = searchParams.get('valueLabel');
  if (valueLabel) filters.valueLabel = valueLabel;

  return filters;
}

/**
 * Serialize filter state to URL search params (mirrors FilterContext).
 */
function serializeFiltersToURL(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.year !== null) params.set('year', filters.year.toString());
  if (filters.yearFrom !== null) params.set('yearFrom', filters.yearFrom.toString());
  if (filters.yearTo !== null) params.set('yearTo', filters.yearTo.toString());
  if (filters.quarter !== null) params.set('quarter', filters.quarter.toString());
  if (filters.month !== null) params.set('month', filters.month.toString());
  if (filters.timeResolution !== 'year') params.set('resolution', filters.timeResolution);

  if (filters.regionCode) params.set('region', filters.regionCode);
  if (filters.regionLevel) params.set('regionLevel', filters.regionLevel);

  if (filters.industryCode) params.set('industry', filters.industryCode);
  if (filters.industryLevel) params.set('industryLevel', filters.industryLevel);

  if (filters.datasetId) params.set('dataset', filters.datasetId);
  if (filters.datasetIds.length > 0) params.set('datasets', filters.datasetIds.join(','));
  if (filters.valueLabel) params.set('valueLabel', filters.valueLabel);

  return params;
}

/**
 * Convert filter state to API query parameters (mirrors FilterContext).
 */
function toQueryParams(filters: FilterState): Record<string, string | number | null | undefined> {
  const params: Record<string, string | number | null | undefined> = {};

  if (filters.year !== null) params.year = filters.year;
  if (filters.yearFrom !== null) params.year_from = filters.yearFrom;
  if (filters.yearTo !== null) params.year_to = filters.yearTo;
  if (filters.quarter !== null) params.quarter = filters.quarter;
  if (filters.month !== null) params.month = filters.month;

  if (filters.regionCode) params.region_code = filters.regionCode;
  if (filters.regionLevel) params.region_level = filters.regionLevel;

  if (filters.industryCode) params.industry_code = filters.industryCode;
  if (filters.industryLevel) params.industry_level = filters.industryLevel;

  if (filters.datasetId) params.dataset_id = filters.datasetId;
  if (filters.valueLabel) params.value_label = filters.valueLabel;

  return params;
}

/**
 * Check if any filters are currently active (mirrors FilterContext).
 */
function hasActiveFilters(filters: FilterState): boolean {
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
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Filter Reducer', () => {
  let state: FilterState;

  beforeEach(() => {
    state = { ...defaultFilterState };
  });

  describe('Time Dimension Actions', () => {
    it('should set year', () => {
      const newState = filterReducer(state, { type: 'SET_YEAR', payload: 2023 });
      expect(newState.year).toBe(2023);
    });

    it('should clear year when setting null', () => {
      state = { ...state, year: 2023 };
      const newState = filterReducer(state, { type: 'SET_YEAR', payload: null });
      expect(newState.year).toBeNull();
    });

    it('should set year range and clear exact year', () => {
      state = { ...state, year: 2023 };
      const newState = filterReducer(state, {
        type: 'SET_YEAR_RANGE',
        payload: { from: 2020, to: 2025 },
      });
      expect(newState.yearFrom).toBe(2020);
      expect(newState.yearTo).toBe(2025);
      expect(newState.year).toBeNull();
    });

    it('should set quarter', () => {
      const newState = filterReducer(state, { type: 'SET_QUARTER', payload: 3 });
      expect(newState.quarter).toBe(3);
    });

    it('should set month', () => {
      const newState = filterReducer(state, { type: 'SET_MONTH', payload: 6 });
      expect(newState.month).toBe(6);
    });

    it('should set time resolution and clear sub-resolution filters for year', () => {
      state = { ...state, quarter: 2, month: 5, timeResolution: 'month' };
      const newState = filterReducer(state, {
        type: 'SET_TIME_RESOLUTION',
        payload: 'year',
      });
      expect(newState.timeResolution).toBe('year');
      expect(newState.quarter).toBeNull();
      expect(newState.month).toBeNull();
    });

    it('should set time resolution to quarter and clear month', () => {
      state = { ...state, quarter: 2, month: 5, timeResolution: 'month' };
      const newState = filterReducer(state, {
        type: 'SET_TIME_RESOLUTION',
        payload: 'quarter',
      });
      expect(newState.timeResolution).toBe('quarter');
      expect(newState.quarter).toBe(2);
      expect(newState.month).toBeNull();
    });

    it('should set time resolution to month and preserve all', () => {
      state = { ...state, quarter: 2, month: 5, timeResolution: 'year' };
      const newState = filterReducer(state, {
        type: 'SET_TIME_RESOLUTION',
        payload: 'month',
      });
      expect(newState.timeResolution).toBe('month');
      expect(newState.quarter).toBe(2);
      expect(newState.month).toBe(5);
    });
  });

  describe('Geographic Dimension Actions', () => {
    it('should set region code', () => {
      const newState = filterReducer(state, { type: 'SET_REGION_CODE', payload: '091' });
      expect(newState.regionCode).toBe('091');
    });

    it('should set region level', () => {
      const newState = filterReducer(state, { type: 'SET_REGION_LEVEL', payload: 'kunta' });
      expect(newState.regionLevel).toBe('kunta');
    });

    it('should set region code and level together', () => {
      const newState = filterReducer(state, {
        type: 'SET_REGION',
        payload: { code: '091', level: 'kunta' },
      });
      expect(newState.regionCode).toBe('091');
      expect(newState.regionLevel).toBe('kunta');
    });

    it('should handle null region values', () => {
      state = { ...state, regionCode: '091', regionLevel: 'kunta' };
      const newState = filterReducer(state, {
        type: 'SET_REGION',
        payload: { code: null, level: null },
      });
      expect(newState.regionCode).toBeNull();
      expect(newState.regionLevel).toBeNull();
    });
  });

  describe('Industry Dimension Actions', () => {
    it('should set industry code', () => {
      const newState = filterReducer(state, { type: 'SET_INDUSTRY_CODE', payload: 'A' });
      expect(newState.industryCode).toBe('A');
    });

    it('should set industry level', () => {
      const newState = filterReducer(state, { type: 'SET_INDUSTRY_LEVEL', payload: 'section' });
      expect(newState.industryLevel).toBe('section');
    });

    it('should set industry code and level together', () => {
      const newState = filterReducer(state, {
        type: 'SET_INDUSTRY',
        payload: { code: 'C', level: 'section' },
      });
      expect(newState.industryCode).toBe('C');
      expect(newState.industryLevel).toBe('section');
    });

    it('should handle null industry values', () => {
      state = { ...state, industryCode: 'A', industryLevel: 'section' };
      const newState = filterReducer(state, {
        type: 'SET_INDUSTRY',
        payload: { code: null, level: null },
      });
      expect(newState.industryCode).toBeNull();
      expect(newState.industryLevel).toBeNull();
    });
  });

  describe('Dataset Dimension Actions', () => {
    it('should set dataset ID', () => {
      const newState = filterReducer(state, { type: 'SET_DATASET_ID', payload: 'tyonv_001' });
      expect(newState.datasetId).toBe('tyonv_001');
    });

    it('should set multiple dataset IDs', () => {
      const newState = filterReducer(state, {
        type: 'SET_DATASET_IDS',
        payload: ['dataset1', 'dataset2'],
      });
      expect(newState.datasetIds).toEqual(['dataset1', 'dataset2']);
    });

    it('should add dataset ID', () => {
      state = { ...state, datasetIds: ['dataset1'] };
      const newState = filterReducer(state, { type: 'ADD_DATASET_ID', payload: 'dataset2' });
      expect(newState.datasetIds).toEqual(['dataset1', 'dataset2']);
    });

    it('should not add duplicate dataset ID', () => {
      state = { ...state, datasetIds: ['dataset1'] };
      const newState = filterReducer(state, { type: 'ADD_DATASET_ID', payload: 'dataset1' });
      expect(newState.datasetIds).toEqual(['dataset1']);
      expect(newState).toBe(state); // Same reference since no change
    });

    it('should remove dataset ID', () => {
      state = { ...state, datasetIds: ['dataset1', 'dataset2', 'dataset3'] };
      const newState = filterReducer(state, { type: 'REMOVE_DATASET_ID', payload: 'dataset2' });
      expect(newState.datasetIds).toEqual(['dataset1', 'dataset3']);
    });

    it('should handle removing non-existent dataset ID', () => {
      state = { ...state, datasetIds: ['dataset1'] };
      const newState = filterReducer(state, { type: 'REMOVE_DATASET_ID', payload: 'nonexistent' });
      expect(newState.datasetIds).toEqual(['dataset1']);
    });

    it('should set value label', () => {
      const newState = filterReducer(state, { type: 'SET_VALUE_LABEL', payload: 'employment' });
      expect(newState.valueLabel).toBe('employment');
    });
  });

  describe('Bulk and Reset Actions', () => {
    it('should set multiple filters at once', () => {
      const newState = filterReducer(state, {
        type: 'SET_FILTERS',
        payload: { year: 2023, regionCode: '091', industryCode: 'A' },
      });
      expect(newState.year).toBe(2023);
      expect(newState.regionCode).toBe('091');
      expect(newState.industryCode).toBe('A');
    });

    it('should reset all filters', () => {
      state = {
        year: 2023,
        yearFrom: 2020,
        yearTo: 2025,
        quarter: 2,
        month: 6,
        timeResolution: 'month',
        regionCode: '091',
        regionLevel: 'kunta',
        industryCode: 'A',
        industryLevel: 'section',
        datasetId: 'dataset1',
        datasetIds: ['dataset1', 'dataset2'],
        valueLabel: 'employment',
      };
      const newState = filterReducer(state, { type: 'RESET_FILTERS' });
      expect(newState).toEqual(defaultFilterState);
    });

    it('should reset only time filters', () => {
      state = {
        ...state,
        year: 2023,
        yearFrom: 2020,
        yearTo: 2025,
        quarter: 2,
        month: 6,
        timeResolution: 'month',
        regionCode: '091',
        industryCode: 'A',
      };
      const newState = filterReducer(state, { type: 'RESET_TIME_FILTERS' });
      expect(newState.year).toBeNull();
      expect(newState.yearFrom).toBeNull();
      expect(newState.yearTo).toBeNull();
      expect(newState.quarter).toBeNull();
      expect(newState.month).toBeNull();
      expect(newState.timeResolution).toBe('year');
      expect(newState.regionCode).toBe('091');
      expect(newState.industryCode).toBe('A');
    });

    it('should reset only geographic filters', () => {
      state = {
        ...state,
        year: 2023,
        regionCode: '091',
        regionLevel: 'kunta',
        industryCode: 'A',
      };
      const newState = filterReducer(state, { type: 'RESET_GEOGRAPHIC_FILTERS' });
      expect(newState.year).toBe(2023);
      expect(newState.regionCode).toBeNull();
      expect(newState.regionLevel).toBeNull();
      expect(newState.industryCode).toBe('A');
    });

    it('should reset only industry filters', () => {
      state = {
        ...state,
        year: 2023,
        regionCode: '091',
        industryCode: 'A',
        industryLevel: 'section',
      };
      const newState = filterReducer(state, { type: 'RESET_INDUSTRY_FILTERS' });
      expect(newState.year).toBe(2023);
      expect(newState.regionCode).toBe('091');
      expect(newState.industryCode).toBeNull();
      expect(newState.industryLevel).toBeNull();
    });
  });

  describe('Default Case', () => {
    it('should return unchanged state for unknown action', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION' } as unknown as FilterAction;
      const newState = filterReducer(state, unknownAction);
      expect(newState).toBe(state);
    });
  });
});

describe('URL Parameter Parsing', () => {
  it('should parse empty URL params', () => {
    const params = new URLSearchParams();
    const filters = parseFiltersFromURL(params);
    expect(filters).toEqual({});
  });

  it('should parse year parameter', () => {
    const params = new URLSearchParams('year=2023');
    const filters = parseFiltersFromURL(params);
    expect(filters.year).toBe(2023);
  });

  it('should parse year range parameters', () => {
    const params = new URLSearchParams('yearFrom=2020&yearTo=2025');
    const filters = parseFiltersFromURL(params);
    expect(filters.yearFrom).toBe(2020);
    expect(filters.yearTo).toBe(2025);
  });

  it('should parse quarter and month parameters', () => {
    const params = new URLSearchParams('quarter=3&month=9');
    const filters = parseFiltersFromURL(params);
    expect(filters.quarter).toBe(3);
    expect(filters.month).toBe(9);
  });

  it('should parse time resolution parameter', () => {
    const params = new URLSearchParams('resolution=quarter');
    const filters = parseFiltersFromURL(params);
    expect(filters.timeResolution).toBe('quarter');
  });

  it('should ignore invalid time resolution', () => {
    const params = new URLSearchParams('resolution=invalid');
    const filters = parseFiltersFromURL(params);
    expect(filters.timeResolution).toBeUndefined();
  });

  it('should parse region parameters', () => {
    const params = new URLSearchParams('region=091&regionLevel=kunta');
    const filters = parseFiltersFromURL(params);
    expect(filters.regionCode).toBe('091');
    expect(filters.regionLevel).toBe('kunta');
  });

  it('should ignore invalid region level', () => {
    const params = new URLSearchParams('regionLevel=invalid');
    const filters = parseFiltersFromURL(params);
    expect(filters.regionLevel).toBeUndefined();
  });

  it('should parse industry parameters', () => {
    const params = new URLSearchParams('industry=C&industryLevel=section');
    const filters = parseFiltersFromURL(params);
    expect(filters.industryCode).toBe('C');
    expect(filters.industryLevel).toBe('section');
  });

  it('should ignore invalid industry level', () => {
    const params = new URLSearchParams('industryLevel=invalid');
    const filters = parseFiltersFromURL(params);
    expect(filters.industryLevel).toBeUndefined();
  });

  it('should parse dataset parameters', () => {
    const params = new URLSearchParams('dataset=tyonv_001&valueLabel=employment');
    const filters = parseFiltersFromURL(params);
    expect(filters.datasetId).toBe('tyonv_001');
    expect(filters.valueLabel).toBe('employment');
  });

  it('should parse multiple dataset IDs', () => {
    const params = new URLSearchParams('datasets=dataset1,dataset2,dataset3');
    const filters = parseFiltersFromURL(params);
    expect(filters.datasetIds).toEqual(['dataset1', 'dataset2', 'dataset3']);
  });

  it('should handle empty datasets string', () => {
    const params = new URLSearchParams('datasets=');
    const filters = parseFiltersFromURL(params);
    expect(filters.datasetIds).toEqual([]);
  });

  it('should parse all parameters together', () => {
    const params = new URLSearchParams(
      'year=2023&quarter=2&region=091&regionLevel=kunta&industry=C&industryLevel=section&dataset=tyonv_001'
    );
    const filters = parseFiltersFromURL(params);
    expect(filters.year).toBe(2023);
    expect(filters.quarter).toBe(2);
    expect(filters.regionCode).toBe('091');
    expect(filters.regionLevel).toBe('kunta');
    expect(filters.industryCode).toBe('C');
    expect(filters.industryLevel).toBe('section');
    expect(filters.datasetId).toBe('tyonv_001');
  });
});

describe('URL Parameter Serialization', () => {
  it('should serialize empty state to empty params', () => {
    const params = serializeFiltersToURL(defaultFilterState);
    expect(params.toString()).toBe('');
  });

  it('should serialize year', () => {
    const state = { ...defaultFilterState, year: 2023 };
    const params = serializeFiltersToURL(state);
    expect(params.get('year')).toBe('2023');
  });

  it('should serialize year range', () => {
    const state = { ...defaultFilterState, yearFrom: 2020, yearTo: 2025 };
    const params = serializeFiltersToURL(state);
    expect(params.get('yearFrom')).toBe('2020');
    expect(params.get('yearTo')).toBe('2025');
  });

  it('should serialize quarter and month', () => {
    const state = { ...defaultFilterState, quarter: 3, month: 9 };
    const params = serializeFiltersToURL(state);
    expect(params.get('quarter')).toBe('3');
    expect(params.get('month')).toBe('9');
  });

  it('should not serialize default time resolution', () => {
    const state = { ...defaultFilterState, timeResolution: 'year' as TimeResolution };
    const params = serializeFiltersToURL(state);
    expect(params.get('resolution')).toBeNull();
  });

  it('should serialize non-default time resolution', () => {
    const state = { ...defaultFilterState, timeResolution: 'month' as TimeResolution };
    const params = serializeFiltersToURL(state);
    expect(params.get('resolution')).toBe('month');
  });

  it('should serialize region parameters', () => {
    const state = {
      ...defaultFilterState,
      regionCode: '091',
      regionLevel: 'kunta' as RegionLevel,
    };
    const params = serializeFiltersToURL(state);
    expect(params.get('region')).toBe('091');
    expect(params.get('regionLevel')).toBe('kunta');
  });

  it('should serialize industry parameters', () => {
    const state = {
      ...defaultFilterState,
      industryCode: 'C',
      industryLevel: 'section' as IndustryLevel,
    };
    const params = serializeFiltersToURL(state);
    expect(params.get('industry')).toBe('C');
    expect(params.get('industryLevel')).toBe('section');
  });

  it('should serialize dataset parameters', () => {
    const state = {
      ...defaultFilterState,
      datasetId: 'tyonv_001',
      valueLabel: 'employment',
    };
    const params = serializeFiltersToURL(state);
    expect(params.get('dataset')).toBe('tyonv_001');
    expect(params.get('valueLabel')).toBe('employment');
  });

  it('should serialize multiple dataset IDs', () => {
    const state = {
      ...defaultFilterState,
      datasetIds: ['dataset1', 'dataset2', 'dataset3'],
    };
    const params = serializeFiltersToURL(state);
    expect(params.get('datasets')).toBe('dataset1,dataset2,dataset3');
  });

  it('should not serialize empty dataset IDs array', () => {
    const state = { ...defaultFilterState, datasetIds: [] };
    const params = serializeFiltersToURL(state);
    expect(params.get('datasets')).toBeNull();
  });
});

describe('URL Serialization Roundtrip', () => {
  it('should serialize and parse back to equivalent state', () => {
    const originalState: FilterState = {
      year: 2023,
      yearFrom: null,
      yearTo: null,
      quarter: 2,
      month: null,
      timeResolution: 'quarter',
      regionCode: '091',
      regionLevel: 'kunta',
      industryCode: 'C',
      industryLevel: 'section',
      datasetId: 'tyonv_001',
      datasetIds: ['ds1', 'ds2'],
      valueLabel: 'employment',
    };

    const params = serializeFiltersToURL(originalState);
    const parsed = parseFiltersFromURL(params);

    expect(parsed.year).toBe(originalState.year);
    expect(parsed.quarter).toBe(originalState.quarter);
    expect(parsed.timeResolution).toBe(originalState.timeResolution);
    expect(parsed.regionCode).toBe(originalState.regionCode);
    expect(parsed.regionLevel).toBe(originalState.regionLevel);
    expect(parsed.industryCode).toBe(originalState.industryCode);
    expect(parsed.industryLevel).toBe(originalState.industryLevel);
    expect(parsed.datasetId).toBe(originalState.datasetId);
    expect(parsed.datasetIds).toEqual(originalState.datasetIds);
    expect(parsed.valueLabel).toBe(originalState.valueLabel);
  });
});

describe('Query Parameter Conversion', () => {
  it('should convert empty state to empty params', () => {
    const params = toQueryParams(defaultFilterState);
    expect(params).toEqual({});
  });

  it('should convert time filters', () => {
    const state = {
      ...defaultFilterState,
      year: 2023,
      quarter: 2,
      month: 6,
    };
    const params = toQueryParams(state);
    expect(params.year).toBe(2023);
    expect(params.quarter).toBe(2);
    expect(params.month).toBe(6);
  });

  it('should convert year range to snake_case', () => {
    const state = {
      ...defaultFilterState,
      yearFrom: 2020,
      yearTo: 2025,
    };
    const params = toQueryParams(state);
    expect(params.year_from).toBe(2020);
    expect(params.year_to).toBe(2025);
  });

  it('should convert region filters to snake_case', () => {
    const state = {
      ...defaultFilterState,
      regionCode: '091',
      regionLevel: 'kunta' as RegionLevel,
    };
    const params = toQueryParams(state);
    expect(params.region_code).toBe('091');
    expect(params.region_level).toBe('kunta');
  });

  it('should convert industry filters to snake_case', () => {
    const state = {
      ...defaultFilterState,
      industryCode: 'C',
      industryLevel: 'section' as IndustryLevel,
    };
    const params = toQueryParams(state);
    expect(params.industry_code).toBe('C');
    expect(params.industry_level).toBe('section');
  });

  it('should convert dataset filters to snake_case', () => {
    const state = {
      ...defaultFilterState,
      datasetId: 'tyonv_001',
      valueLabel: 'employment',
    };
    const params = toQueryParams(state);
    expect(params.dataset_id).toBe('tyonv_001');
    expect(params.value_label).toBe('employment');
  });

  it('should not include null values', () => {
    const state = {
      ...defaultFilterState,
      year: 2023,
    };
    const params = toQueryParams(state);
    expect(params.year).toBe(2023);
    expect('year_from' in params).toBe(false);
    expect('year_to' in params).toBe(false);
    expect('quarter' in params).toBe(false);
    expect('month' in params).toBe(false);
    expect('region_code' in params).toBe(false);
  });
});

describe('Active Filters Detection', () => {
  it('should return false for default state', () => {
    expect(hasActiveFilters(defaultFilterState)).toBe(false);
  });

  it('should return true when year is set', () => {
    const state = { ...defaultFilterState, year: 2023 };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when yearFrom is set', () => {
    const state = { ...defaultFilterState, yearFrom: 2020 };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when yearTo is set', () => {
    const state = { ...defaultFilterState, yearTo: 2025 };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when quarter is set', () => {
    const state = { ...defaultFilterState, quarter: 2 };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when month is set', () => {
    const state = { ...defaultFilterState, month: 6 };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when regionCode is set', () => {
    const state = { ...defaultFilterState, regionCode: '091' };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when regionLevel is set', () => {
    const state = { ...defaultFilterState, regionLevel: 'kunta' as RegionLevel };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when industryCode is set', () => {
    const state = { ...defaultFilterState, industryCode: 'A' };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when industryLevel is set', () => {
    const state = { ...defaultFilterState, industryLevel: 'section' as IndustryLevel };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when datasetId is set', () => {
    const state = { ...defaultFilterState, datasetId: 'tyonv_001' };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when datasetIds has items', () => {
    const state = { ...defaultFilterState, datasetIds: ['dataset1'] };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return true when valueLabel is set', () => {
    const state = { ...defaultFilterState, valueLabel: 'employment' };
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('should return false when only timeResolution differs from default', () => {
    // timeResolution is not considered an "active filter" since it's always set
    const state = { ...defaultFilterState, timeResolution: 'month' as TimeResolution };
    expect(hasActiveFilters(state)).toBe(false);
  });
});

describe('Filter State Immutability', () => {
  let state: FilterState;

  beforeEach(() => {
    state = { ...defaultFilterState };
  });

  it('should not mutate original state when setting year', () => {
    const originalYear = state.year;
    filterReducer(state, { type: 'SET_YEAR', payload: 2023 });
    expect(state.year).toBe(originalYear);
  });

  it('should not mutate original state when adding dataset ID', () => {
    state = { ...state, datasetIds: ['dataset1'] };
    const originalIds = [...state.datasetIds];
    filterReducer(state, { type: 'ADD_DATASET_ID', payload: 'dataset2' });
    expect(state.datasetIds).toEqual(originalIds);
  });

  it('should not mutate original state when removing dataset ID', () => {
    state = { ...state, datasetIds: ['dataset1', 'dataset2'] };
    const originalIds = [...state.datasetIds];
    filterReducer(state, { type: 'REMOVE_DATASET_ID', payload: 'dataset1' });
    expect(state.datasetIds).toEqual(originalIds);
  });

  it('should not mutate original state when setting filters', () => {
    const originalState = { ...state };
    filterReducer(state, { type: 'SET_FILTERS', payload: { year: 2023 } });
    expect(state).toEqual(originalState);
  });
});

describe('Edge Cases', () => {
  it('should handle zero year value', () => {
    const state = filterReducer(defaultFilterState, { type: 'SET_YEAR', payload: 0 });
    expect(state.year).toBe(0);
    // Zero is falsy but should still be serialized
    const params = serializeFiltersToURL(state);
    expect(params.get('year')).toBe('0');
  });

  it('should handle zero quarter value', () => {
    const params = new URLSearchParams('quarter=0');
    const filters = parseFiltersFromURL(params);
    expect(filters.quarter).toBe(0);
  });

  it('should handle special characters in valueLabel', () => {
    const state = { ...defaultFilterState, valueLabel: 'employment & wages' };
    const params = serializeFiltersToURL(state);
    expect(params.get('valueLabel')).toBe('employment & wages');
  });

  it('should handle special characters in datasetIds', () => {
    const state = { ...defaultFilterState, datasetIds: ['dataset-1', 'dataset_2'] };
    const params = serializeFiltersToURL(state);
    const parsed = parseFiltersFromURL(params);
    expect(parsed.datasetIds).toEqual(['dataset-1', 'dataset_2']);
  });

  it('should handle empty string region code', () => {
    // Empty string is falsy, should not be serialized
    const state = { ...defaultFilterState, regionCode: '' };
    const params = serializeFiltersToURL(state);
    expect(params.get('region')).toBeNull();
  });
});
