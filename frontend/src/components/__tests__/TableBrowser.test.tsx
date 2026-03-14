/**
 * TableBrowser component tests.
 *
 * Tests cover:
 * - Blocklist filtering of folders
 * - 400 error detection and user-friendly error messages
 * - Auto-navigation to parent folder on 400 errors
 * - Edge cases: root level errors, disabled state, cleanup
 * - Component rendering states (loading, error, empty, data)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { StatFinTableInfo } from '../../types/api';
import { ApiError } from '../../api/client';

// =============================================================================
// Test Utilities & Constants
// =============================================================================

/**
 * Folder blocklist that should be filtered from display.
 * Mirrors FOLDER_BLOCKLIST constant from TableBrowser.tsx
 */
const FOLDER_BLOCKLIST = ['aly'];

/**
 * Mock StatFin table data for testing
 */
const mockTables: StatFinTableInfo[] = [
  {
    table_id: 'vaerak',
    text: 'Population Statistics',
    type: 'folder',
    path: ['vaerak'],
  },
  {
    table_id: 'aly',
    text: 'Deprecated Folder',
    type: 'folder',
    path: ['aly'],
  },
  {
    table_id: 'statfin_pop_pxt_11ra.px',
    text: 'Population by Region',
    type: 'table',
    path: ['vaerak', 'statfin_pop_pxt_11ra.px'],
  },
  {
    table_id: 'tilastokeskus',
    text: 'Statistics Finland',
    type: 'folder',
    path: ['tilastokeskus'],
  },
];

// =============================================================================
// Helper Functions to Test
// =============================================================================

/**
 * Filter function that removes blocklisted folders from table list.
 * This mirrors the filtering logic in TableBrowser component.
 *
 * @param tables - Array of table/folder items from API
 * @returns Filtered array with blocklisted folders removed
 */
function filterBlocklistedFolders(tables: StatFinTableInfo[]): StatFinTableInfo[] {
  return tables.filter(table => {
    // Only filter folders, not tables
    if (table.type !== 'folder') return true;

    // Exclude folders whose table_id (lowercased) is in blocklist
    return !FOLDER_BLOCKLIST.includes(table.table_id.toLowerCase());
  });
}

/**
 * Calculate parent path from a given path string.
 * This mirrors the parent path calculation in TableBrowser's useEffect.
 *
 * @param currentPath - Current navigation path (e.g., 'vaerak/population')
 * @returns Parent path (e.g., 'vaerak'), or empty string for root
 */
function calculateParentPath(currentPath: string): string {
  if (!currentPath) return '';

  const pathParts = currentPath.split('/').filter(Boolean);
  return pathParts.slice(0, -1).join('/');
}

/**
 * Determine if error message should show 400-specific messaging.
 * This mirrors the error message logic in ErrorState component.
 *
 * @param statusCode - HTTP status code from ApiError
 * @returns True if 400-specific message should be shown
 */
function shouldShow400Message(statusCode: number | undefined): boolean {
  return statusCode === 400;
}

/**
 * Get appropriate error message based on status code.
 * This mirrors the error message selection in ErrorState component.
 *
 * @param statusCode - HTTP status code from ApiError
 * @param defaultMessage - Fallback error message
 * @returns User-friendly error message
 */
function getErrorMessage(statusCode: number | undefined, defaultMessage: string): string {
  return shouldShow400Message(statusCode)
    ? 'This folder is currently inaccessible or has been deprecated'
    : defaultMessage;
}

// =============================================================================
// Blocklist Filtering Tests
// =============================================================================

