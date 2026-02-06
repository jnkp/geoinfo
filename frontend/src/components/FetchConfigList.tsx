/**
 * Fetch Configuration List component.
 *
 * This component displays a list of saved fetch configurations with:
 * - Configuration name and description
 * - Active/inactive status indicators
 * - Last fetch status (success, failed, pending)
 * - Next scheduled fetch time
 * - Action buttons for editing and triggering fetches
 *
 * Uses the useFetchConfigs hook to fetch configuration data.
 *
 * @example
 * // Basic usage
 * <FetchConfigList onAddNew={() => setActiveTab('add')} />
 */

import { useState, useCallback } from 'react';
import { useFetchConfigs, useUpdateFetchConfig, useDeleteFetchConfig } from '../api/fetch-config';
import type { FetchConfigResponse } from '../types/api';

// =============================================================================
// Types
// =============================================================================

export interface FetchConfigListProps {
  /** Callback when user clicks "Add Configuration" */
  onAddNew?: () => void;
  /** Callback when user wants to edit a configuration */
  onEdit?: (config: FetchConfigResponse) => void;
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--spacing-2)',
  },
  title: {
    marginBottom: 0,
  },
  addButton: {
    padding: 'var(--spacing-2) var(--spacing-4)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    color: 'white',
    backgroundColor: 'var(--color-primary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)',
  },
  addButtonHover: {
    backgroundColor: 'var(--color-primary-dark)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  tableHeader: {
    textAlign: 'left' as const,
    padding: 'var(--spacing-3)',
    borderBottom: '2px solid var(--color-gray-200)',
    fontWeight: 600,
    color: 'var(--color-gray-700)',
    fontSize: 'var(--font-size-sm)',
  },
  tableHeaderCenter: {
    textAlign: 'center' as const,
    padding: 'var(--spacing-3)',
    borderBottom: '2px solid var(--color-gray-200)',
    fontWeight: 600,
    color: 'var(--color-gray-700)',
    fontSize: 'var(--font-size-sm)',
  },
  tableHeaderRight: {
    textAlign: 'right' as const,
    padding: 'var(--spacing-3)',
    borderBottom: '2px solid var(--color-gray-200)',
    fontWeight: 600,
    color: 'var(--color-gray-700)',
    fontSize: 'var(--font-size-sm)',
  },
  tableRow: {
    borderBottom: '1px solid var(--color-gray-100)',
    transition: 'background-color var(--transition-fast)',
  },
  tableRowHover: {
    backgroundColor: 'var(--color-gray-50)',
  },
  tableCell: {
    padding: 'var(--spacing-3)',
    verticalAlign: 'middle' as const,
  },
  tableCellCenter: {
    padding: 'var(--spacing-3)',
    verticalAlign: 'middle' as const,
    textAlign: 'center' as const,
  },
  tableCellRight: {
    padding: 'var(--spacing-3)',
    verticalAlign: 'middle' as const,
    textAlign: 'right' as const,
  },
  configName: {
    fontWeight: 500,
    color: 'var(--color-gray-900)',
    marginBottom: 'var(--spacing-1)',
  },
  configDescription: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-500)',
  },
  datasetId: {
    fontFamily: 'monospace',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-600)',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-1)',
    padding: 'var(--spacing-1) var(--spacing-2)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 500,
  },
  statusActive: {
    backgroundColor: 'var(--color-success)',
    color: 'white',
  },
  statusInactive: {
    backgroundColor: 'var(--color-gray-300)',
    color: 'var(--color-gray-700)',
  },
  statusSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    color: 'var(--color-success)',
    border: '1px solid var(--color-success)',
  },
  statusFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--color-error)',
    border: '1px solid var(--color-error)',
  },
  statusPending: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    color: 'var(--color-warning)',
    border: '1px solid var(--color-warning)',
  },
  statusNever: {
    backgroundColor: 'var(--color-gray-100)',
    color: 'var(--color-gray-500)',
    border: '1px solid var(--color-gray-300)',
  },
  fetchInfo: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-gray-600)',
  },
  fetchCount: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-gray-400)',
    marginTop: 'var(--spacing-1)',
  },
  actionButton: {
    padding: 'var(--spacing-1) var(--spacing-2)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 500,
    border: '1px solid var(--color-gray-300)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    marginLeft: 'var(--spacing-2)',
  },
  actionButtonHover: {
    backgroundColor: 'var(--color-gray-100)',
    borderColor: 'var(--color-gray-400)',
  },
  actionButtonDanger: {
    color: 'var(--color-error)',
    borderColor: 'var(--color-error)',
  },
  actionButtonDangerHover: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  toggleButton: {
    padding: 'var(--spacing-1) var(--spacing-2)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 500,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    marginLeft: 'var(--spacing-2)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-8)',
    color: 'var(--color-gray-500)',
    fontSize: 'var(--font-size-sm)',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid var(--color-gray-200)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginRight: 'var(--spacing-3)',
  },
  error: {
    padding: 'var(--spacing-4)',
    backgroundColor: 'var(--color-error-light)',
    borderRadius: 'var(--radius)',
    color: 'var(--color-error)',
  },
  errorTitle: {
    fontWeight: 600,
    marginBottom: 'var(--spacing-2)',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: 'var(--spacing-8)',
  },
  emptyStateIcon: {
    fontSize: '3rem',
    marginBottom: 'var(--spacing-4)',
  },
  emptyStateTitle: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--color-gray-700)',
    marginBottom: 'var(--spacing-2)',
  },
  emptyStateText: {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-gray-500)',
    marginBottom: 'var(--spacing-4)',
  },
};

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Status badge component for displaying active/inactive state
 */
