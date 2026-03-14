/**
 * ErrorState component for displaying error messages.
 *
 * This component provides a consistent error display UI for API failures
 * and other error conditions. It supports special handling for specific
 * HTTP status codes (e.g., 400 Bad Request for inaccessible folders).
 *
 * @example
 * // Basic error
 * <ErrorState message="Failed to load data" />
 *
 * // Error with status code
 * <ErrorState message="Bad Request" statusCode={400} />
 */

// =============================================================================
// Types
// =============================================================================

export interface ErrorStateProps {
  /** The error message to display */
  message: string;
  /** Optional HTTP status code for context-specific messages */
  statusCode?: number;
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
 */
export function ErrorState({ message, statusCode }: ErrorStateProps) {
  // Display specific message for 400 status code (Bad Request - inaccessible/deprecated folder)
  const displayMessage = statusCode === 400
    ? 'This folder is currently inaccessible or has been deprecated'
    : message;

  return (
    <div style={styles.error}>
      <div style={styles.errorTitle}>Failed to load tables</div>
      <p>{displayMessage}</p>
    </div>
  );
}

export default ErrorState;