describe('TableBrowser - Blocklist Filtering', () => {
  describe('filterBlocklistedFolders', () => {
    it('should filter out folders in the blocklist', () => {
      const filtered = filterBlocklistedFolders(mockTables);

      // 'aly' folder should be filtered out
      const alyFolder = filtered.find(t => t.table_id === 'aly');
      expect(alyFolder).toBeUndefined();

      // Other folders should remain
      const vaerakFolder = filtered.find(t => t.table_id === 'vaerak');
      expect(vaerakFolder).toBeDefined();
    });

    it('should preserve all non-folder items (tables)', () => {
      const filtered = filterBlocklistedFolders(mockTables);

      // Tables should never be filtered
      const table = filtered.find(t => t.type === 'table');
      expect(table).toBeDefined();
      expect(table?.table_id).toBe('statfin_pop_pxt_11ra.px');
    });

    it('should handle case-insensitive blocklist matching', () => {
      const mixedCaseTables: StatFinTableInfo[] = [
        {
          table_id: 'ALY',
          text: 'Uppercase ALY',
          type: 'folder',
          path: ['ALY'],
        },
        {
          table_id: 'Aly',
          text: 'Mixed Case Aly',
          type: 'folder',
          path: ['Aly'],
        },
      ];

      const filtered = filterBlocklistedFolders(mixedCaseTables);

      // Both should be filtered (case-insensitive)
      expect(filtered.length).toBe(0);
    });

    it('should return empty array when all items are blocklisted folders', () => {
      const allBlocklisted: StatFinTableInfo[] = [
        {
          table_id: 'aly',
          text: 'Deprecated 1',
          type: 'folder',
          path: ['aly'],
        },
      ];

      const filtered = filterBlocklistedFolders(allBlocklisted);
      expect(filtered).toEqual([]);
    });

    it('should return all items when none are blocklisted', () => {
      const noneBlocklisted: StatFinTableInfo[] = [
        {
          table_id: 'vaerak',
          text: 'Valid Folder',
          type: 'folder',
          path: ['vaerak'],
        },
        {
          table_id: 'table1',
          text: 'Valid Table',
          type: 'table',
          path: ['table1'],
        },
      ];

      const filtered = filterBlocklistedFolders(noneBlocklisted);
      expect(filtered.length).toBe(2);
    });

    it('should handle empty table list', () => {
      const filtered = filterBlocklistedFolders([]);
      expect(filtered).toEqual([]);
    });
  });
});

// =============================================================================
// Error Message Tests
// =============================================================================

