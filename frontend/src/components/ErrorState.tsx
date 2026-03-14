/**
 * ErrorState component for displaying error messages.
 *
 * This component provides a consistent error display UI for API failures
 * and other error conditions. It supports special handling for specific
 * HTTP status codes (e.g., 400 Bad Request for inaccessible folders).
 *
 * In debug mode, provides an expandable panel with detailed error information
 * including stack traces, request IDs, and error metadata.
 *
 * @example
 * // Basic error
 * <ErrorState message="Failed to load data" />
 *
 * // Error with status code
 * <ErrorState message="Bad Request" statusCode={400} />
 *
 * // Error with debug details
 * <ErrorState
 *   message="Failed to load data"
 *   debugInfo={{ stack: '...', request_id: '...' }}
 *   showDebugInfo={true}
 * />
 */

import { useState } from 'react';
import { useDebug } from '../context/DebugContext';

// =============================================================================
// Types
// =============================================================================

export interface DebugInfo {
  /** Stack trace from the error */
  stack?: string;
  /** Request ID for tracking */
  request_id?: string;
  /** Error type/class name */
  type?: string;
  /** Additional debug metadata */
  [key: string]: unknown;
}

export interface ErrorStateProps {
  /** The error message to display */
  message: string;
  /** Optional HTTP status code for context-specific messages */
  statusCode?: number;
  /** Optional debug information to display in expandable panel */
  debugInfo?: DebugInfo;
  /** Whether to show debug info panel (defaults to debug mode state) */
  showDebugInfo?: boolean;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
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
  debugSection: {
    marginTop: 'var(--spacing-3)',
    paddingTop: 'var(--spacing-3)',
    borderTop: '1px solid var(--color-error)',
  },
  debugButton: {
    padding: 'var(--spacing-2) var(--spacing-3)',
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-error)',
    border: '1px solid var(--color-error)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    transition: 'all var(--transition-fast)',
  },
  debugButtonHover: {
    backgroundColor: 'var(--color-error)',
    color: 'var(--color-white)',
  },
  debugPanel: {
    marginTop: 'var(--spacing-3)',
    padding: 'var(--spacing-3)',
    backgroundColor: 'var(--color-white)',
    borderRadius: 'var(--radius)',
    textAlign: 'left' as const,
  },
  debugPanelTitle: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-gray-900)',
    marginBottom: 'var(--spacing-2)',
  },
  debugPanelContent: {
    fontSize: 'var(--font-size-xs)',
    fontFamily: 'monospace',
    color: 'var(--color-gray-700)',
    backgroundColor: 'var(--color-gray-50)',
    padding: 'var(--spacing-2)',
    borderRadius: 'var(--radius-sm)',
    overflowX: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  debugInfoItem: {
    marginBottom: 'var(--spacing-2)',
  },
  debugInfoLabel: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    color: 'var(--color-gray-700)',
    marginBottom: 'var(--spacing-1)',
  },
  copyButton: {
    padding: 'var(--spacing-2) var(--spacing-3)',
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-error)',
    border: '1px solid var(--color-error)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    transition: 'all var(--transition-fast)',
    marginLeft: 'var(--spacing-2)',
  },
  copyButtonHover: {
    backgroundColor: 'var(--color-error)',
    color: 'var(--color-white)',
  },
  copyButtonSuccess: {
    backgroundColor: 'var(--color-success)',
    color: 'var(--color-white)',
    borderColor: 'var(--color-success)',
  },
  buttonGroup: {
    display: 'flex',
    alignItems: 'center',
  },
};

// =============================================================================
// Component
// =============================================================================

/**
 * Error state component for displaying error messages.
 *
 * Displays a styled error message with optional status code handling.
 * For 400 status codes, shows a user-friendly message about inaccessible
 * or deprecated resources.
 *
 * In debug mode, provides an expandable panel with stack traces and
 * request IDs for troubleshooting.
 */
export function ErrorState({
  message,
  statusCode,
  debugInfo,
  showDebugInfo
}: ErrorStateProps) {
  const { debugMode } = useDebug();
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copyHovered, setCopyHovered] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Display specific message for 400 status code (Bad Request - inaccessible/deprecated folder)
  const displayMessage = statusCode === 400
    ? 'This folder is currently inaccessible or has been deprecated'
    : message;

  // Determine whether to show debug panel
  const shouldShowDebugInfo = showDebugInfo ?? debugMode;

  /**
   * Copy debug information to clipboard as formatted JSON.
   * Includes error message, stack trace, request ID, and timestamp.
   */
  const copyToClipboard = async () => {
    try {
      const debugData = {
        message,
        statusCode,
        ...debugInfo,
        timestamp: new Date().toISOString(),
      };

      const formattedJson = JSON.stringify(debugData, null, 2);
      await navigator.clipboard.writeText(formattedJson);

      // Show success feedback
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      // Clipboard API might fail due to permissions or browser support
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <div style={styles.error} data-testid="error-state">
      <div style={styles.errorTitle}>Failed to load tables</div>
      <p>{displayMessage}</p>

      {/* Debug details section - only shown when debug mode is enabled and debug info is available */}
      {shouldShowDebugInfo && debugInfo && (
        <div style={styles.debugSection} data-testid="debug-section">
          <div style={styles.buttonGroup}>
            <button
              style={{
                ...styles.debugButton,
                ...(isHovered ? styles.debugButtonHover : {}),
              }}
              onClick={() => setExpanded(!expanded)}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              data-testid="debug-toggle-button"
            >
              {expanded ? '▼ Hide Debug Details' : '▶ Show Debug Details'}
            </button>

            <button
              style={{
                ...styles.copyButton,
                ...(copySuccess ? styles.copyButtonSuccess : {}),
                ...(copyHovered && !copySuccess ? styles.copyButtonHover : {}),
              }}
              onClick={copyToClipboard}
              onMouseEnter={() => setCopyHovered(true)}
              onMouseLeave={() => setCopyHovered(false)}
              data-testid="copy-debug-button"
            >
              {copySuccess ? '✓ Copied!' : '📋 Copy Debug Info'}
            </button>
          </div>

          {expanded && (
            <div style={styles.debugPanel} data-testid="debug-panel">
              <div style={styles.debugPanelTitle}>Debug Information</div>

              {/* Request ID */}
              {debugInfo.request_id && (
                <div style={styles.debugInfoItem}>
                  <div style={styles.debugInfoLabel}>Request ID:</div>
                  <div style={styles.debugPanelContent}>
                    {debugInfo.request_id}
                  </div>
                </div>
              )}

              {/* Error Type */}
              {debugInfo.type && (
                <div style={styles.debugInfoItem}>
                  <div style={styles.debugInfoLabel}>Error Type:</div>
                  <div style={styles.debugPanelContent}>
                    {debugInfo.type}
                  </div>
                </div>
              )}

              {/* Stack Trace */}
              {debugInfo.stack && (
                <div style={styles.debugInfoItem}>
                  <div style={styles.debugInfoLabel}>Stack Trace:</div>
                  <div style={styles.debugPanelContent}>
                    {debugInfo.stack}
                  </div>
                </div>
              )}

              {/* Additional Debug Info */}
              {Object.entries(debugInfo).map(([key, value]) => {
                // Skip already displayed fields
                if (['stack', 'request_id', 'type'].includes(key)) {
                  return null;
                }

                return (
                  <div key={key} style={styles.debugInfoItem}>
                    <div style={styles.debugInfoLabel}>{key}:</div>
                    <div style={styles.debugPanelContent}>
                      {typeof value === 'object'
                        ? JSON.stringify(value, null, 2)
                        : String(value)
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ErrorState;
