/**
 * Base API client with fetch utilities for making HTTP requests.
 *
 * This module provides:
 * - Configuration for API base URL
 * - Generic fetch wrapper with type safety
 * - Error handling and response parsing
 * - Query string builder for filter parameters
 *
 * @example
 * import { apiClient, buildQueryString } from '@/api/client';
 * const data = await apiClient.get<DatasetResponse>('/datasets/my-dataset');
 */

import type { ErrorResponse } from '../types/api';

// =============================================================================
// Configuration
// =============================================================================

/**
 * API base URL from environment variable, defaults to localhost:8000 for development
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Full API path prefix
 */
export const API_PREFIX = `${API_BASE_URL}/api`;

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Custom error class for API errors with structured error data
 */
export class ApiError extends Error {
  /** HTTP status code */
  status: number;
  /** Structured error response from the API */
  errorResponse: ErrorResponse | null;

  constructor(message: string, status: number, errorResponse: ErrorResponse | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/**
 * Parse error response from the API
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  let errorResponse: ErrorResponse | null = null;

  try {
    const data = await response.json();
    if (data && typeof data === 'object' && 'detail' in data) {
      // FastAPI default error format
      errorResponse = {
        error: 'APIError',
        message: String(data.detail),
        detail: null,
      };
    } else if (data && typeof data === 'object' && 'error' in data) {
      // Custom error response format
      errorResponse = data as ErrorResponse;
    }
  } catch {
    // Failed to parse error response
  }

  const message = errorResponse?.message || `HTTP ${response.status}: ${response.statusText}`;
  return new ApiError(message, response.status, errorResponse);
}

// =============================================================================
// Query String Utilities
// =============================================================================

/**
 * Build a URL query string from an object of parameters.
 * Filters out null, undefined, and empty string values.
 *
 * @param params - Object containing query parameters
 * @returns Query string starting with '?' or empty string if no params
 *
 * @example
 * buildQueryString({ page: 1, filter: 'active', empty: null })
 * // Returns '?page=1&filter=active'
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// =============================================================================
// Fetch Utilities
// =============================================================================

/** Request options extending standard RequestInit */
interface FetchOptions extends Omit<RequestInit, 'body'> {
  /** Request body - will be JSON stringified if object */
  body?: unknown;
}

/**
 * Make an HTTP request with JSON handling and error parsing.
 *
 * @param path - API path (relative to API_PREFIX)
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws ApiError on non-2xx responses
 *
 * @example
 * const dataset = await fetchApi<DatasetResponse>('/datasets/my-dataset');
 */
export async function fetchApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, headers: customHeaders, ...restOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...customHeaders,
  };

  const config: RequestInit = {
    ...restOptions,
    headers,
  };

  // Serialize body if present
  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const url = `${API_PREFIX}${path}`;
  const response = await fetch(url, config);

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// API Client Object
// =============================================================================

/**
 * API client with convenience methods for common HTTP operations.
 *
 * @example
 * // GET request
 * const datasets = await apiClient.get<DatasetListResponse>('/datasets');
 *
 * // POST request
 * const newDataset = await apiClient.post<DatasetResponse>('/datasets', { data });
 *
 * // PATCH request
 * const updated = await apiClient.patch<DatasetResponse>('/datasets/id', { name: 'New Name' });
 *
 * // DELETE request
 * await apiClient.delete('/datasets/id');
 */
export const apiClient = {
  /**
   * Make a GET request
   */
  get<T>(path: string, options?: Omit<FetchOptions, 'method' | 'body'>): Promise<T> {
    return fetchApi<T>(path, { ...options, method: 'GET' });
  },

  /**
   * Make a POST request
   */
  post<T>(path: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>): Promise<T> {
    return fetchApi<T>(path, { ...options, method: 'POST', body });
  },

  /**
   * Make a PATCH request
   */
  patch<T>(path: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>): Promise<T> {
    return fetchApi<T>(path, { ...options, method: 'PATCH', body });
  },

  /**
   * Make a PUT request
   */
  put<T>(path: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>): Promise<T> {
    return fetchApi<T>(path, { ...options, method: 'PUT', body });
  },

  /**
   * Make a DELETE request
   */
  delete<T>(path: string, options?: Omit<FetchOptions, 'method' | 'body'>): Promise<T> {
    return fetchApi<T>(path, { ...options, method: 'DELETE' });
  },
};

export default apiClient;
