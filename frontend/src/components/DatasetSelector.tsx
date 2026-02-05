/**
 * Dataset selector component for comparing multiple statistics datasets.
 *
 * This component provides:
 * - Multi-select checkbox interface for datasets
 * - Color coding for selected datasets
 * - Loading and error states
 * - Clear selection functionality
 *
 * Used in Dashboard to enable comparing data from multiple datasets.
 *
 * @example
 * // Basic usage
 * <DatasetSelector
 *   selectedIds={['dataset1', 'dataset2']}
 *   onChange={handleSelectionChange}
 * />
 *
 * // With maximum selection limit
 * <DatasetSelector
 *   selectedIds={selectedDatasets}
 *   onChange={setSelectedDatasets}
 *   maxSelections={3}
 * />
 */

import { useCallback, useMemo } from 'react';
import { useDatasets } from '../api';
import type { DatasetResponse } from '../types/api';

// =============================================================================
// Types
// =============================================================================

export interface DatasetSelectorProps {
  /** Currently selected dataset IDs */
  selectedIds: string[];
  /** Callback when selection changes */
  onChange: (selectedIds: string[]) => void;
  /** Maximum number of datasets that can be selected (default: 5) */
  maxSelections?: number;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Compact mode for smaller containers */
  compact?: boolean;
  /** Custom title */
  title?: string;
  /** Whether to show the clear all button */
  showClearAll?: boolean;
}