function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(isActive ? styles.statusActive : styles.statusInactive),
      }}
    >
      <span>{isActive ? '\u2713' : '\u2715'}</span>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

/**
 * Status badge for fetch status (success, failed, pending, never)
 */
function FetchStatusBadge({ status }: { status: string }) {
  const getStatusStyle = () => {
    switch (status.toLowerCase()) {
      case 'success':
        return styles.statusSuccess;
      case 'failed':
        return styles.statusFailed;
      case 'pending':
        return styles.statusPending;
      default:
        return styles.statusNever;
    }
  };

  const getStatusLabel = () => {
    switch (status.toLowerCase()) {
      case 'success':
        return '\u2713 Success';
      case 'failed':
        return '\u2717 Failed';
      case 'pending':
        return '\u23F3 Pending';
      default:
        return '\u2014 Never';
    }
  };

  return (
    <span style={{ ...styles.statusBadge, ...getStatusStyle() }}>
      {getStatusLabel()}
    </span>
  );
}

/**
 * Format a date string for display
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return '\u2014';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('fi-FI', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format relative time for next fetch
 */
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '\u2014';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Overdue';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
  } catch {
    return dateString;
  }
}

/**
 * Empty state when no configurations exist
 */
function EmptyState({ onAddNew }: { onAddNew?: () => void }) {
  const [buttonHovered, setButtonHovered] = useState(false);

  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyStateIcon}>{'\u{1F4ED}'}</div>
      <div style={styles.emptyStateTitle}>No Configurations Yet</div>
      <div style={styles.emptyStateText}>
        Add a new fetch configuration to start collecting data from StatFin.
      </div>
      {onAddNew && (
        <button
          style={{
            ...styles.addButton,
            ...(buttonHovered ? styles.addButtonHover : {}),
          }}
          onClick={onAddNew}
          onMouseEnter={() => setButtonHovered(true)}
          onMouseLeave={() => setButtonHovered(false)}
        >
          + Add Configuration
        </button>
      )}
    </div>
  );
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <div style={styles.loading}>
      <div style={styles.spinner} />
      <span>Loading configurations...</span>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({ message }: { message: string }) {
  return (
    <div style={styles.error}>
      <div style={styles.errorTitle}>Failed to load configurations</div>
      <p>{message}</p>
    </div>
  );
}

// =============================================================================
// Configuration Row Component
// =============================================================================

interface ConfigRowProps {
  config: FetchConfigResponse;
  onEdit?: (config: FetchConfigResponse) => void;
  onToggle: (config: FetchConfigResponse) => void;
  onDelete: (config: FetchConfigResponse) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

function ConfigRow({
  config,
  onEdit,
  onToggle,
  onDelete,
  isUpdating,
  isDeleting,
}: ConfigRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editHovered, setEditHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);

