/**
 * TanStack Query hooks for StatFin API browsing operations.
 *
 * This module provides React hooks for:
 * - Listing and browsing StatFin tables
 * - Fetching table metadata
 * - Managing fetch configurations
 *
 * Uses TanStack Query v5 for data fetching with caching and invalidation.
 *
 * @example
 * // Browse StatFin tables
 * const { data, isLoading } = useStatFinTables({ path: '' });
 *
 * // Navigate into a folder
 * const { data: subTables } = useStatFinTables({ path: 'vaerak' });
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
  StatFinTableListResponse,
  StatFinTableMetadata,
  FetchConfigResponse,
  FetchConfigListResponse,
  FetchConfigCreate,
  FetchConfigUpdate,
  MessageResponse,
} from '../types/api';

// =============================================================================
// Types
// =============================================================================

/** Parameters for listing StatFin tables */
export interface StatFinTableListParams {
  /** Path in the StatFin hierarchy (empty string for root) */
  path?: string;
}

/** Parameters for listing fetch configurations */
export interface FetchConfigListParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  page_size?: number;
  /** Filter by active status */
  is_active?: boolean | null;
}

// =============================================================================
// Query Keys
// =============================================================================

/**
 * Query key factory for StatFin table queries.
 * Provides consistent and type-safe query keys for cache management.
 */
export const statfinKeys = {
  /** Base key for all StatFin queries */
  all: ['statfin'] as const,

  /** Key for table list queries */
  tables: () => [...statfinKeys.all, 'tables'] as const,

  /** Key for table list at specific path */
  tableList: (path: string) => [...statfinKeys.tables(), path] as const,

  /** Key for table metadata queries */
  metadata: () => [...statfinKeys.all, 'metadata'] as const,

  /** Key for specific table metadata */
  tableMetadata: (tableId: string) => [...statfinKeys.metadata(), tableId] as const,
};

/**
 * Query key factory for fetch configuration queries.
 * Provides consistent and type-safe query keys for cache management.
 */
export const fetchConfigKeys = {
  /** Base key for all fetch config queries */
  all: ['fetchConfigs'] as const,

  /** Key for fetch config list queries */
  lists: () => [...fetchConfigKeys.all, 'list'] as const,

  /** Key for filtered fetch config list query */
  list: (params: FetchConfigListParams) => [...fetchConfigKeys.lists(), params] as const,

  /** Key for single fetch config queries */
  details: () => [...fetchConfigKeys.all, 'detail'] as const,

  /** Key for specific fetch config by ID */
  detail: (id: number) => [...fetchConfigKeys.details(), id] as const,
};

// =============================================================================
// StatFin Table Query Hooks
// =============================================================================

/**
 * Hook to fetch StatFin tables at a given path.
 *
 * The StatFin API organizes tables in a hierarchical structure with folders
 * and tables. Use an empty string path for the root level.
 *
 * @param params - Query parameters including the path
 * @param options - Additional TanStack Query options
 * @returns Query result with table list
 *
 * @example
 * // Get root level tables/folders
 * const { data, isLoading } = useStatFinTables({ path: '' });
 *
 * // Navigate into a folder
 * const { data: subTables } = useStatFinTables({ path: 'vaerak' });
 */
export function useStatFinTables(
  params: StatFinTableListParams = {},
  options?: Omit<UseQueryOptions<StatFinTableListResponse>, 'queryKey' | 'queryFn'>
) {
  const path = params.path ?? '';

  return useQuery({
    queryKey: statfinKeys.tableList(path),
    queryFn: async () => {
      const queryString = buildQueryString({ path } as Record<string, string | number | null | undefined>);
      return apiClient.get<StatFinTableListResponse>(`/statfin/tables${queryString}`);
    },
    staleTime: 10 * 60 * 1000, // StatFin table structure rarely changes, cache for 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch metadata for a specific StatFin table.
 *
 * @param tableId - The StatFin table identifier
 * @param options - Additional TanStack Query options
 * @returns Query result with table metadata including dimensions
 *
 * @example
 * const { data: metadata } = useStatFinTableMetadata('statfin_vaerak_pxt_11ra.px');
 *
 * if (metadata) {
 *   console.log(metadata.dimensions); // Available dimensions for the table
 * }
 */
export function useStatFinTableMetadata(
  tableId: string,
  options?: Omit<UseQueryOptions<StatFinTableMetadata>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: statfinKeys.tableMetadata(tableId),
    queryFn: () => apiClient.get<StatFinTableMetadata>(`/statfin/tables/${encodeURIComponent(tableId)}/metadata`),
    enabled: Boolean(tableId),
    staleTime: 10 * 60 * 1000, // Table metadata rarely changes
    ...options,
  });
}

// =============================================================================
// Fetch Configuration Query Hooks
// =============================================================================

/**
 * Hook to fetch a paginated list of fetch configurations.
 *
 * @param params - Pagination and filter parameters
 * @param options - Additional TanStack Query options
 * @returns Query result with fetch configuration list
 *
 * @example
 * const { data, isLoading } = useFetchConfigs({ page: 1, page_size: 20 });
 *
 * // Filter by active status
 * const { data: activeConfigs } = useFetchConfigs({ is_active: true });
 */
export function useFetchConfigs(
  params: FetchConfigListParams = {},
  options?: Omit<UseQueryOptions<FetchConfigListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: fetchConfigKeys.list(params),
    queryFn: async () => {
      const queryString = buildQueryString(params as Record<string, string | number | boolean | null | undefined>);
      return apiClient.get<FetchConfigListResponse>(`/fetch-configs${queryString}`);
    },
    ...options,
  });
}

