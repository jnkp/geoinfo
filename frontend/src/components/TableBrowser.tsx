/**
 * StatFin Table Browser component.
 *
 * This component provides an interactive interface for browsing the StatFin
 * database hierarchy. It allows users to:
 * - Navigate folders in the StatFin table structure
 * - View available statistical tables
 * - Select tables for fetch configuration
 *
 * Uses a breadcrumb navigation pattern for folder traversal with support for
 * callback when a table is selected.
 *
 * @example
 * // Basic usage
 * <TableBrowser />
 *
 * // With selection callback
 * <TableBrowser onTableSelect={(table) => console.log(table)} />
 */

import { useState, useCallback, useMemo } from 'react';
import { useStatFinTables } from '../api/fetch-config';
import type { StatFinTableInfo } from '../types/api';

// =============================================================================
// Types
// =============================================================================

export interface TableBrowserProps {
  /** Callback when a table is selected */
  onTableSelect?: (table: StatFinTableInfo) => void;
  /** Initial path to start browsing from */
  initialPath?: string;
  /** Whether selection is disabled */
  disabled?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

interface BreadcrumbItem {
  label: string;
  path: string;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-4)',
    backgroundColor: 'var(--color-white)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-gray-200)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-4)',
    backgroundColor: 'var(--color-gray-50)',
    borderBottom: '1px solid var(--color-gray-200)',
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--color-gray-900)',
    margin: 0,
  },
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 'var(--spacing-1)',
    fontSize: 'var(--font-size-sm)',
  },
  breadcrumbItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-1)',
  },
  breadcrumbLink: {
    color: 'var(--color-primary)',
    cursor: 'pointer',
    textDecoration: 'none',
    padding: 'var(--spacing-1)',
    borderRadius: 'var(--radius-sm)',
    transition: 'background-color var(--transition-fast)',
    border: 'none',
    background: 'none',
    font: 'inherit',
  },
  breadcrumbLinkHover: {
    backgroundColor: 'var(--color-gray-100)',
  },
  breadcrumbCurrent: {
    color: 'var(--color-gray-600)',
    fontWeight: 500,
  },
  breadcrumbSeparator: {
    color: 'var(--color-gray-400)',
    margin: '0 var(--spacing-1)',
  },
  content: {
    padding: 'var(--spacing-4)',
    paddingTop: 0,
    minHeight: '300px',
    maxHeight: '500px',
    overflowY: 'auto' as const,
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-2)',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    padding: 'var(--spacing-3)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-200)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    backgroundColor: 'var(--color-white)',
  },
  listItemHover: {
    backgroundColor: 'var(--color-gray-50)',
    borderColor: 'var(--color-gray-300)',
  },
  listItemSelected: {
    backgroundColor: 'var(--color-primary-light)',
    borderColor: 'var(--color-primary)',
  },
  listItemDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  itemIcon: {
    marginRight: 'var(--spacing-3)',
    fontSize: 'var(--font-size-xl)',
    width: '24px',
    textAlign: 'center' as const,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
    color: 'var(--color-gray-900)',
    marginBottom: 'var(--spacing-1)',
  },
  itemId: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-gray-500)',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  itemArrow: {
    color: 'var(--color-gray-400)',
    marginLeft: 'var(--spacing-2)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-8)',
    color: 'var(--color-gray-500)',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid var(--color-gray-200)',
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
    textAlign: 'center' as const,
  },
  errorTitle: {
    fontWeight: 600,
    marginBottom: 'var(--spacing-2)',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-8)',
    textAlign: 'center' as const,
    color: 'var(--color-gray-500)',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: 'var(--spacing-4)',
  },
  compact: {
    container: {
      gap: 'var(--spacing-3)',
    },
    header: {
      padding: 'var(--spacing-3)',
    },
    content: {
      padding: 'var(--spacing-3)',
      minHeight: '200px',
      maxHeight: '350px',
    },
    listItem: {
      padding: 'var(--spacing-2)',
    },
  },
};

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Loading spinner component
 */
