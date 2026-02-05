/**
 * Fetch Configuration Form component.
 *
 * This component provides a form interface for configuring data fetches
 * from StatFin tables. It allows users to:
 * - View selected table information
 * - Select dimensions to include in fetches
 * - Configure fetch intervals and priorities
 * - Save the configuration
 *
 * Uses the StatFin table metadata API to fetch available dimensions
 * and the fetch config mutation hooks to save configurations.
 *
 * @example
 * // Basic usage with selected table
 * <FetchConfigForm
 *   selectedTable={selectedTable}
 *   onSuccess={() => setActiveTab('configurations')}
 * />
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useStatFinTableMetadata, useCreateFetchConfig } from '../api/fetch-config';
import type { StatFinTableInfo, StatFinDimension } from '../types/api';

// =============================================================================
// Types
// =============================================================================

export interface FetchConfigFormProps {
  /** Selected StatFin table for configuration */
  selectedTable: StatFinTableInfo | null;
  /** Callback when configuration is saved successfully */
  onSuccess?: () => void;
  /** Callback to clear the selected table */
  onClear?: () => void;
}

interface FormData {
  name: string;
  description: string;
  fetchIntervalHours: number;
  priority: number;
  isActive: boolean;
  selectedDimensions: string[];
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-4)',
  },
  selectedTable: {
    padding: 'var(--spacing-3)',
    backgroundColor: 'var(--color-primary-light)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-primary)',
  },
  selectedTableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'var(--spacing-2)',
  },
  selectedTableLabel: {
    fontWeight: 600,
    color: 'var(--color-gray-700)',
    fontSize: 'var(--font-size-sm)',
  },
  selectedTableName: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
    color: 'var(--color-gray-900)',
    marginBottom: 'var(--spacing-1)',
  },
  selectedTableId: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-600)',
    fontFamily: 'monospace',
  },
  clearButton: {
    padding: 'var(--spacing-1) var(--spacing-2)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-gray-600)',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-gray-300)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  clearButtonHover: {
    backgroundColor: 'var(--color-gray-100)',
    borderColor: 'var(--color-gray-400)',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-2)',
  },
  label: {
    fontWeight: 500,
    color: 'var(--color-gray-700)',
    fontSize: 'var(--font-size-sm)',
  },
  input: {
    padding: 'var(--spacing-2) var(--spacing-3)',
    fontSize: 'var(--font-size-base)',
    border: '1px solid var(--color-gray-300)',
    borderRadius: 'var(--radius)',
    outline: 'none',
    transition: 'border-color var(--transition-fast)',
  },
  inputFocus: {
    borderColor: 'var(--color-primary)',
    boxShadow: '0 0 0 2px var(--color-primary-light)',
  },
  textarea: {
    padding: 'var(--spacing-2) var(--spacing-3)',
    fontSize: 'var(--font-size-base)',
    border: '1px solid var(--color-gray-300)',
    borderRadius: 'var(--radius)',
    outline: 'none',
    minHeight: '80px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    transition: 'border-color var(--transition-fast)',
  },
  select: {
    padding: 'var(--spacing-2) var(--spacing-3)',
    fontSize: 'var(--font-size-base)',
    border: '1px solid var(--color-gray-300)',
    borderRadius: 'var(--radius)',
    outline: 'none',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
    transition: 'border-color var(--transition-fast)',
  },
  dimensionsSection: {
    marginTop: 'var(--spacing-2)',
  },
  dimensionsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-2)',
    maxHeight: '200px',
    overflowY: 'auto' as const,
    padding: 'var(--spacing-2)',
    backgroundColor: 'var(--color-gray-50)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-200)',
  },
  dimensionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-2)',
    backgroundColor: 'var(--color-white)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-gray-200)',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  dimensionInfo: {
    flex: 1,
  },
  dimensionName: {
    fontWeight: 500,
    color: 'var(--color-gray-900)',
    fontSize: 'var(--font-size-sm)',
  },
  dimensionValues: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-gray-500)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-4)',
    color: 'var(--color-gray-500)',
    fontSize: 'var(--font-size-sm)',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid var(--color-gray-200)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginRight: 'var(--spacing-2)',
  },
  error: {
    padding: 'var(--spacing-3)',
    backgroundColor: 'var(--color-error-light)',
    borderRadius: 'var(--radius)',
    color: 'var(--color-error)',
    fontSize: 'var(--font-size-sm)',
  },
  success: {
    padding: 'var(--spacing-3)',
    backgroundColor: 'var(--color-success)',
    borderRadius: 'var(--radius)',
    color: 'white',
    fontSize: 'var(--font-size-sm)',
    textAlign: 'center' as const,
  },
  buttonGroup: {
    display: 'flex',
    gap: 'var(--spacing-3)',
    marginTop: 'var(--spacing-4)',
  },
  submitButton: {
    flex: 1,
    padding: 'var(--spacing-3)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
    color: 'white',
    backgroundColor: 'var(--color-primary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)',
  },
  submitButtonDisabled: {
    backgroundColor: 'var(--color-gray-400)',
    cursor: 'not-allowed',
  },
  submitButtonHover: {
    backgroundColor: 'var(--color-primary-dark)',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: 'var(--spacing-8)',
    color: 'var(--color-gray-500)',
  },
  emptyStateIcon: {
    fontSize: '3rem',
    marginBottom: 'var(--spacing-4)',
  },
  emptyStateText: {
    fontSize: 'var(--font-size-base)',
    marginBottom: 'var(--spacing-2)',
  },
  emptyStateHint: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-400)',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--spacing-4)',
  },
};

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Empty state when no table is selected
 */