  return (
    <tr
      style={{
        ...styles.tableRow,
        ...(isHovered ? styles.tableRowHover : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Name & Description */}
      <td style={styles.tableCell}>
        <div style={styles.configName}>{config.name}</div>
        {config.description && (
          <div style={styles.configDescription}>{config.description}</div>
        )}
        <div style={styles.datasetId}>{config.dataset_id}</div>
      </td>

      {/* Active Status */}
      <td style={styles.tableCellCenter}>
        <ActiveStatusBadge isActive={config.is_active} />
      </td>

      {/* Last Fetch Status */}
      <td style={styles.tableCellCenter}>
        <FetchStatusBadge status={config.last_fetch_status} />
        {config.last_fetch_status === 'failed' && config.last_error_message && (
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-error)',
              marginTop: 'var(--spacing-1)',
              maxWidth: '150px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={config.last_error_message}
          >
            {config.last_error_message}
          </div>
        )}
      </td>

      {/* Last Fetch Time */}
      <td style={styles.tableCell}>
        <div style={styles.fetchInfo}>{formatDate(config.last_fetch_at)}</div>
        <div style={styles.fetchCount}>
          {config.fetch_count} fetch{config.fetch_count !== 1 ? 'es' : ''} total
        </div>
      </td>

      {/* Next Fetch */}
      <td style={styles.tableCell}>
        <div style={styles.fetchInfo}>
          {config.is_active ? formatRelativeTime(config.next_fetch_at) : '\u2014'}
        </div>
        {config.is_active && config.next_fetch_at && (
          <div style={styles.fetchCount}>{formatDate(config.next_fetch_at)}</div>
        )}
      </td>

      {/* Actions */}
      <td style={styles.tableCellRight}>
        <button
          style={{
            ...styles.toggleButton,
            backgroundColor: config.is_active
              ? 'var(--color-gray-200)'
              : 'var(--color-success)',
            color: config.is_active ? 'var(--color-gray-700)' : 'white',
          }}
          onClick={() => onToggle(config)}
          disabled={isUpdating}
          title={config.is_active ? 'Deactivate' : 'Activate'}
        >
          {isUpdating ? '...' : config.is_active ? 'Pause' : 'Enable'}
        </button>

        {onEdit && (
          <button
            style={{
              ...styles.actionButton,
              ...(editHovered ? styles.actionButtonHover : {}),
            }}
            onClick={() => onEdit(config)}
            onMouseEnter={() => setEditHovered(true)}
            onMouseLeave={() => setEditHovered(false)}
            title="Edit configuration"
          >
            Edit
          </button>
        )}

        <button
          style={{
            ...styles.actionButton,
            ...styles.actionButtonDanger,
            ...(deleteHovered ? styles.actionButtonDangerHover : {}),
          }}
          onClick={() => onDelete(config)}
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
          disabled={isDeleting}
          title="Delete configuration"
        >
          {isDeleting ? '...' : 'Delete'}
        </button>
      </td>
    </tr>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * FetchConfigList component displays saved fetch configurations.
 *
 * Shows a table with configuration details, status indicators, and action buttons.
 * Supports toggling active status and deleting configurations.
 */
export function FetchConfigList({ onAddNew, onEdit }: FetchConfigListProps) {
  const [addButtonHovered, setAddButtonHovered] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Fetch configurations
  const {
    data: configs,
    isLoading,
    error,
  } = useFetchConfigs({ page: 1, page_size: 50 });

  // Update mutation
  const { mutate: updateConfig } = useUpdateFetchConfig({
    onMutate: ({ id }) => setUpdatingId(id),
    onSettled: () => setUpdatingId(null),
  });

  // Delete mutation
  const { mutate: deleteConfig } = useDeleteFetchConfig({
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
  });

  // Handle toggle active status
  const handleToggle = useCallback(
    (config: FetchConfigResponse) => {
      updateConfig({
        id: config.id,
        data: { is_active: !config.is_active },
      });
    },
    [updateConfig]
  );

  // Handle delete with confirmation
  const handleDelete = useCallback(
    (config: FetchConfigResponse) => {
      if (window.confirm(`Are you sure you want to delete "${config.name}"?`)) {
        deleteConfig(config.id);
      }
    },
    [deleteConfig]
  );

  // Render loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Render error state
  if (error) {
    return <ErrorState message={error.message} />;
  }

  // Render empty state
  if (!configs?.items.length) {
    return <EmptyState onAddNew={onAddNew} />;
  }

  return (
    <div style={styles.container}>
      {/* Header with Add button */}
      <div style={styles.header}>
        <h4 style={styles.title}>Configured Datasets</h4>
        {onAddNew && (
          <button
            style={{
              ...styles.addButton,
              ...(addButtonHovered ? styles.addButtonHover : {}),
            }}
            onClick={onAddNew}
            onMouseEnter={() => setAddButtonHovered(true)}
            onMouseLeave={() => setAddButtonHovered(false)}
          >
            + Add Configuration
          </button>
        )}
      </div>

      {/* Configuration table */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHeader}>Configuration</th>
            <th style={styles.tableHeaderCenter}>Status</th>
            <th style={styles.tableHeaderCenter}>Last Fetch</th>
            <th style={styles.tableHeader}>Last Run</th>
            <th style={styles.tableHeader}>Next Fetch</th>
            <th style={styles.tableHeaderRight}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {configs.items.map((config) => (
            <ConfigRow
              key={config.id}
              config={config}
              onEdit={onEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
              isUpdating={updatingId === config.id}
              isDeleting={deletingId === config.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FetchConfigList;