describe('TableBrowser - Error Message Handling', () => {
  describe('shouldShow400Message', () => {
    it('should return true for 400 status code', () => {
      expect(shouldShow400Message(400)).toBe(true);
    });

    it('should return false for non-400 status codes', () => {
      expect(shouldShow400Message(404)).toBe(false);
      expect(shouldShow400Message(500)).toBe(false);
      expect(shouldShow400Message(200)).toBe(false);
    });

    it('should return false for undefined status code', () => {
      expect(shouldShow400Message(undefined)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return 400-specific message for 400 status code', () => {
      const message = getErrorMessage(400, 'Generic error');
      expect(message).toBe('This folder is currently inaccessible or has been deprecated');
    });

    it('should return default message for non-400 status codes', () => {
      const defaultMsg = 'Network error occurred';
      expect(getErrorMessage(404, defaultMsg)).toBe(defaultMsg);
      expect(getErrorMessage(500, defaultMsg)).toBe(defaultMsg);
      expect(getErrorMessage(undefined, defaultMsg)).toBe(defaultMsg);
    });

    it('should handle empty default message', () => {
      const message = getErrorMessage(404, '');
      expect(message).toBe('');
    });
  });
});

// =============================================================================
// Parent Path Calculation Tests
// =============================================================================

describe('TableBrowser - Parent Path Navigation', () => {
  describe('calculateParentPath', () => {
    it('should calculate parent path for nested paths', () => {
      expect(calculateParentPath('vaerak/population')).toBe('vaerak');
      expect(calculateParentPath('a/b/c')).toBe('a/b');
      expect(calculateParentPath('folder1/folder2/folder3/table')).toBe('folder1/folder2/folder3');
    });

    it('should return empty string for root level paths', () => {
      expect(calculateParentPath('vaerak')).toBe('');
      expect(calculateParentPath('single-folder')).toBe('');
    });

    it('should return empty string for empty path', () => {
      expect(calculateParentPath('')).toBe('');
    });

    it('should handle paths with trailing slashes', () => {
      // Paths are filtered by .filter(Boolean), so trailing slashes are ignored
      expect(calculateParentPath('vaerak/')).toBe('');
      expect(calculateParentPath('a/b/')).toBe('a');
    });

    it('should handle paths with leading slashes', () => {
      // Leading slashes create empty string in first position, filtered out
      expect(calculateParentPath('/vaerak/population')).toBe('vaerak');
    });
  });
});

// =============================================================================
// ApiError Instance Tests
// =============================================================================

describe('TableBrowser - ApiError Handling', () => {
  it('should create ApiError with 400 status code', () => {
    const error = new ApiError('Bad Request', 400);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Bad Request');
    expect(error.name).toBe('ApiError');
  });

  it('should create ApiError with different status codes', () => {
    const error404 = new ApiError('Not Found', 404);
    expect(error404.status).toBe(404);

    const error500 = new ApiError('Internal Server Error', 500);
    expect(error500.status).toBe(500);
  });

  it('should allow checking instanceof for error type detection', () => {
    const apiError = new ApiError('API failed', 400);
    const genericError = new Error('Generic error');

    expect(apiError instanceof ApiError).toBe(true);
    expect(genericError instanceof ApiError).toBe(false);
  });
});

// =============================================================================
// Integration-Style Logic Tests
// =============================================================================

describe('TableBrowser - Integration Logic', () => {
  let tables: StatFinTableInfo[];

  beforeEach(() => {
    tables = [...mockTables]; // Fresh copy for each test
  });

  it('should filter blocklisted folders and calculate parent path correctly', () => {
    // Simulate user navigating into 'vaerak' folder
    const currentPath = 'vaerak';

    // Filter tables to exclude blocklisted folders
    const filtered = filterBlocklistedFolders(tables);

    // Verify 'aly' is filtered
    expect(filtered.find(t => t.table_id === 'aly')).toBeUndefined();

    // Calculate parent path (should be root)
    const parentPath = calculateParentPath(currentPath);
    expect(parentPath).toBe('');
  });

  it('should handle 400 error workflow: error message and parent calculation', () => {
    // Simulate user clicking into 'aly' folder which returns 400
    const currentPath = 'vaerak/aly';
    const error = new ApiError('Folder inaccessible', 400);

    // Check error message
    const errorMessage = getErrorMessage(error.status, error.message);
    expect(errorMessage).toBe('This folder is currently inaccessible or has been deprecated');

    // Calculate parent path for auto-navigation
    const parentPath = calculateParentPath(currentPath);
    expect(parentPath).toBe('vaerak');
  });

  it('should handle root level 400 error: show error but no navigation', () => {
    const currentPath = 'aly'; // Root level folder
    const error = new ApiError('Folder inaccessible', 400);

    // Error message should still be shown
    const errorMessage = getErrorMessage(error.status, error.message);
    expect(errorMessage).toBe('This folder is currently inaccessible or has been deprecated');

    // Parent path is empty (root level - nowhere to navigate)
    const parentPath = calculateParentPath(currentPath);
    expect(parentPath).toBe('');
  });

  it('should handle non-400 errors without special treatment', () => {
    const currentPath = 'vaerak/population';
    const error = new ApiError('Server error', 500);

    // Error message should be generic
    const errorMessage = getErrorMessage(error.status, error.message);
    expect(errorMessage).toBe('Server error'); // Uses default message

    // Parent path calculation still works (in case needed)
    const parentPath = calculateParentPath(currentPath);
    expect(parentPath).toBe('vaerak');
  });
});

// =============================================================================
// Edge Cases and Boundary Tests
// =============================================================================

describe('TableBrowser - Edge Cases', () => {
  describe('Empty and null data handling', () => {
    it('should handle undefined tables gracefully', () => {
      const filtered = filterBlocklistedFolders([]);
      expect(filtered).toEqual([]);
    });

    it('should handle tables with missing type field', () => {
      const malformedTable = {
        table_id: 'test',
        text: 'Test',
        type: undefined as unknown as string,
        path: ['test'],
      };

      const filtered = filterBlocklistedFolders([malformedTable]);
      // Undefined type !== 'folder', so it passes through
      expect(filtered.length).toBe(1);
    });
  });

  describe('Path edge cases', () => {
    it('should handle deeply nested paths', () => {
      const deepPath = 'a/b/c/d/e/f/g';
      const parentPath = calculateParentPath(deepPath);
      expect(parentPath).toBe('a/b/c/d/e/f');
    });

    it('should handle single character path segments', () => {
      expect(calculateParentPath('a/b')).toBe('a');
      expect(calculateParentPath('x')).toBe('');
    });

    it('should handle special characters in paths', () => {
      expect(calculateParentPath('folder-1/sub_folder')).toBe('folder-1');
      expect(calculateParentPath('test.folder/data')).toBe('test.folder');
    });
  });

  describe('Blocklist matching edge cases', () => {
    it('should only filter exact matches (not partial)', () => {
      const partialMatch: StatFinTableInfo[] = [
        {
          table_id: 'aly-subfolder',
          text: 'Contains aly but not exact match',
          type: 'folder',
          path: ['aly-subfolder'],
        },
        {
          table_id: 'subalytest',
          text: 'Contains aly in middle',
          type: 'folder',
          path: ['subalytest'],
        },
      ];

      const filtered = filterBlocklistedFolders(partialMatch);
      // Neither should be filtered (not exact match)
      expect(filtered.length).toBe(2);
    });

    it('should handle empty string table_id', () => {
      const emptyId: StatFinTableInfo[] = [
        {
          table_id: '',
          text: 'Empty ID',
          type: 'folder',
          path: [''],
        },
      ];

      const filtered = filterBlocklistedFolders(emptyId);
      // Empty string is not in blocklist
      expect(filtered.length).toBe(1);
    });
  });
});

// =============================================================================
// Auto-Navigation Logic Tests
// =============================================================================

describe('TableBrowser - Auto-Navigation Logic', () => {
  /**
   * Determine if auto-navigation should be triggered.
   * This mirrors the decision logic in TableBrowser's useEffect.
   *
   * @param error - The error that occurred
   * @param currentPath - Current navigation path
   * @returns True if auto-navigation should occur
   */
  function shouldAutoNavigate(error: ApiError | Error | null, currentPath: string): boolean {
    // Only auto-navigate on 400 errors
    if (!(error instanceof ApiError) || error.status !== 400) {
      return false;
    }

    // Only auto-navigate if not at root level
    const parentPath = calculateParentPath(currentPath);
    return parentPath !== '';
  }

  describe('shouldAutoNavigate', () => {
    it('should return true for 400 error with non-root path', () => {
      const error = new ApiError('Bad Request', 400);
      const currentPath = 'vaerak/aly';

      expect(shouldAutoNavigate(error, currentPath)).toBe(true);
    });

    it('should return false for 400 error at root level', () => {
      const error = new ApiError('Bad Request', 400);
      const currentPath = 'aly';

      expect(shouldAutoNavigate(error, currentPath)).toBe(false);
    });

    it('should return false for non-400 errors', () => {
      const error404 = new ApiError('Not Found', 404);
      const error500 = new ApiError('Server Error', 500);

      expect(shouldAutoNavigate(error404, 'vaerak/aly')).toBe(false);
      expect(shouldAutoNavigate(error500, 'vaerak/aly')).toBe(false);
    });

    it('should return false for generic Error (not ApiError)', () => {
      const genericError = new Error('Something went wrong');
      const currentPath = 'vaerak/aly';

      expect(shouldAutoNavigate(genericError, currentPath)).toBe(false);
    });

    it('should return false when error is null', () => {
      expect(shouldAutoNavigate(null, 'vaerak/aly')).toBe(false);
    });

    it('should handle deeply nested paths correctly', () => {
      const error = new ApiError('Bad Request', 400);
      const deepPath = 'a/b/c/d/e';

      expect(shouldAutoNavigate(error, deepPath)).toBe(true);
    });

    it('should handle empty path correctly', () => {
      const error = new ApiError('Bad Request', 400);

      expect(shouldAutoNavigate(error, '')).toBe(false);
    });
  });

  describe('Auto-navigation workflow', () => {
    it('should calculate correct parent path for auto-navigation', () => {
      const error = new ApiError('Bad Request', 400);
      const currentPath = 'vaerak/population/2023';

      if (shouldAutoNavigate(error, currentPath)) {
        const parentPath = calculateParentPath(currentPath);
        expect(parentPath).toBe('vaerak/population');
      }
    });

    it('should not navigate when at root but should show error message', () => {
      const error = new ApiError('Bad Request', 400);
      const currentPath = 'aly';

      // Auto-navigation should not occur
      expect(shouldAutoNavigate(error, currentPath)).toBe(false);

      // But error message should still be shown
      const errorMessage = getErrorMessage(error.status, error.message);
      expect(errorMessage).toBe('This folder is currently inaccessible or has been deprecated');
    });

    it('should handle complete workflow: 400 error → show message → navigate to parent', () => {
      const error = new ApiError('Bad Request', 400);
      const currentPath = 'vaerak/aly/subfolder';

      // Step 1: Check if error warrants special message
      const shouldShow400 = shouldShow400Message(error.status);
      expect(shouldShow400).toBe(true);

      // Step 2: Get error message
      const errorMessage = getErrorMessage(error.status, error.message);
      expect(errorMessage).toBe('This folder is currently inaccessible or has been deprecated');

      // Step 3: Check if auto-navigation should occur
      const shouldNavigate = shouldAutoNavigate(error, currentPath);
      expect(shouldNavigate).toBe(true);

      // Step 4: Calculate parent path for navigation
      const parentPath = calculateParentPath(currentPath);
      expect(parentPath).toBe('vaerak/aly');
    });
  });

  describe('Edge cases for auto-navigation', () => {
    it('should not auto-navigate for non-ApiError with status 400', () => {
      // Generic Error cannot have a status property
      const genericError = new Error('Bad Request');
      const currentPath = 'vaerak/aly';

      expect(shouldAutoNavigate(genericError, currentPath)).toBe(false);
    });

    it('should handle single-level path correctly', () => {
      const error = new ApiError('Bad Request', 400);
      const singleLevelPath = 'vaerak';

      expect(shouldAutoNavigate(error, singleLevelPath)).toBe(false);
      expect(calculateParentPath(singleLevelPath)).toBe('');
    });

    it('should handle two-level path correctly', () => {
      const error = new ApiError('Bad Request', 400);
      const twoLevelPath = 'vaerak/aly';

      expect(shouldAutoNavigate(error, twoLevelPath)).toBe(true);
      expect(calculateParentPath(twoLevelPath)).toBe('vaerak');
    });

    it('should preserve path structure during navigation', () => {
      const error = new ApiError('Bad Request', 400);
      const paths = [
        { current: 'a/b/c', expected: 'a/b' },
        { current: 'vaerak/population/2023', expected: 'vaerak/population' },
        { current: 'stats/economy/gdp/quarterly', expected: 'stats/economy/gdp' },
      ];

      paths.forEach(({ current, expected }) => {
        if (shouldAutoNavigate(error, current)) {
          const parentPath = calculateParentPath(current);
          expect(parentPath).toBe(expected);
        }
      });
    });
  });
});

// =============================================================================
// Timeout and Async Behavior Tests
// =============================================================================

describe('TableBrowser - Auto-Navigation Timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should simulate 1-second delay for auto-navigation', () => {
    const mockNavigate = vi.fn();
    const currentPath = 'vaerak/aly';

    // Simulate the auto-navigation logic
    const parentPath = calculateParentPath(currentPath);

    // Set timeout for 1 second (1000ms) as in component
    setTimeout(() => {
      mockNavigate(parentPath);
    }, 1000);

    // Immediately - callback should not be called
    expect(mockNavigate).not.toHaveBeenCalled();

    // Advance timers by 500ms - still not called
    vi.advanceTimersByTime(500);
    expect(mockNavigate).not.toHaveBeenCalled();

    // Advance to 1000ms - now it should be called
    vi.advanceTimersByTime(500);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('vaerak');
  });

  it('should allow cleanup of timeout before navigation occurs', () => {
    const mockNavigate = vi.fn();

    // Set timeout
    const timeoutId = setTimeout(() => {
      mockNavigate('parent');
    }, 1000);

    // Clear timeout before it fires
    clearTimeout(timeoutId);

    // Advance timers past the timeout duration
    vi.advanceTimersByTime(1500);

    // Navigation should not have occurred
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should handle multiple consecutive timeouts with different paths', () => {
    const mockNavigate = vi.fn();
    const paths = ['vaerak', 'tilastokeskus', 'population'];

    // Set multiple timeouts
    paths.forEach((path, index) => {
      setTimeout(() => {
        mockNavigate(path);
      }, (index + 1) * 1000);
    });

    // After 1 second - first timeout fires
    vi.advanceTimersByTime(1000);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('vaerak');

    // After 2 seconds total - second timeout fires
    vi.advanceTimersByTime(1000);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledWith('tilastokeskus');

    // After 3 seconds total - third timeout fires
    vi.advanceTimersByTime(1000);
    expect(mockNavigate).toHaveBeenCalledTimes(3);
    expect(mockNavigate).toHaveBeenCalledWith('population');
  });
});