function EmptyState() {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyStateIcon}>{'\u{1F4CA}'}</div>
      <div style={styles.emptyStateText}>No table selected</div>
      <div style={styles.emptyStateHint}>
        Browse StatFin tables and select one to configure fetching
      </div>
    </div>
  );
}

/**
 * Loading spinner for metadata
 */
function LoadingMetadata() {
  return (
    <div style={styles.loading}>
      <div style={styles.spinner} />
      <span>Loading table metadata...</span>
    </div>
  );
}

/**
 * Dimension selector component
 */
function DimensionSelector({
  dimensions,
  selectedDimensions,
  onToggle,
  disabled,
}: {
  dimensions: StatFinDimension[];
  selectedDimensions: string[];
  onToggle: (name: string) => void;
  disabled: boolean;
}) {
  if (!dimensions.length) {
    return (
      <div style={{ ...styles.loading, color: 'var(--color-gray-400)' }}>
        No dimensions available
      </div>
    );
  }

  return (
    <div style={styles.dimensionsList}>
      {dimensions.map((dim) => (
        <label key={dim.name} style={styles.dimensionItem}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={selectedDimensions.includes(dim.name)}
            onChange={() => onToggle(dim.name)}
            disabled={disabled}
          />
          <div style={styles.dimensionInfo}>
            <div style={styles.dimensionName}>{dim.text}</div>
            <div style={styles.dimensionValues}>
              {dim.values.length} values available
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * FetchConfigForm component for configuring StatFin data fetches.
 *
 * Displays a form to configure fetching of statistical data from a selected
 * StatFin table. Fetches table metadata to show available dimensions.
 */
export function FetchConfigForm({
  selectedTable,
  onSuccess,
  onClear,
}: FetchConfigFormProps) {
  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    fetchIntervalHours: 24,
    priority: 1,
    isActive: true,
    selectedDimensions: [],
  });
  const [clearButtonHovered, setClearButtonHovered] = useState(false);
  const [submitButtonHovered, setSubmitButtonHovered] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch table metadata when a table is selected
  const {
    data: metadata,
    isLoading: metadataLoading,
    isError: metadataError,
    error: metadataErrorObj,
  } = useStatFinTableMetadata(selectedTable?.table_id || '', {
    enabled: Boolean(selectedTable?.table_id && selectedTable.type !== 'folder'),
  });

  // Create configuration mutation
  const {
    mutate: createConfig,
    isPending: isCreating,
    error: createError,
  } = useCreateFetchConfig({
    onSuccess: () => {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onSuccess?.();
      }, 1500);
    },
  });

  // Update form name when table changes
  useEffect(() => {
    if (selectedTable) {
      setFormData((prev) => ({
        ...prev,
        name: selectedTable.text || prev.name,
        selectedDimensions: [],
      }));
    }
  }, [selectedTable]);

  // Select all dimensions by default when metadata loads
  useEffect(() => {
    if (metadata?.dimensions) {
      setFormData((prev) => ({
        ...prev,
        selectedDimensions: metadata.dimensions.map((d) => d.name),
      }));
    }
  }, [metadata]);

  // Handle dimension toggle
  const handleDimensionToggle = useCallback((dimensionName: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedDimensions: prev.selectedDimensions.includes(dimensionName)
        ? prev.selectedDimensions.filter((d) => d !== dimensionName)
        : [...prev.selectedDimensions, dimensionName],
    }));
  }, []);

  // Handle form field changes
  const handleInputChange = useCallback(
    (field: keyof FormData, value: string | number | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTable || !formData.name.trim()) return;

      // Generate dataset ID from table ID
      const datasetId = selectedTable.table_id
        .replace(/\.[^.]+$/, '') // Remove file extension
        .replace(/[^a-zA-Z0-9_]/g, '_') // Replace special chars
        .toLowerCase();

      createConfig({
        dataset_id: datasetId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_active: formData.isActive,
        fetch_interval_hours: formData.fetchIntervalHours,
        priority: formData.priority,
      });
    },
    [selectedTable, formData, createConfig]
  );

  // Compute if form is valid
  const isFormValid = useMemo(() => {
    return Boolean(
      selectedTable &&
        formData.name.trim() &&
        formData.fetchIntervalHours > 0 &&
        formData.priority >= 1
    );
  }, [selectedTable, formData]);

  // Render empty state if no table selected
  if (!selectedTable) {
    return (
      <div className="card">
        <h4>New Fetch Configuration</h4>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="card">
      <h4>New Fetch Configuration</h4>

      {showSuccess && (
        <div style={styles.success}>
          {'\u2713'} Configuration saved successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.container}>
        {/* Selected Table Display */}
        <div style={styles.selectedTable}>
          <div style={styles.selectedTableHeader}>
            <span style={styles.selectedTableLabel}>Selected Table</span>
            {onClear && (
              <button
                type="button"
                style={{
                  ...styles.clearButton,
                  ...(clearButtonHovered ? styles.clearButtonHover : {}),
                }}
                onClick={onClear}
                onMouseEnter={() => setClearButtonHovered(true)}
                onMouseLeave={() => setClearButtonHovered(false)}
              >
                Clear
              </button>
            )}
          </div>
          <div style={styles.selectedTableName}>{selectedTable.text}</div>
          <div style={styles.selectedTableId}>{selectedTable.table_id}</div>
        </div>

        {/* Dataset Name */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Dataset Name *</label>
          <input
            type="text"
            style={styles.input}
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Enter a descriptive name"
            required
            disabled={isCreating}
          />
        </div>

        {/* Description */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Description</label>
          <textarea
            style={styles.textarea}
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Optional description of the dataset"
            disabled={isCreating}
          />
        </div>

        {/* Dimensions Section */}
        <div style={styles.dimensionsSection}>
          <label style={styles.label}>Available Dimensions</label>
          {metadataLoading ? (
            <LoadingMetadata />
          ) : metadataError ? (
            <div style={styles.error}>
              Failed to load dimensions: {metadataErrorObj?.message || 'Unknown error'}
            </div>
          ) : (
            <DimensionSelector
              dimensions={metadata?.dimensions || []}
              selectedDimensions={formData.selectedDimensions}
              onToggle={handleDimensionToggle}
              disabled={isCreating}
            />
          )}
        </div>

        {/* Fetch Settings Row */}
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Fetch Interval</label>
            <select
              style={styles.select}
              value={formData.fetchIntervalHours}
              onChange={(e) =>
                handleInputChange('fetchIntervalHours', parseInt(e.target.value, 10))
              }
              disabled={isCreating}
            >
              <option value={1}>Every hour</option>
              <option value={6}>Every 6 hours</option>
              <option value={12}>Every 12 hours</option>
              <option value={24}>Every 24 hours</option>
              <option value={168}>Weekly</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Priority</label>
            <select
              style={styles.select}
              value={formData.priority}
              onChange={(e) =>
                handleInputChange('priority', parseInt(e.target.value, 10))
              }
              disabled={isCreating}
            >
              <option value={1}>Low (1)</option>
              <option value={5}>Normal (5)</option>
              <option value={10}>High (10)</option>
            </select>
          </div>
        </div>

        {/* Active Toggle */}
        <div style={styles.formGroup}>
          <label style={{ ...styles.dimensionItem, cursor: 'pointer' }}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={formData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
              disabled={isCreating}
            />
            <div style={styles.dimensionInfo}>
              <div style={styles.dimensionName}>Enable automatic fetching</div>
              <div style={styles.dimensionValues}>
                When enabled, data will be fetched automatically at the configured interval
              </div>
            </div>
          </label>
        </div>

        {/* Error Display */}
        {createError && (
          <div style={styles.error}>
            Failed to save configuration: {createError.message}
          </div>
        )}

        {/* Submit Button */}
        <div style={styles.buttonGroup}>
          <button
            type="submit"
            style={{
              ...styles.submitButton,
              ...(isCreating || !isFormValid ? styles.submitButtonDisabled : {}),
              ...(submitButtonHovered && !isCreating && isFormValid
                ? styles.submitButtonHover
                : {}),
            }}
            disabled={isCreating || !isFormValid}
            onMouseEnter={() => setSubmitButtonHovered(true)}
            onMouseLeave={() => setSubmitButtonHovered(false)}
          >
            {isCreating ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default FetchConfigForm;
