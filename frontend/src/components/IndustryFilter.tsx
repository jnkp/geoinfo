/**
 * Industry filter dropdown component for industry-based data filtering.
 *
 * This component provides:
 * - Industry level selector (section/division/group/class)
 * - Dropdown to select specific industry within selected level
 * - Integration with FilterContext for shared filter state
 * - Hierarchical navigation through industry classification
 *
 * Uses TOL 2008 (Toimialaluokitus 2008) Finnish industry classification.
 *
 * @example
 * // Basic usage
 * <IndustryFilter />
 *
 * // With custom label
 * <IndustryFilter label="Select Industry" />
 *
 * // Compact mode for sidebars
 * <IndustryFilter compact />
 */

import { useCallback, useMemo, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useFilterContext,
  type IndustryLevel,
} from '../context/FilterContext';
import { apiClient, buildQueryString } from '../api/client';
import type { IndustryListResponse, IndustryResponse } from '../types/api';

// =============================================================================
// Types
// =============================================================================

export interface IndustryFilterProps {
  /** Whether to show the industry level selector */
  showLevelSelector?: boolean;
  /** Whether to show the clear button */
  showClearButton?: boolean;
  /** Compact mode for sidebar display */
  compact?: boolean;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Custom label for the component */
  label?: string;
  /** Placeholder text for the dropdown */
  placeholder?: string;
}

interface LevelOption {
  value: IndustryLevel;
  label: string;
  description: string;
}

/** Parameters for listing industries */
interface IndustryListParams {
  level?: string | null;
  parent_code?: string | null;
  page?: number;
  page_size?: number;
}

// =============================================================================
// Constants
// =============================================================================

const INDUSTRY_LEVELS: LevelOption[] = [
  { value: 'section', label: 'Section', description: 'Top-level (A-U)' },
  { value: 'division', label: 'Division', description: '2-digit codes' },
  { value: 'group', label: 'Group', description: '3-digit codes' },
  { value: 'class', label: 'Class', description: '4-digit codes' },
];

const DEFAULT_PAGE_SIZE = 500;

// =============================================================================
// Query Keys
// =============================================================================

/**
 * Query key factory for industry queries.
 */
const industriesKeys = {
  all: ['industries'] as const,
  lists: () => [...industriesKeys.all, 'list'] as const,
  list: (params: IndustryListParams) => [...industriesKeys.lists(), params] as const,
};

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--spacing-2)',
  },
  label: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    color: 'var(--color-gray-700)',
  },
  levelToggle: {
    display: 'flex',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    overflow: 'hidden',
  },
  levelButton: {
    padding: 'var(--spacing-1) var(--spacing-2)',
    fontSize: 'var(--font-size-xs)',
    border: 'none',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  levelButtonActive: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-white)',
  },
  selectContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-2)',
  },
  select: {
    width: '100%',
    padding: 'var(--spacing-2)',
    fontSize: 'var(--font-size-sm)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
  },
  selectDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  selectedInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--spacing-2)',
    backgroundColor: 'var(--color-gray-50)',
    borderRadius: 'var(--radius)',
    fontSize: 'var(--font-size-sm)',
  },
  selectedCode: {
    fontWeight: 600,
    color: 'var(--color-primary)',
  },
  selectedName: {
    color: 'var(--color-gray-600)',
    marginLeft: 'var(--spacing-2)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  clearButton: {
    padding: 'var(--spacing-1) var(--spacing-2)',
    fontSize: 'var(--font-size-xs)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  loadingText: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-500)',
    fontStyle: 'italic' as const,
  },
  errorText: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-error)',
  },
  compact: {
    container: {
      gap: 'var(--spacing-2)',
    },
    select: {
      padding: 'var(--spacing-1) var(--spacing-2)',
      fontSize: 'var(--font-size-xs)',
    },
  },
};

// =============================================================================
// Component
// =============================================================================

/**
 * IndustryFilter component for selecting industries by TOL 2008 classification.
 *
 * Supports filtering by industry level and selecting specific industries
 * within the selected level. Integrates with FilterContext for state management.
 */