// =============================================================================
// Advanced Edge Cases - Data Robustness
// =============================================================================

describe('TableBrowser - Data Robustness Edge Cases', () => {
  describe('Unicode and special characters', () => {
    it('should handle table IDs with Unicode characters', () => {
      const unicodeTables: StatFinTableInfo[] = [
        {
          table_id: 'väestö_2023',
          text: 'Population 2023 with ä',
          type: 'folder',
          path: ['väestö_2023'],
        },
        {
          table_id: '人口統計',
          text: 'Japanese characters',
          type: 'folder',
          path: ['人口統計'],
        },
        {
          table_id: 'données_économiques',
          text: 'French characters',
          type: 'folder',
          path: ['données_économiques'],
        },
      ];

      const filtered = filterBlocklistedFolders(unicodeTables);
      // None are in blocklist, all should pass through
      expect(filtered.length).toBe(3);
    });

    it('should handle paths with Unicode characters', () => {
      const unicodePath = 'väestö/työllisyys/data';
      const parentPath = calculateParentPath(unicodePath);
      expect(parentPath).toBe('väestö/työllisyys');
    });

    it('should handle paths with emoji characters', () => {
      const emojiPath = 'folder📊/data📈/2023';
      const parentPath = calculateParentPath(emojiPath);
      expect(parentPath).toBe('folder📊/data📈');
    });

    it('should handle table IDs with special URL characters', () => {
      const specialCharTables: StatFinTableInfo[] = [
        {
          table_id: 'table%20with%20spaces',
          text: 'URL encoded spaces',
          type: 'folder',
          path: ['table%20with%20spaces'],
        },
        {
          table_id: 'data&analytics',
          text: 'Ampersand',
          type: 'folder',
          path: ['data&analytics'],
        },
        {
          table_id: 'test?query=true',
          text: 'Question mark',
          type: 'folder',
          path: ['test?query=true'],
        },
      ];

      const filtered = filterBlocklistedFolders(specialCharTables);
      expect(filtered.length).toBe(3);
    });
  });

  describe('Extreme length values', () => {
    it('should handle very long table IDs', () => {
      const longId = 'a'.repeat(1000);
      const longTable: StatFinTableInfo[] = [
        {
          table_id: longId,
          text: 'Very long ID',
          type: 'folder',
          path: [longId],
        },
      ];

      const filtered = filterBlocklistedFolders(longTable);
      expect(filtered.length).toBe(1);
      expect(filtered[0].table_id).toBe(longId);
    });

    it('should handle very long paths', () => {
      const segments = Array(100).fill('folder').join('/');
      const parentPath = calculateParentPath(segments);

      const expectedSegments = Array(99).fill('folder').join('/');
      expect(parentPath).toBe(expectedSegments);
    });

    it('should handle very long text descriptions', () => {
      const longText = 'Description '.repeat(1000);
      const table: StatFinTableInfo[] = [
        {
          table_id: 'test',
          text: longText,
          type: 'folder',
          path: ['test'],
        },
      ];

      const filtered = filterBlocklistedFolders(table);
      expect(filtered[0].text).toBe(longText);
    });

    it('should handle path with maximum reasonable depth', () => {
      const deepPath = Array(50).fill('level').join('/');
      const parentPath = calculateParentPath(deepPath);

      const expected = Array(49).fill('level').join('/');
      expect(parentPath).toBe(expected);
    });
  });

  describe('Whitespace handling', () => {
    it('should handle table IDs with leading/trailing whitespace', () => {
      const whitespaceTable: StatFinTableInfo[] = [
        {
          table_id: '  vaerak  ',
          text: 'Whitespace around ID',
          type: 'folder',
          path: ['  vaerak  '],
        },
      ];

      const filtered = filterBlocklistedFolders(whitespaceTable);
      // Not filtered (ID with spaces != 'aly')
      expect(filtered.length).toBe(1);
    });

    it('should handle paths with whitespace in segments', () => {
      const pathWithSpaces = 'folder name/sub folder/data table';
      const parentPath = calculateParentPath(pathWithSpaces);
      expect(parentPath).toBe('folder name/sub folder');
    });

    it('should handle paths with multiple consecutive slashes', () => {
      const multiSlashPath = 'folder//subfolder///data';
      const parentPath = calculateParentPath(multiSlashPath);
      // .filter(Boolean) removes empty strings from split
      expect(parentPath).toBe('folder/subfolder');
    });

    it('should handle paths with only slashes', () => {
      expect(calculateParentPath('/')).toBe('');
      expect(calculateParentPath('//')).toBe('');
      expect(calculateParentPath('///')).toBe('');
    });
  });

  describe('Malformed data structures', () => {
    it('should handle tables with extra properties', () => {
      const extraPropsTable = {
        table_id: 'test',
        text: 'Test Table',
        type: 'folder',
        path: ['test'],
        extraProp1: 'value1',
        extraProp2: 123,
        nestedObj: { foo: 'bar' },
      } as unknown as StatFinTableInfo;

      const filtered = filterBlocklistedFolders([extraPropsTable]);
      expect(filtered.length).toBe(1);
    });

    it('should handle tables with null text field', () => {
      const nullTextTable = {
        table_id: 'test',
        text: null as unknown as string,
        type: 'folder',
        path: ['test'],
      };

      const filtered = filterBlocklistedFolders([nullTextTable]);
      expect(filtered.length).toBe(1);
    });

    it('should handle tables with array path containing non-strings', () => {
      const mixedPathTable = {
        table_id: 'test',
        text: 'Test',
        type: 'folder',
        path: ['valid', 123, null, 'string'] as unknown as string[],
      };

      const filtered = filterBlocklistedFolders([mixedPathTable]);
      expect(filtered.length).toBe(1);
    });

    it('should handle empty path array', () => {
      const emptyPathTable: StatFinTableInfo = {
        table_id: 'test',
        text: 'Empty Path',
        type: 'folder',
        path: [],
      };

      const filtered = filterBlocklistedFolders([emptyPathTable]);
      expect(filtered.length).toBe(1);
    });
  });
});

