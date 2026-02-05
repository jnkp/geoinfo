/**
 * Central export point for all API utilities and hooks.
 *
 * This module re-exports all API-related functionality:
 * - API client and fetch utilities
 * - Dataset query hooks
 * - Statistics query hooks
 *
 * @example
 * import { useDatasets, useStatistics, apiClient } from '@/api';
 */

// API client and utilities
export {
  apiClient,
  fetchApi,
  buildQueryString,
  ApiError,
  API_BASE_URL,
  API_PREFIX,
} from './client';

// Dataset hooks
export {
  useDatasets,
  useDataset,
  useCreateDataset,
  useUpdateDataset,
  useDeleteDataset,
  datasetsKeys,
  type DatasetListParams,
} from './datasets';

// Statistics hooks
export {
  useStatistics,
  useStatistic,
  useCreateStatistic,
  useDeleteStatistic,
  statisticsKeys,
} from './statistics';
