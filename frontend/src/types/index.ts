/**
 * Central export point for all TypeScript types.
 *
 * This module re-exports all types from specialized type modules
 * to provide a single import point for consumers:
 *
 * @example
 * import { DatasetResponse, RegionResponse } from '@/types';
 */

// API data structure types
export type {
  // Region types
  RegionBase,
  RegionCreate,
  RegionResponse,
  RegionListResponse,
  // Industry types
  IndustryBase,
  IndustryCreate,
  IndustryResponse,
  IndustryListResponse,
  // Dataset types
  DatasetBase,
  DatasetCreate,
  DatasetUpdate,
  DatasetResponse,
  DatasetListResponse,
  // Statistic types
  StatisticBase,
  StatisticCreate,
  StatisticResponse,
  StatisticWithRegion,
  StatisticWithIndustry,
  StatisticFull,
  StatisticListResponse,
  StatisticQueryParams,
  StatisticAggregation,
  // Fetch configuration types
  FetchConfigBase,
  FetchConfigCreate,
  FetchConfigUpdate,
  FetchConfigResponse,
  FetchConfigWithDataset,
  FetchConfigListResponse,
  // Common response types
  HealthResponse,
  ErrorResponse,
  MessageResponse,
  // StatFin API types
  StatFinTableInfo,
  StatFinTableListResponse,
  StatFinDimensionValue,
  StatFinDimension,
  StatFinTableMetadata,
} from './api';
