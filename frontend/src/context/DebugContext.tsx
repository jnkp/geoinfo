/**
 * Debug mode state management context for enabling verbose error reporting.
 *
 * This module provides:
 * - DebugContext: React Context for accessing debug mode state
 * - DebugProvider: Provider component that manages debug state with localStorage persistence
 * - useDebug: Custom hook for consuming debug context
 *
 * Debug mode enables:
 * - Verbose error messages with stack traces
 * - Request ID tracking
 * - Enhanced diagnostic information
 * - Visual debug banner
 *
 * @example
 * // Wrap your app with DebugProvider
 * <DebugProvider>
 *   <App />
 * </DebugProvider>
 *
 * // Access debug state in child components
 * const { debugMode, toggleDebug } = useDebug();
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

// =============================================================================
// Types
// =============================================================================

/**
 * Context value providing debug mode state and toggle function.
 */
export interface DebugContextValue {
  /** Current debug mode state */
  debugMode: boolean;
  /** Toggle debug mode on/off */
  toggleDebug: () => void;
  /** Enable debug mode */
  enableDebug: () => void;
  /** Disable debug mode */
  disableDebug: () => void;
}

// =============================================================================
// Context
// =============================================================================

/**
 * Debug context for managing application debug mode state.
 */
const DebugContext = createContext<DebugContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

/**
 * Props for DebugProvider component.
 */
interface DebugProviderProps {
  /** Child components */
  children: ReactNode;
  /** Optional initial debug mode value (for testing) */
  initialDebugMode?: boolean;
}

/**
 * LocalStorage key for persisting debug mode state.
 */
const DEBUG_MODE_STORAGE_KEY = 'debug_mode';

/**
 * Read debug mode state from localStorage.
 * Falls back to false if localStorage is unavailable or value is invalid.
 */
function readDebugModeFromStorage(): boolean {
  try {
    const stored = localStorage.getItem(DEBUG_MODE_STORAGE_KEY);
    return stored === 'true';
  } catch (error) {
    // localStorage might be unavailable (private browsing, storage quota exceeded, etc.)
    console.warn('Failed to read debug mode from localStorage:', error);
    return false;
  }
}

/**
 * Write debug mode state to localStorage.
 * Gracefully handles localStorage errors.
 */
function writeDebugModeToStorage(value: boolean): void {
  try {
    localStorage.setItem(DEBUG_MODE_STORAGE_KEY, String(value));
  } catch (error) {
    // localStorage might be unavailable or quota exceeded
    console.warn('Failed to write debug mode to localStorage:', error);
  }
}

/**
 * Provider component for debug mode context.
 * Manages debug state with localStorage persistence.
 *
 * @example
 * <DebugProvider>
 *   <App />
 * </DebugProvider>
 */
export function DebugProvider({ children, initialDebugMode }: DebugProviderProps) {
  // Initialize debug mode from localStorage or use provided initial value
  const [debugMode, setDebugMode] = useState<boolean>(() => {
    if (initialDebugMode !== undefined) {
      return initialDebugMode;
    }
    return readDebugModeFromStorage();
  });

  // Persist debug mode to localStorage whenever it changes
  useEffect(() => {
    writeDebugModeToStorage(debugMode);
  }, [debugMode]);

  /**
   * Toggle debug mode between enabled and disabled.
   */
  const toggleDebug = useCallback(() => {
    setDebugMode((prev) => !prev);
  }, []);

  /**
   * Enable debug mode.
   */
  const enableDebug = useCallback(() => {
    setDebugMode(true);
  }, []);

  /**
   * Disable debug mode.
   */
  const disableDebug = useCallback(() => {
    setDebugMode(false);
  }, []);

  return (
    <DebugContext.Provider
      value={{
        debugMode,
        toggleDebug,
        enableDebug,
        disableDebug,
      }}
    >
      {children}
    </DebugContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Custom hook for accessing debug context.
 * Must be used within a DebugProvider.
 *
 * @throws Error if used outside DebugProvider
 *
 * @example
 * function MyComponent() {
 *   const { debugMode, toggleDebug } = useDebug();
 *   return (
 *     <div>
 *       <p>Debug mode: {debugMode ? 'enabled' : 'disabled'}</p>
 *       <button onClick={toggleDebug}>Toggle Debug</button>
 *     </div>
 *   );
 * }
 */
export function useDebug(): DebugContextValue {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within DebugProvider');
  }
  return context;
}