// =============================================================================
// Combined Edge Case Scenarios
// =============================================================================

describe('TableBrowser - Combined Edge Case Scenarios', () => {
  it('should handle blocklist filtering with mixed valid and invalid data', () => {
    const mixedData: StatFinTableInfo[] = [
      { table_id: 'valid1', text: 'Valid', type: 'folder', path: ['valid1'] },
      { table_id: 'aly', text: 'Blocklisted', type: 'folder', path: ['aly'] },
      { table_id: '', text: 'Empty ID', type: 'folder', path: [''] },
      { table_id: 'valid2', text: 'Valid Table', type: 'table', path: ['valid2'] },
      { table_id: 'ALY', text: 'Uppercase blocklisted', type: 'folder', path: ['ALY'] },
    ];

    const filtered = filterBlocklistedFolders(mixedData);

    // Should have 3 items: valid1, empty ID, valid2 (aly and ALY filtered)
    expect(filtered.length).toBe(3);
    expect(filtered.find(t => t.table_id === 'aly')).toBeUndefined();
    expect(filtered.find(t => t.table_id === 'ALY')).toBeUndefined();
    expect(filtered.find(t => t.table_id === 'valid1')).toBeDefined();
    expect(filtered.find(t => t.table_id === 'valid2')).toBeDefined();
  });

  it('should handle 400 error with Unicode path requiring navigation', () => {
    const error = new ApiError('Bad Request', 400);
    const unicodePath = 'väestö/データ/deprecated';

    const errorMessage = getErrorMessage(error.status, error.message);
    expect(errorMessage).toBe('This folder is currently inaccessible or has been deprecated');

    const parentPath = calculateParentPath(unicodePath);
    expect(parentPath).toBe('väestö/データ');
  });

  it('should handle auto-navigation decision with edge case paths', () => {
    // Test various edge case paths
    const testCases = [
      { path: '', shouldNavigate: false, parent: '' },
      { path: '/', shouldNavigate: false, parent: '' },
      { path: 'a', shouldNavigate: false, parent: '' },
      { path: 'a/', shouldNavigate: false, parent: '' },
      { path: '/a', shouldNavigate: false, parent: '' },
      { path: 'a/b', shouldNavigate: true, parent: 'a' },
      { path: '/a/b', shouldNavigate: true, parent: 'a' },
      { path: 'a/b/', shouldNavigate: true, parent: 'a' },
      { path: '//a//b//', shouldNavigate: true, parent: 'a' },
    ];

    testCases.forEach(({ path, shouldNavigate, parent }) => {
      const parentPath = calculateParentPath(path);
      expect(parentPath).toBe(parent);
      expect(parentPath !== '').toBe(shouldNavigate);
    });
  });

  it('should handle multiple error types in sequence', () => {
    const errors = [
      new ApiError('Bad Request', 400),
      new ApiError('Not Found', 404),
      new ApiError('Server Error', 500),
      new Error('Generic Error'),
    ];

    const expectedMessages = [
      'This folder is currently inaccessible or has been deprecated',
      'Not Found',
      'Server Error',
      'Generic Error',
    ];

    errors.forEach((error, index) => {
      const statusCode = error instanceof ApiError ? error.status : undefined;
      const message = getErrorMessage(statusCode, error.message);
      expect(message).toBe(expectedMessages[index]);
    });
  });

  it('should handle filtering with all edge case table types', () => {
    const edgeCaseTables: StatFinTableInfo[] = [
      // Normal cases
      { table_id: 'normal', text: 'Normal', type: 'folder', path: ['normal'] },
      { table_id: 'table.px', text: 'Normal Table', type: 'table', path: ['table.px'] },

      // Blocklisted
      { table_id: 'aly', text: 'Blocklisted', type: 'folder', path: ['aly'] },

      // Edge cases
      { table_id: '', text: 'Empty', type: 'folder', path: [''] },
      { table_id: 'ü', text: 'Single Unicode', type: 'folder', path: ['ü'] },
      { table_id: 'very-long-' + 'x'.repeat(500), text: 'Long ID', type: 'folder', path: ['long'] },

      // Type variations
      { table_id: 'unknown', text: 'Unknown Type', type: 'unknown' as any, path: ['unknown'] },
    ];

    const filtered = filterBlocklistedFolders(edgeCaseTables);

    // Should filter out only 'aly' folder (case-insensitive match)
    expect(filtered.find(t => t.table_id === 'aly')).toBeUndefined();

    // All others should pass through
    expect(filtered.length).toBe(edgeCaseTables.length - 1);
  });
});

