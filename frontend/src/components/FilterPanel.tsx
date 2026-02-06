/**
 * Combined filter panel component for unified data filtering.
 *
 * This component provides:
 * - Time filters (year, quarter, month, year range)
 * - Region filters (maakunta, seutukunta, kunta)
 * - Industry filters (TOL 2008 classification)
 * - Filter summary and reset functionality
 * - Collapsible sections for compact display
 *
 * Integrates with FilterContext for shared filter state.
 *
 * @example
 * // Basic usage
 * <FilterPanel />
 *
 * // With specific sections shown/hidden
 * <FilterPanel showTimeFilter showIndustryFilter showRegionFilter />
 *
 * // Compact mode for sidebars
 * <FilterPanel compact />
 */

import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useFilterContext,
  type RegionLevel,
} from '../context/FilterContext';
import { TimeSlider } from './TimeSlider';
import { IndustryFilter } from './IndustryFilter';
import { apiClient, buildQueryString } from '../api/client';
import type { RegionListResponse } from '../types/api';

// =============================================================================
// Types
// =============================================================================

export interface FilterPanelProps {
  /** Whether to show the time filter section */
  showTimeFilter?: boolean;
  /** Whether to show the region filter section */
  showRegionFilter?: boolean;
  /** Whether to show the industry filter section */
  showIndustryFilter?: boolean;
  /** Whether to show the filter summary */
  showSummary?: boolean;
  /** Whether to show the clear all button */
  showClearAll?: boolean;
  /** Compact mode for sidebar display */
  compact?: boolean;
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Custom title for the panel */
  title?: string;
  /** Whether sections are collapsible */
  collapsible?: boolean;
  /** Default collapsed state for sections */
  defaultCollapsed?: boolean;
}

interface SectionProps {
  title: string;
  collapsible: boolean;
  defaultCollapsed: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}

interface RegionLevelOption {
  value: RegionLevel;
  label: string;
  description: string;
}

/** Parameters for listing regions */
interface RegionListParams {
  level?: string | null;
  page?: number;
  page_size?: number;
}

// =============================================================================
// Constants
// =============================================================================

const REGION_LEVELS: RegionLevelOption[] = [
  { value: 'maakunta', label: 'Maakunta', description: 'Region level' },
  { value: 'seutukunta', label: 'Seutukunta', description: 'Sub-region level' },
  { value: 'kunta', label: 'Kunta', description: 'Municipality level' },
];

const DEFAULT_PAGE_SIZE = 500;

// =============================================================================
// Query Keys
// =============================================================================

/**
 * Query key factory for region queries.
 */
const regionsKeys = {
  all: ['regions'] as const,
  lists: () => [...regionsKeys.all, 'list'] as const,
  list: (params: RegionListParams) => [...regionsKeys.lists(), params] as const,
};

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-4)',
    padding: 'var(--spacing-4)',
    backgroundColor: 'var(--color-white)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-gray-200)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 'var(--spacing-3)',
    borderBottom: '1px solid var(--color-gray-200)',
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--color-gray-900)',
    margin: 0,
  },
  clearAllButton: {
    padding: 'var(--spacing-1) var(--spacing-3)',
    fontSize: 'var(--font-size-sm)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    color: 'var(--color-gray-600)',
  },
  clearAllButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  sections: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-4)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-3)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  sectionTitle: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-gray-700)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  sectionToggle: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-400)',
    transition: 'transform var(--transition-fast)',
  },
  sectionToggleExpanded: {
    transform: 'rotate(180deg)',
  },
  sectionContent: {
    paddingLeft: 'var(--spacing-1)',
  },
  sectionDivider: {
    borderTop: '1px solid var(--color-gray-100)',
    margin: '0',
  },
  regionFilter: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-3)',
  },
  regionHeader: {
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
  summary: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-3)',
    backgroundColor: 'var(--color-gray-50)',
    borderRadius: 'var(--radius)',
    fontSize: 'var(--font-size-sm)',
  },
  summaryTitle: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    color: 'var(--color-gray-500)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 'var(--spacing-1)',
  },
  summaryItems: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 'var(--spacing-2)',
  },
  summaryItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-1)',
    padding: 'var(--spacing-1) var(--spacing-2)',
    backgroundColor: 'var(--color-primary-light)',
    color: 'var(--color-primary-dark)',
    borderRadius: 'var(--radius)',
    fontSize: 'var(--font-size-xs)',
  },
  summaryItemLabel: {
    fontWeight: 500,
  },
  summaryItemValue: {
    fontWeight: 400,
  },
  summaryEmpty: {
    color: 'var(--color-gray-400)',
    fontStyle: 'italic' as const,
  },
  compact: {
    container: {
      padding: 'var(--spacing-3)',
      gap: 'var(--spacing-3)',
    },
    sections: {
      gap: 'var(--spacing-3)',
    },
  },
};

// =============================================================================
// Section Component
// =============================================================================