function LoadingState() {
  return (
    <div style={styles.loading}>
      <div style={styles.spinner} />
      <span>Loading tables...</span>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({ message }: { message: string }) {
  return (
    <div style={styles.error}>
      <div style={styles.errorTitle}>Failed to load tables</div>
      <p>{message}</p>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIcon}>-</div>
      <p>No tables found at this location</p>
    </div>
  );
}

/**
 * Breadcrumb navigation component
 */
function Breadcrumbs({
  items,
  onNavigate,
  disabled,
}: {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  disabled: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <nav style={styles.breadcrumbs} aria-label="Breadcrumb navigation">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isHovered = hoveredIndex === index;

        return (
          <span key={item.path} style={styles.breadcrumbItem}>
            {!isLast ? (
              <>
                <button
                  type="button"
                  style={{
                    ...styles.breadcrumbLink,
                    ...(isHovered && !disabled ? styles.breadcrumbLinkHover : {}),
                  }}
                  onClick={() => !disabled && onNavigate(item.path)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  disabled={disabled}
                >
                  {item.label}
                </button>
                <span style={styles.breadcrumbSeparator}>/</span>
              </>
            ) : (
              <span style={styles.breadcrumbCurrent}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Single table/folder item component
 */
function TableItem({
  table,
  onClick,
  disabled,
  compact,
}: {
  table: StatFinTableInfo;
  onClick: () => void;
  disabled: boolean;
  compact: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isFolder = table.type === 'folder';

  const itemStyle = useMemo(() => ({
    ...styles.listItem,
    ...(compact ? styles.compact.listItem : {}),
    ...(isHovered && !disabled ? styles.listItemHover : {}),
    ...(disabled ? styles.listItemDisabled : {}),
  }), [compact, isHovered, disabled]);

  return (
    <li
      style={itemStyle}
      onClick={() => !disabled && onClick()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-disabled={disabled}
    >
      <span style={styles.itemIcon} aria-hidden="true">
        {isFolder ? '\u{1F4C1}' : '\u{1F4CA}'}
      </span>
      <div style={styles.itemContent}>
        <div style={styles.itemName}>{table.text}</div>
        <div style={styles.itemId}>{table.table_id}</div>
      </div>
      {isFolder && (
        <span style={styles.itemArrow} aria-hidden="true">
          &rarr;
        </span>
      )}
    </li>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * TableBrowser component for navigating StatFin table hierarchy.
 *
 * Displays a breadcrumb-navigable file browser interface showing folders
 * and statistical tables from the StatFin database.
 */
export function TableBrowser({
  onTableSelect,
  initialPath = '',
  disabled = false,
  compact = false,
}: TableBrowserProps) {
  // Current navigation path
  const [currentPath, setCurrentPath] = useState(initialPath);

  // Fetch tables at current path
  const {
    data: tablesData,
    isLoading,
    isError,
    error,
  } = useStatFinTables({ path: currentPath });

  // Build breadcrumb items from current path
  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: 'StatFin', path: '' }];

    if (currentPath) {
      const pathParts = currentPath.split('/').filter(Boolean);
      let accumulatedPath = '';

      for (const part of pathParts) {
        accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
        items.push({ label: part, path: accumulatedPath });
      }
    }

    return items;
  }, [currentPath]);

  // Handle navigation to a folder
  const handleNavigate = useCallback((path: string) => {
    if (!disabled) {
      setCurrentPath(path);
    }
  }, [disabled]);

  // Handle item click - navigate if folder, select if table
  const handleItemClick = useCallback((table: StatFinTableInfo) => {
    if (disabled) return;

    if (table.type === 'folder') {
      // Navigate into folder using the path array
      const newPath = table.path.join('/');
      setCurrentPath(newPath);
    } else {
      // Table selected - call callback if provided
      onTableSelect?.(table);
    }
  }, [disabled, onTableSelect]);

  // Compute container style
  const containerStyle = useMemo(() => ({
    ...styles.container,
    ...(compact ? styles.compact.container : {}),
  }), [compact]);

  const headerStyle = useMemo(() => ({
    ...styles.header,
    ...(compact ? styles.compact.header : {}),
  }), [compact]);

  const contentStyle = useMemo(() => ({
    ...styles.content,
    ...(compact ? styles.compact.content : {}),
  }), [compact]);

  return (
    <div style={containerStyle}>
      {/* Header with breadcrumbs */}
      <header style={headerStyle}>
        <h3 style={styles.title}>Browse StatFin Tables</h3>
        <Breadcrumbs
          items={breadcrumbs}
          onNavigate={handleNavigate}
          disabled={disabled}
        />
      </header>

      {/* Table list content */}
      <div style={contentStyle}>
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={error?.message || 'Unknown error'} />
        ) : !tablesData?.tables.length ? (
          <EmptyState />
        ) : (
          <ul style={styles.list} role="list" aria-label="StatFin tables">
            {tablesData.tables.map((table) => (
              <TableItem
                key={table.table_id}
                table={table}
                onClick={() => handleItemClick(table)}
                disabled={disabled}
                compact={compact}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TableBrowser;