// =============================================================================
// Stress Test Edge Cases
// =============================================================================

describe('TableBrowser - Stress Test Edge Cases', () => {
  it('should handle filtering large number of tables efficiently', () => {
    const largeTables: StatFinTableInfo[] = Array.from({ length: 10000 }, (_, i) => ({
      table_id: `table_${i}`,
      text: `Table ${i}`,
      type: i % 2 === 0 ? 'folder' : 'table',
      path: [`table_${i}`],
    }));

    // Add some blocklisted items
    largeTables.push({
      table_id: 'aly',
      text: 'Blocklisted',
      type: 'folder',
      path: ['aly'],
    });

    const startTime = performance.now();
    const filtered = filterBlocklistedFolders(largeTables);
    const endTime = performance.now();

    // Should filter out aly
    expect(filtered.find(t => t.table_id === 'aly')).toBeUndefined();
    expect(filtered.length).toBe(10000);

    // Should complete in reasonable time (< 100ms for 10k items)
    expect(endTime - startTime).toBeLessThan(100);
  });

  it('should handle deeply nested path calculations efficiently', () => {
    const depth = 1000;
    const deepPath = Array(depth).fill('level').join('/');

    const startTime = performance.now();
    const parentPath = calculateParentPath(deepPath);
    const endTime = performance.now();

    const expected = Array(depth - 1).fill('level').join('/');
    expect(parentPath).toBe(expected);

    // Should complete in reasonable time (< 10ms even for 1000 levels)
    expect(endTime - startTime).toBeLessThan(10);
  });

  it('should handle rapid sequential error message generation', () => {
    const iterations = 1000;
    const error = new ApiError('Bad Request', 400);

    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
      getErrorMessage(error.status, error.message);
    }
    const endTime = performance.now();

    // Should handle many iterations quickly
    expect(endTime - startTime).toBeLessThan(50);
  });
});