/**
 * Collapsible section component for filter groups.
 */
function Section({
  title,
  collapsible,
  defaultCollapsed,
  children,
  disabled = false,
}: SectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleToggle = useCallback(() => {
    if (collapsible && !disabled) {
      setIsCollapsed((prev) => !prev);
    }
  }, [collapsible, disabled]);

  return (
    <div style={styles.section}>
      <div
        style={{
          ...styles.sectionHeader,
          cursor: collapsible && !disabled ? 'pointer' : 'default',
        }}
        onClick={handleToggle}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? !isCollapsed : undefined}
      >
        <span style={styles.sectionTitle}>{title}</span>
        {collapsible && (
          <span
            style={{
              ...styles.sectionToggle,
              ...(!isCollapsed ? styles.sectionToggleExpanded : {}),
            }}
          >
            ▼
          </span>
        )}
      </div>
      {!isCollapsed && <div style={styles.sectionContent}>{children}</div>}
    </div>
  );
}

// =============================================================================
// Region Filter Section
// =============================================================================

interface RegionFilterSectionProps {
  compact?: boolean;
  disabled?: boolean;
}

/**
 * Region filter section component.
 */
function RegionFilterSection({ compact = false, disabled = false }: RegionFilterSectionProps) {
  const {
    filters,
    setRegionCode,
    setRegionLevel,
    setRegion,
    resetGeographicFilters,
  } = useFilterContext();

  const { regionCode, regionLevel } = filters;

  // Fetch regions based on selected level
  const queryParams: RegionListParams = useMemo(
    () => ({
      level: regionLevel,
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [regionLevel]
  );

  const {
    data: regionsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: regionsKeys.list(queryParams),
    queryFn: async () => {
      const queryString = buildQueryString(
        queryParams as Record<string, string | number | null | undefined>
      );
      return apiClient.get<RegionListResponse>(`/regions${queryString}`);
    },
    enabled: regionLevel !== null,
  });

  // Get selected region details
  const selectedRegion = useMemo(() => {
    if (!regionCode || !regionsData?.items) return null;
    return regionsData.items.find((r) => r.code === regionCode) ?? null;
  }, [regionCode, regionsData?.items]);

  // Handle level change
  const handleLevelChange = useCallback(
    (newLevel: RegionLevel) => {
      if (disabled) return;
      // When changing level, clear the current region code
      setRegion(null, newLevel);
    },
    [disabled, setRegion]
  );

  // Handle region selection change
  const handleRegionChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      if (disabled) return;
      const value = e.target.value || null;
      setRegionCode(value);
    },
    [disabled, setRegionCode]
  );

  // Handle clear selection
  const handleClear = useCallback(() => {
    if (disabled) return;
    resetGeographicFilters();
  }, [disabled, resetGeographicFilters]);

  // Compute styles based on compact mode
  const selectStyle = compact
    ? { ...styles.select, padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }
    : styles.select;

  return (
    <div style={styles.regionFilter}>
      {/* Header with label and level selector */}
      <div style={styles.regionHeader}>
        <span style={styles.label}>Region</span>
        <div style={styles.levelToggle}>
          {REGION_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              style={{
                ...styles.levelButton,
                ...(regionLevel === level.value ? styles.levelButtonActive : {}),
              }}
              onClick={() => handleLevelChange(level.value)}
              disabled={disabled}
              title={level.description}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      {/* Region dropdown */}
      <div style={styles.selectContainer}>
        {regionLevel === null ? (
          <div style={styles.loadingText}>
            Select a region level to see options
          </div>
        ) : isLoading ? (
          <div style={styles.loadingText}>Loading regions...</div>
        ) : isError ? (
          <div style={styles.errorText}>Failed to load regions</div>
        ) : (
          <select
            style={{
              ...selectStyle,
              ...(disabled ? styles.selectDisabled : {}),
            }}
            value={regionCode ?? ''}
            onChange={handleRegionChange}
            disabled={disabled || isLoading}
            aria-label="Select region"
          >
            <option value="">All Regions</option>
            {regionsData?.items.map((region) => (
              <option key={region.code} value={region.code}>
                {region.code} - {region.name_fi}
              </option>
            ))}
          </select>
        )}

        {/* Selected region info */}
        {selectedRegion && (
          <div style={styles.selectedInfo}>
            <span>
              <span style={styles.selectedCode}>{selectedRegion.code}</span>
              <span style={styles.selectedName}>{selectedRegion.name_fi}</span>
            </span>
            <button
              type="button"
              style={styles.clearButton}
              onClick={handleClear}
              disabled={disabled}
              aria-label="Clear selection"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Filter Summary Component
// =============================================================================

/**
 * Filter summary showing active filters.
 */
function FilterSummary() {
  const { filters, hasActiveFilters } = useFilterContext();

  const activeFilters = useMemo(() => {
    const items: { label: string; value: string }[] = [];

    // Time filters
    if (filters.year !== null) {
      items.push({ label: 'Year', value: filters.year.toString() });
    }
    if (filters.yearFrom !== null && filters.yearTo !== null) {
      items.push({ label: 'Years', value: `${filters.yearFrom} - ${filters.yearTo}` });
    } else if (filters.yearFrom !== null) {
      items.push({ label: 'From', value: filters.yearFrom.toString() });
    } else if (filters.yearTo !== null) {
      items.push({ label: 'To', value: filters.yearTo.toString() });
    }
    if (filters.quarter !== null) {
      items.push({ label: 'Quarter', value: `Q${filters.quarter}` });
    }
    if (filters.month !== null) {
      items.push({ label: 'Month', value: filters.month.toString() });
    }

    // Region filters
    if (filters.regionCode) {
      items.push({ label: 'Region', value: filters.regionCode });
    }
    if (filters.regionLevel) {
      items.push({ label: 'Level', value: filters.regionLevel });
    }

    // Industry filters
    if (filters.industryCode) {
      items.push({ label: 'Industry', value: filters.industryCode });
    }
    if (filters.industryLevel) {
      items.push({ label: 'TOL Level', value: filters.industryLevel });
    }

    // Dataset filters
    if (filters.datasetId) {
      items.push({ label: 'Dataset', value: filters.datasetId });
    }
    if (filters.valueLabel) {
      items.push({ label: 'Value', value: filters.valueLabel });
    }

    return items;
  }, [filters]);

  if (!hasActiveFilters) {
    return (
      <div style={styles.summary}>
        <div style={styles.summaryTitle}>Active Filters</div>
        <div style={styles.summaryEmpty}>No filters applied</div>
      </div>
    );
  }

  return (
    <div style={styles.summary}>
      <div style={styles.summaryTitle}>Active Filters</div>
      <div style={styles.summaryItems}>
        {activeFilters.map((filter, index) => (
          <span key={`${filter.label}-${index}`} style={styles.summaryItem}>
            <span style={styles.summaryItemLabel}>{filter.label}:</span>
            <span style={styles.summaryItemValue}>{filter.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * FilterPanel component combining all filter controls.
 *
 * Provides a unified interface for time, region, and industry filtering
 * with optional summary display and reset functionality.
 */
export function FilterPanel({
  showTimeFilter = true,
  showRegionFilter = true,
  showIndustryFilter = true,
  showSummary = true,
  showClearAll = true,
  compact = false,
  disabled = false,
  title = 'Filters',
  collapsible = false,
  defaultCollapsed = false,
}: FilterPanelProps) {
  const { resetFilters, hasActiveFilters } = useFilterContext();

  // Handle clear all filters
  const handleClearAll = useCallback(() => {
    if (disabled) return;
    resetFilters();
  }, [disabled, resetFilters]);

  // Compute styles based on compact mode
  const containerStyle = compact
    ? { ...styles.container, ...styles.compact.container }
    : styles.container;
  const sectionsStyle = compact
    ? { ...styles.sections, ...styles.compact.sections }
    : styles.sections;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>{title}</h3>
        {showClearAll && (
          <button
            type="button"
            style={{
              ...styles.clearAllButton,
              ...(!hasActiveFilters || disabled ? styles.clearAllButtonDisabled : {}),
            }}
            onClick={handleClearAll}
            disabled={!hasActiveFilters || disabled}
            aria-label="Clear all filters"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Filter Sections */}
      <div style={sectionsStyle}>
        {/* Time Filter Section */}
        {showTimeFilter && (
          <>
            <Section
              title="Time"
              collapsible={collapsible}
              defaultCollapsed={defaultCollapsed}
              disabled={disabled}
            >
              <TimeSlider
                compact={compact}
                disabled={disabled}
                showResolutionSelector={true}
                showRangeMode={true}
                showNavigation={true}
              />
            </Section>
            {(showRegionFilter || showIndustryFilter) && (
              <hr style={styles.sectionDivider} />
            )}
          </>
        )}

        {/* Region Filter Section */}
        {showRegionFilter && (
          <>
            <Section
              title="Geography"
              collapsible={collapsible}
              defaultCollapsed={defaultCollapsed}
              disabled={disabled}
            >
              <RegionFilterSection compact={compact} disabled={disabled} />
            </Section>
            {showIndustryFilter && <hr style={styles.sectionDivider} />}
          </>
        )}

        {/* Industry Filter Section */}
        {showIndustryFilter && (
          <Section
            title="Industry"
            collapsible={collapsible}
            defaultCollapsed={defaultCollapsed}
            disabled={disabled}
          >
            <IndustryFilter
              compact={compact}
              disabled={disabled}
              showLevelSelector={true}
              showClearButton={true}
            />
          </Section>
        )}
      </div>

      {/* Filter Summary */}
      {showSummary && <FilterSummary />}
    </div>
  );
}

export default FilterPanel;
