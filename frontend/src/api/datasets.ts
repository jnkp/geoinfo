/**
 * TanStack Query hooks for dataset API operations.
 *
 * This module provides React hooks for:
 * - Listing datasets with pagination
 * - Fetching individual dataset details
 * - Creating, updating, and deleting datasets
 *
 * Uses TanStack Query v5 for data fetching with caching and invalidation.
 *
 * @example
 * // List datasets
 * const { data, isLoading } = useDatasets({ page: 1, page_size: 20 });
 *
 * // Get single dataset
 * const { data: dataset } = useDataset('population');
 *
 * // Create dataset
 * const { mutate: createDataset } = useCreateDataset();
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
  DatasetResponse,
  DatasetListResponse,
  DatasetCreate,
  DatasetUpdate,
  MessageResponse,
} from '../types/api';

// =============================================================================
// Types
// =============================================================================

/** Parameters for listing datasets */
export interface DatasetListParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  page_size?: number;
}

// =============================================================================
// Query Keys
// =============================================================================

/**
 * Query key factory for dataset queries.
 * Provides consistent and type-safe query keys for cache management.
 */
export const datasetsKeys = {
  /** Base key for all dataset queries */
  all: ['datasets'] as const,

  /** Key for dataset list queries */
  lists: () => [...datasetsKeys.all, 'list'] as const,

  /** Key for filtered dataset list query */
  list: (params: DatasetListParams) => [...datasetsKeys.lists(), params] as const,

  /** Key for single dataset queries */
  details: () => [...datasetsKeys.all, 'detail'] as const,

  /** Key for specific dataset by ID */
  detail: (id: string) => [...datasetsKeys.details(), id] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook to fetch a paginated list of datasets.
 *
 * @param params - Pagination parameters
 * @param options - Additional TanStack Query options
 * @returns Query result with dataset list
 *
 * @example
 * const { data, isLoading, error } = useDatasets({ page: 1, page_size: 20 });
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <ul>
 *     {data.items.map(dataset => (
 *       <li key={dataset.id}>{dataset.name_fi}</li>
 *     ))}
 *   </ul>
 * );
 */
export function useDatasets(
  params: DatasetListParams = {},
  options?: Omit<UseQueryOptions<DatasetListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: datasetsKeys.list(params),
    queryFn: async () => {
      const queryString = buildQueryString(params as Record<string, string | number | null | undefined>);
      return apiClient.get<DatasetListResponse>(`/datasets${queryString}`);
    },
    ...options,
  });
}

/**
 * Hook to fetch a single dataset by ID.
 *
 * @param id - Dataset ID
 * @param options - Additional TanStack Query options
 * @returns Query result with dataset data
 *
 * @example
 * const { data: dataset, isLoading } = useDataset('population');
 *
 * if (dataset) {
 *   console.log(dataset.name_fi); // 'Vakiluku'
 * }
 */
export function useDataset(
  id: string,
  options?: Omit<UseQueryOptions<DatasetResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: datasetsKeys.detail(id),
    queryFn: () => apiClient.get<DatasetResponse>(`/datasets/${id}`),
    enabled: Boolean(id),
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook to create a new dataset.
 *
 * @param options - Additional TanStack Query mutation options
 * @returns Mutation object with mutate function
 *
 * @example
 * const { mutate: createDataset, isPending } = useCreateDataset();
 *
 * createDataset({
 *   id: 'new-dataset',
 *   statfin_table_id: '11ra',
 *   name_fi: 'Uusi aineisto',
 *   name_sv: null,
 *   name_en: 'New Dataset',
 *   description: null,
 *   source_url: null,
 *   time_resolution: 'year',
 *   has_region_dimension: true,
 *   has_industry_dimension: false,
 * });
 */
export function useCreateDataset(
  options?: Omit<UseMutationOptions<DatasetResponse, Error, DatasetCreate>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DatasetCreate) =>
      apiClient.post<DatasetResponse>('/datasets', data),
    onSuccess: (newDataset) => {
      // Invalidate all dataset lists to refetch with new data
      queryClient.invalidateQueries({ queryKey: datasetsKeys.lists() });
      // Optionally set the new dataset in cache
      queryClient.setQueryData(datasetsKeys.detail(newDataset.id), newDataset);
    },
    ...options,
  });
}

/**
 * Hook to update an existing dataset.
 *
 * @param options - Additional TanStack Query mutation options
 * @returns Mutation object with mutate function
 *
 * @example
 * const { mutate: updateDataset, isPending } = useUpdateDataset();
 *
 * updateDataset({
 *   id: 'population',
 *   data: { name_fi: 'Updated Name' },
 * });
 */
export function useUpdateDataset(
  options?: Omit<
    UseMutationOptions<DatasetResponse, Error, { id: string; data: DatasetUpdate }>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DatasetUpdate }) =>
      apiClient.patch<DatasetResponse>(`/datasets/${id}`, data),
    onSuccess: (updatedDataset, { id }) => {
      // Invalidate all dataset lists
      queryClient.invalidateQueries({ queryKey: datasetsKeys.lists() });
      // Update the specific dataset in cache
      queryClient.setQueryData(datasetsKeys.detail(id), updatedDataset);
    },
    ...options,
  });
}

/**
 * Hook to delete a dataset.
 *
 * @param options - Additional TanStack Query mutation options
 * @returns Mutation object with mutate function
 *
 * @example
 * const { mutate: deleteDataset, isPending } = useDeleteDataset();
 *
 * deleteDataset('obsolete-dataset', {
 *   onSuccess: () => {
 *     toast.success('Dataset deleted');
 *   },
 * });
 */
export function useDeleteDataset(
  options?: Omit<UseMutationOptions<MessageResponse, Error, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<MessageResponse>(`/datasets/${id}`),
    onSuccess: (_data, id) => {
      // Invalidate all dataset lists
      queryClient.invalidateQueries({ queryKey: datasetsKeys.lists() });
      // Remove the specific dataset from cache
      queryClient.removeQueries({ queryKey: datasetsKeys.detail(id) });
    },
    ...options,
  });
}