export interface DatasetColorMap {
  [datasetId: string]: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Colors for dataset series in charts */
export const DATASET_COLORS = [
  'var(--color-primary, #2563eb)',
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

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
  },
  title: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-gray-700)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  clearButton: {
    padding: 'var(--spacing-1) var(--spacing-2)',
    fontSize: 'var(--font-size-xs)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    color: 'var(--color-gray-600)',
  },
  clearButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  datasetList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-2)',
    maxHeight: '200px',
    overflowY: 'auto' as const,
  },
  datasetItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-2)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-200)',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  datasetItemSelected: {
    borderColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-primary-50, #eff6ff)',
  },
  datasetItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
    accentColor: 'var(--color-primary)',
  },
  colorIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  datasetInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  datasetName: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    color: 'var(--color-gray-800)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  datasetMeta: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-gray-500)',
    display: 'flex',
    gap: 'var(--spacing-2)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 var(--spacing-1)',
    fontSize: 'var(--font-size-xs)',
    backgroundColor: 'var(--color-gray-100)',
    borderRadius: 'var(--radius-sm, 2px)',
    textTransform: 'capitalize' as const,
  },
  loadingText: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-500)',
    fontStyle: 'italic' as const,
    padding: 'var(--spacing-2)',
  },
  errorText: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-error)',
    padding: 'var(--spacing-2)',
  },
  emptyText: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-400)',
    fontStyle: 'italic' as const,
    padding: 'var(--spacing-2)',
    textAlign: 'center' as const,
  },
  selectionCount: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-gray-500)',
    marginLeft: 'auto',
  },
  compact: {
    datasetList: {
      maxHeight: '150px',
    },
    datasetItem: {
      padding: 'var(--spacing-1) var(--spacing-2)',
    },
    datasetName: {
      fontSize: 'var(--font-size-xs)',
    },
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets the color for a dataset based on its selection order.
 */
export function getDatasetColor(
  datasetId: string,
  selectedIds: string[]
): string {
  const index = selectedIds.indexOf(datasetId);
  if (index === -1) return DATASET_COLORS[0];
  return DATASET_COLORS[index % DATASET_COLORS.length];
}

/**
 * Creates a color map for all selected datasets.
 */
export function createDatasetColorMap(selectedIds: string[]): DatasetColorMap {
  const map: DatasetColorMap = {};
  selectedIds.forEach((id, index) => {
    map[id] = DATASET_COLORS[index % DATASET_COLORS.length];
  });
  return map;
}

// =============================================================================
// Component
// =============================================================================

/**
 * DatasetSelector component for selecting multiple datasets to compare.
 *
 * Fetches available datasets and renders them as a selectable list with
 * checkboxes. Each selected dataset gets assigned a unique color for
 * chart visualization.
 */
export function DatasetSelector({
  selectedIds,
  onChange,
  maxSelections = 5,
  disabled = false,
  compact = false,
  title = 'Compare Datasets',
  showClearAll = true,
}: DatasetSelectorProps) {
  // Fetch available datasets
  const {
    data: datasetsResponse,
    isLoading,
    isError,
  } = useDatasets({
    page: 1,
    page_size: 100,
  });

  const datasets = datasetsResponse?.items ?? [];

  // Handle dataset selection toggle
  const handleToggle = useCallback(
    (datasetId: string) => {
      if (disabled) return;

      const isSelected = selectedIds.includes(datasetId);

      if (isSelected) {
        // Remove from selection
        onChange(selectedIds.filter((id) => id !== datasetId));
      } else {
        // Add to selection (if under max)
        if (selectedIds.length < maxSelections) {
          onChange([...selectedIds, datasetId]);
        }
      }
    },
    [disabled, selectedIds, maxSelections, onChange]
  );

  // Handle clear all
  const handleClearAll = useCallback(() => {
    if (disabled) return;
    onChange([]);
  }, [disabled, onChange]);

  // Check if a dataset can be selected
  const canSelect = useCallback(
    (datasetId: string): boolean => {
      if (disabled) return false;
      if (selectedIds.includes(datasetId)) return true;
      return selectedIds.length < maxSelections;
    },
    [disabled, selectedIds, maxSelections]
  );

  // Compute styles based on compact mode
  const datasetListStyle = compact
    ? { ...styles.datasetList, ...styles.compact.datasetList }
    : styles.datasetList;

  // Render loading state
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>{title}</span>
        </div>
        <div style={styles.loadingText}>Loading datasets...</div>
      </div>
    );
  }

  // Render error state
  if (isError) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>{title}</span>
        </div>
        <div style={styles.errorText}>Failed to load datasets</div>
      </div>
    );
  }

  // Render empty state
  if (datasets.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>{title}</span>
        </div>
        <div style={styles.emptyText}>No datasets available</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        <span style={styles.selectionCount}>
          {selectedIds.length}/{maxSelections}
        </span>
        {showClearAll && selectedIds.length > 0 && (
          <button
            type="button"
            style={{
              ...styles.clearButton,
              ...(disabled ? styles.clearButtonDisabled : {}),
            }}
            onClick={handleClearAll}
            disabled={disabled}
            aria-label="Clear selection"
          >
            Clear
          </button>
        )}
      </div>

      {/* Dataset List */}
      <div style={datasetListStyle}>
        {datasets.map((dataset) => {
          const isSelected = selectedIds.includes(dataset.id);
          const isDisabled = !canSelect(dataset.id);
          const color = isSelected ? getDatasetColor(dataset.id, selectedIds) : undefined;

          return (
            <DatasetItem
              key={dataset.id}
              dataset={dataset}
              isSelected={isSelected}
              isDisabled={isDisabled}
              color={color}
              compact={compact}
              onClick={() => handleToggle(dataset.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Dataset Item Component
// =============================================================================

interface DatasetItemProps {
  dataset: DatasetResponse;
  isSelected: boolean;
  isDisabled: boolean;
  color?: string;
  compact?: boolean;
  onClick: () => void;
}

/**
 * Individual dataset item with checkbox and color indicator.
 */
function DatasetItem({
  dataset,
  isSelected,
  isDisabled,
  color,
  compact = false,
  onClick,
}: DatasetItemProps) {
  const itemStyle = useMemo(() => ({
    ...styles.datasetItem,
    ...(compact ? styles.compact.datasetItem : {}),
    ...(isSelected ? styles.datasetItemSelected : {}),
    ...(isDisabled && !isSelected ? styles.datasetItemDisabled : {}),
  }), [compact, isSelected, isDisabled]);

  const nameStyle = compact
    ? { ...styles.datasetName, ...styles.compact.datasetName }
    : styles.datasetName;

  const displayName = dataset.name_fi || dataset.name_en || dataset.id;

  return (
    <div
      style={itemStyle}
      onClick={onClick}
      role="checkbox"
      aria-checked={isSelected}
      aria-disabled={isDisabled && !isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => {}} // Handled by parent click
        disabled={isDisabled && !isSelected}
        style={styles.checkbox}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Color indicator for selected items */}
      {isSelected && color && (
        <div
          style={{
            ...styles.colorIndicator,
            backgroundColor: color,
          }}
          aria-hidden="true"
        />
      )}

      {/* Dataset info */}
      <div style={styles.datasetInfo}>
        <div style={nameStyle} title={displayName}>
          {displayName}
        </div>
        {!compact && (
          <div style={styles.datasetMeta}>
            <span style={styles.badge}>{dataset.time_resolution}</span>
            {dataset.has_region_dimension && (
              <span style={styles.badge}>Regions</span>
            )}
            {dataset.has_industry_dimension && (
              <span style={styles.badge}>Industries</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DatasetSelector;