export function IndustryFilter({
  showLevelSelector = true,
  showClearButton = true,
  compact = false,
  disabled = false,
  label = 'Industry',
  placeholder = 'All Industries',
}: IndustryFilterProps) {
  const {
    filters,
    setIndustryCode,
    setIndustryLevel,
    setIndustry,
    resetIndustryFilters,
  } = useFilterContext();

  const { industryCode, industryLevel } = filters;

  // Fetch industries based on selected level
  const queryParams: IndustryListParams = useMemo(
    () => ({
      level: industryLevel,
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [industryLevel]
  );

  const {
    data: industriesData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: industriesKeys.list(queryParams),
    queryFn: async () => {
      const queryString = buildQueryString(
        queryParams as Record<string, string | number | null | undefined>
      );
      return apiClient.get<IndustryListResponse>(`/industries${queryString}`);
    },
    enabled: industryLevel !== null,
  });

  // Get selected industry details
  const selectedIndustry = useMemo((): IndustryResponse | null => {
    if (!industryCode || !industriesData?.items) return null;
    return industriesData.items.find((i) => i.code === industryCode) ?? null;
  }, [industryCode, industriesData?.items]);

  // Handle level change
  const handleLevelChange = useCallback(
    (newLevel: IndustryLevel) => {
      if (disabled) return;
      // When changing level, clear the current industry code
      setIndustry(null, newLevel);
    },
    [disabled, setIndustry]
  );

  // Handle industry selection change
  const handleIndustryChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      if (disabled) return;
      const value = e.target.value || null;
      setIndustryCode(value);
    },
    [disabled, setIndustryCode]
  );

  // Handle clear selection
  const handleClear = useCallback(() => {
    if (disabled) return;
    resetIndustryFilters();
  }, [disabled, resetIndustryFilters]);

  // Compute styles based on compact mode
  const containerStyle = compact
    ? { ...styles.container, ...styles.compact.container }
    : styles.container;
  const selectStyle = compact
    ? { ...styles.select, ...styles.compact.select }
    : styles.select;

  return (
    <div style={containerStyle}>
      {/* Header with label and level selector */}
      <div style={styles.header}>
        <span style={styles.label}>{label}</span>
        {showLevelSelector && (
          <div style={styles.levelToggle}>
            {INDUSTRY_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                style={{
                  ...styles.levelButton,
                  ...(industryLevel === level.value
                    ? styles.levelButtonActive
                    : {}),
                }}
                onClick={() => handleLevelChange(level.value)}
                disabled={disabled}
                title={level.description}
              >
                {level.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Industry dropdown */}
      <div style={styles.selectContainer}>
        {industryLevel === null ? (
          <div style={styles.loadingText}>
            Select an industry level to see options
          </div>
        ) : isLoading ? (
          <div style={styles.loadingText}>Loading industries...</div>
        ) : isError ? (
          <div style={styles.errorText}>Failed to load industries</div>
        ) : (
          <select
            style={{
              ...selectStyle,
              ...(disabled ? styles.selectDisabled : {}),
            }}
            value={industryCode ?? ''}
            onChange={handleIndustryChange}
            disabled={disabled || isLoading}
            aria-label="Select industry"
          >
            <option value="">{placeholder}</option>
            {industriesData?.items.map((industry) => (
              <option key={industry.code} value={industry.code}>
                {industry.code} - {industry.name_fi}
              </option>
            ))}
          </select>
        )}

        {/* Selected industry info */}
        {selectedIndustry && (
          <div style={styles.selectedInfo}>
            <span>
              <span style={styles.selectedCode}>{selectedIndustry.code}</span>
              <span style={styles.selectedName}>{selectedIndustry.name_fi}</span>
            </span>
            {showClearButton && (
              <button
                type="button"
                style={styles.clearButton}
                onClick={handleClear}
                disabled={disabled}
                aria-label="Clear selection"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default IndustryFilter;