/**
 * Hook to fetch a single fetch configuration by ID.
 *
 * @param id - Fetch configuration ID
 * @param options - Additional TanStack Query options
 * @returns Query result with fetch configuration data
 *
 * @example
 * const { data: config } = useFetchConfig(1);
 */
export function useFetchConfig(
  id: number,
  options?: Omit<UseQueryOptions<FetchConfigResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: fetchConfigKeys.detail(id),
    queryFn: () => apiClient.get<FetchConfigResponse>(`/fetch-configs/${id}`),
    enabled: id !== undefined && id !== null && id > 0,
    ...options,
  });
}

// =============================================================================
// Fetch Configuration Mutation Hooks
// =============================================================================

/**
 * Hook to create a new fetch configuration.
 *
 * @param options - Additional TanStack Query mutation options
 * @returns Mutation object with mutate function
 *
 * @example
 * const { mutate: createConfig, isPending } = useCreateFetchConfig();
 *
 * createConfig({
 *   dataset_id: 'population',
 *   name: 'Population Statistics',
 *   description: 'Finnish population data',
 *   is_active: true,
 *   fetch_interval_hours: 24,
 *   priority: 1,
 * });
 */
export function useCreateFetchConfig(
  options?: Omit<UseMutationOptions<FetchConfigResponse, Error, FetchConfigCreate>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FetchConfigCreate) =>
      apiClient.post<FetchConfigResponse>('/fetch-configs', data),
    onSuccess: (newConfig) => {
      // Invalidate all fetch config lists to refetch with new data
      queryClient.invalidateQueries({ queryKey: fetchConfigKeys.lists() });
      // Set the new config in cache
      queryClient.setQueryData(fetchConfigKeys.detail(newConfig.id), newConfig);
    },
    ...options,
  });
}

/**
 * Hook to update an existing fetch configuration.
 *
 * @param options - Additional TanStack Query mutation options
 * @returns Mutation object with mutate function
 *
 * @example
 * const { mutate: updateConfig, isPending } = useUpdateFetchConfig();
 *
 * updateConfig({
 *   id: 1,
 *   data: { is_active: false },
 * });
 */
export function useUpdateFetchConfig(
  options?: Omit<
    UseMutationOptions<FetchConfigResponse, Error, { id: number; data: FetchConfigUpdate }>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FetchConfigUpdate }) =>
      apiClient.patch<FetchConfigResponse>(`/fetch-configs/${id}`, data),
    onSuccess: (updatedConfig, { id }) => {
      // Invalidate all fetch config lists
      queryClient.invalidateQueries({ queryKey: fetchConfigKeys.lists() });
      // Update the specific config in cache
      queryClient.setQueryData(fetchConfigKeys.detail(id), updatedConfig);
    },
    ...options,
  });
}

/**
 * Hook to delete a fetch configuration.
 *
 * @param options - Additional TanStack Query mutation options
 * @returns Mutation object with mutate function
 *
 * @example
 * const { mutate: deleteConfig, isPending } = useDeleteFetchConfig();
 *
 * deleteConfig(1, {
 *   onSuccess: () => {
 *     toast.success('Configuration deleted');
 *   },
 * });
 */
export function useDeleteFetchConfig(
  options?: Omit<UseMutationOptions<MessageResponse, Error, number>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete<MessageResponse>(`/fetch-configs/${id}`),
    onSuccess: (_data, id) => {
      // Invalidate all fetch config lists
      queryClient.invalidateQueries({ queryKey: fetchConfigKeys.lists() });
      // Remove the specific config from cache
      queryClient.removeQueries({ queryKey: fetchConfigKeys.detail(id) });
    },
    ...options,
  });
}
