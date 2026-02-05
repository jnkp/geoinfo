/**
 * TanStack Query hooks for statistics API operations.
 *
 * This module provides React hooks for:
 * - Querying statistics with multi-dimensional filtering
 * - Fetching individual statistic records
 * - Creating and deleting statistics
 *
 * Uses TanStack Query v5 for data fetching with caching and invalidation.
 *
 * @example
 * // List statistics with filters
 * const { data, isLoading } = useStatistics({ dataset_id: 'population', year: 2023 });
 *
 * // Get single statistic
 * const { data: stat } = useStatistic(123);
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import { apiClient, buildQueryString } from './client';
import type {
  StatisticResponse,
  StatisticListResponse,
  StatisticCreate,
  StatisticQueryParams,
  MessageResponse,
} from '../types/api';

// =============================================================================
// Query Keys
// =============================================================================

/**
 * Query key factory for statistics queries.
 * Provides consistent and type-safe query keys for cache management.
 */
export const statisticsKeys = {
  /** Base key for all statistics queries */
  all: ['statistics'] as const,

  /** Key for statistics list queries */
  lists: () => [...statisticsKeys.all, 'list'] as const,

  /** Key for filtered statistics list query */
  list: (params: StatisticQueryParams) => [...statisticsKeys.lists(), params] as const,

  /** Key for single statistic queries */
  details: () => [...statisticsKeys.all, 'detail'] as const,

  /** Key for specific statistic by ID */
  detail: (id: number) => [...statisticsKeys.details(), id] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook to fetch a paginated list of statistics with filtering.
 *
 * Supports multi-dimensional filtering by:
 * - Time: year, year_from, year_to, quarter, month
 * - Geography: region_code, region_level
 * - Industry: industry_code, industry_level
 * - Dataset: dataset_id, value_label
 *
 * @param params - Query filter parameters
 * @param options - Additional TanStack Query options
 * @returns Query result with statistics list
 *
 * @example
 * const { data, isLoading, error } = useStatistics({
 *   dataset_id: 'population',
 *   year_from: 2020,
 *   year_to: 2023,
 *   region_level: 'maakunta',
 *   page: 1,
 *   page_size: 100,
 * });
 */
export function useStatistics(
  params: StatisticQueryParams = {},
  options?: Omit<UseQueryOptions<StatisticListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: statisticsKeys.list(params),
    queryFn: async () => {
      const queryString = buildQueryString(params as Record<string, string | number | null | undefined>);
      return apiClient.get<StatisticListResponse>(`/statistics${queryString}`);
    },
    ...options,
  });
}

/**
 * Hook to fetch a single statistic by ID.
 *
 * @param id - Statistic ID
 * @param options - Additional TanStack Query options
 * @returns Query result with statistic data
 *
 * @example
 * const { data: statistic, isLoading } = useStatistic(12345);
 */
export function useStatistic(
  id: number,
  options?: Omit<UseQueryOptions<StatisticResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: statisticsKeys.detail(id),
    queryFn: () => apiClient.get<StatisticResponse>(`/statistics/${id}`),
    enabled: id !== undefined && id !== null,
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook to create a new statistic data point.
 *
 * @param options - Additional TanStack Query mutation options
 * @returns Mutation object with mutate function
 *
 * @example
 * const { mutate: createStatistic, isPending } = useCreateStatistic();
 *
 * createStatistic({
 *   dataset_id: 'population',
 *   year: 2023,
 *   region_code: 'KU091',
 *   value: 658457,
 * });
 */
export function useCreateStatistic(
  options?: Omit<UseMutationOptions<StatisticResponse, Error, StatisticCreate>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StatisticCreate) =>
      apiClient.post<StatisticResponse>('/statistics', data),
    onSuccess: () => {
      // Invalidate all statistics lists to refetch with new data
      queryClient.invalidateQueries({ queryKey: statisticsKeys.lists() });
    },
    ...options,
  });
}

/**
 * Hook to delete a statistic data point.
 *
 * @param options - Additional TanStack Query mutation options
 * @returns Mutation object with mutate function
 *
 * @example
 * const { mutate: deleteStatistic, isPending } = useDeleteStatistic();
 * deleteStatistic(12345);
 */
export function useDeleteStatistic(
  options?: Omit<UseMutationOptions<MessageResponse, Error, number>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete<MessageResponse>(`/statistics/${id}`),
    onSuccess: (_data, id) => {
      // Invalidate all statistics lists
      queryClient.invalidateQueries({ queryKey: statisticsKeys.lists() });
      // Remove the specific statistic from cache
      queryClient.removeQueries({ queryKey: statisticsKeys.detail(id) });
    },
    ...options,
  });
}