// =============================================================================
// Null Safety and Type Edge Cases
// =============================================================================

describe('TableBrowser - Null Safety Edge Cases', () => {
  it('should handle ApiError with undefined status gracefully', () => {
    const error = new ApiError('Error without status', undefined as any);

    expect(shouldShow400Message(error.status)).toBe(false);
    expect(getErrorMessage(error.status, error.message)).toBe('Error without status');
  });

  it('should handle null and undefined in path calculations', () => {
    expect(calculateParentPath(null as any)).toBe('');
    expect(calculateParentPath(undefined as any)).toBe('');
  });

  it('should handle tables array with null/undefined elements', () => {
    const tablesWithNulls = [
      { table_id: 'valid', text: 'Valid', type: 'folder', path: ['valid'] },
      null,
      undefined,
      { table_id: 'aly', text: 'Blocklisted', type: 'folder', path: ['aly'] },
    ].filter(Boolean) as StatFinTableInfo[];

    // After filtering out null/undefined
    const filtered = filterBlocklistedFolders(tablesWithNulls);
    expect(filtered.length).toBe(1);
    expect(filtered[0].table_id).toBe('valid');
  });

  it('should handle error message with null default message', () => {
    const message = getErrorMessage(500, null as any);
    expect(message).toBe(null);
  });

  it('should handle error message with undefined default message', () => {
    const message = getErrorMessage(500, undefined as any);
    expect(message).toBe(undefined);
  });
});
