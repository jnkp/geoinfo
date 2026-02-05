/**
 * TypeScript types for API request/response data structures.
 *
 * This module provides TypeScript interfaces for API data:
 * - Dataset types: Create, update, and response types for dataset metadata
 * - Statistic types: Response types and query filters for statistics data
 * - Region types: Response types for geographic dimension data
 * - Industry types: Response types for industry dimension data
 * - FetchConfig types: Create, update, and response types for fetch configurations
 *
 * These types mirror the backend Pydantic schemas in backend/api/schemas.py
 */

// =============================================================================
// Region Types
// =============================================================================

/** Base interface for region data */
export interface RegionBase {
  /** Statistics Finland official region code */
  code: string;
  /** Finnish name of the region */
  name_fi: string;
  /** Swedish name of the region */
  name_sv: string | null;
  /** English name of the region */
  name_en: string | null;
  /** Administrative level: kunta, seutukunta, or maakunta */
  region_level: string;
  /** Parent region code for hierarchy traversal */
  parent_code: string | null;
}

/** Interface for creating a new region */
export interface RegionCreate extends RegionBase {
  /** GeoJSON geometry for map rendering */
  geometry_json?: string | null;
}

/** Interface for region API response */
export interface RegionResponse extends RegionBase {
  /** GeoJSON geometry for map rendering */
  geometry_json: string | null;
}

/** Interface for paginated region list response */
export interface RegionListResponse {
  items: RegionResponse[];
  total: number;
  page: number;
  page_size: number;
}

// =============================================================================
// Industry Types
// =============================================================================

/** Base interface for industry data */
export interface IndustryBase {
  /** TOL 2008 industry code */
  code: string;
  /** Finnish name of the industry */
  name_fi: string;
  /** Swedish name of the industry */
  name_sv: string | null;
  /** English name of the industry */
  name_en: string | null;
  /** Classification level: section, division, group, or class */
  level: string;
  /** Parent industry code for hierarchy traversal */
  parent_code: string | null;
}

/** Interface for creating a new industry */
export interface IndustryCreate extends IndustryBase {
  /** Extended description of the industry classification */
  description?: string | null;
}

/** Interface for industry API response */
export interface IndustryResponse extends IndustryBase {
  /** Extended description of the industry classification */
  description: string | null;
}

/** Interface for paginated industry list response */
export interface IndustryListResponse {
  items: IndustryResponse[];
  total: number;
  page: number;
  page_size: number;
}

// =============================================================================
// Dataset Types
// =============================================================================

/** Base interface for dataset metadata */
export interface DatasetBase {
  /** Original StatFin table identifier */
  statfin_table_id: string;
  /** Finnish name of the dataset */
  name_fi: string;
  /** Swedish name of the dataset */
  name_sv: string | null;
  /** English name of the dataset */
  name_en: string | null;
  /** Extended description of the dataset content */
  description: string | null;
  /** URL to the original StatFin data source */
  source_url: string | null;
  /** Temporal granularity: year, quarter, or month */
  time_resolution: string;
  /** Whether dataset includes geographic dimension */
  has_region_dimension: boolean;
  /** Whether dataset includes industry dimension */
  has_industry_dimension: boolean;
}

/** Interface for creating a new dataset */
export interface DatasetCreate extends DatasetBase {
  /** Unique identifier for the dataset */
  id: string;
}

/** Interface for updating dataset metadata (all fields optional) */
export interface DatasetUpdate {
  /** Finnish name of the dataset */
  name_fi?: string | null;
  /** Swedish name of the dataset */
  name_sv?: string | null;
  /** English name of the dataset */
  name_en?: string | null;
  /** Extended description of the dataset content */
  description?: string | null;
  /** URL to the original StatFin data source */
  source_url?: string | null;
  /** Temporal granularity: year, quarter, or month */
  time_resolution?: string | null;
  /** Whether dataset includes geographic dimension */
  has_region_dimension?: boolean | null;
  /** Whether dataset includes industry dimension */
  has_industry_dimension?: boolean | null;
}

/** Interface for dataset API response */
export interface DatasetResponse extends DatasetBase {
  /** Unique identifier for the dataset */
  id: string;
  /** Timestamp when dataset was first configured */
  created_at: string;
  /** Timestamp of last metadata update */
  updated_at: string;
}

/** Interface for paginated dataset list response */
export interface DatasetListResponse {
  items: DatasetResponse[];
  total: number;
  page: number;
  page_size: number;
}

// =============================================================================
// Statistic Types
// =============================================================================

/** Base interface for statistic data points */
export interface StatisticBase {
  /** Parent dataset identifier */
  dataset_id: string;
  /** Year of the statistic (required) */
  year: number;
  /** Quarter (1-4) for quarterly data */
  quarter: number | null;
  /** Month (1-12) for monthly data */
  month: number | null;
  /** Region code for geographic linkage */
  region_code: string | null;
  /** Industry code for sector linkage */
  industry_code: string | null;
  /** The numeric statistic value (null for missing data) */
  value: number | null;
  /** Label identifying the value type/measure within the dataset */
  value_label: string | null;
  /** Unit of measurement (e.g., 'persons', 'EUR', '%') */
  unit: string | null;
  /** Quality indicator (e.g., 'final', 'preliminary', 'estimate') */
  data_quality: string | null;
}

/** Interface for creating a new statistic data point */
export interface StatisticCreate extends StatisticBase {}

/** Interface for statistic API response */
export interface StatisticResponse extends StatisticBase {
  /** Unique identifier for the statistic */
  id: number;
  /** Timestamp when data was fetched from StatFin */
  fetched_at: string;
}

/** Interface for statistic response with embedded region data */
export interface StatisticWithRegion extends StatisticResponse {
  /** Region details for geographic dimension */
  region: RegionResponse | null;
}

/** Interface for statistic response with embedded industry data */
export interface StatisticWithIndustry extends StatisticResponse {
  /** Industry details for sector dimension */
  industry: IndustryResponse | null;
}

/** Interface for statistic response with all embedded dimension data */
export interface StatisticFull extends StatisticResponse {
  /** Region details for geographic dimension */
  region: RegionResponse | null;
  /** Industry details for sector dimension */
  industry: IndustryResponse | null;
}

/** Interface for paginated statistic list response */
export interface StatisticListResponse {
  items: StatisticResponse[];
  total: number;
  page: number;
  page_size: number;
}

/** Interface for statistic query filter parameters */
export interface StatisticQueryParams {
  /** Filter by dataset ID */
  dataset_id?: string | null;
  /** Filter by year */
  year?: number | null;
  /** Filter by minimum year */
  year_from?: number | null;
  /** Filter by maximum year */
  year_to?: number | null;
  /** Filter by quarter (1-4) */
  quarter?: number | null;
  /** Filter by month (1-12) */
  month?: number | null;
  /** Filter by region code */
  region_code?: string | null;
  /** Filter by region level (kunta, seutukunta, maakunta) */
  region_level?: string | null;
  /** Filter by industry code */
  industry_code?: string | null;
  /** Filter by industry level (section, division, group, class) */
  industry_level?: string | null;
  /** Filter by value label */
  value_label?: string | null;
  /** Page number for pagination */
  page?: number;
  /** Number of items per page */
  page_size?: number;
}

/** Interface for aggregated statistic data */
export interface StatisticAggregation {
  /** The dimension value (year, region, industry) */
  dimension_value: string;
  /** Number of data points */
  count: number;
  /** Sum of values */
  sum_value: number | null;
  /** Average of values */
  avg_value: number | null;
  /** Minimum value */
  min_value: number | null;
  /** Maximum value */
  max_value: number | null;
}

// =============================================================================
// Fetch Configuration Types
// =============================================================================

/** Base interface for fetch configuration */
export interface FetchConfigBase {
  /** User-friendly name for this fetch configuration */
  name: string;
  /** Optional description of what data is being fetched */
  description: string | null;
  /** Whether this configuration is enabled for fetching */
  is_active: boolean;
  /** Hours between fetch attempts */
  fetch_interval_hours: number;
  /** Fetch priority for queue ordering (higher = more urgent) */
  priority: number;
}

/** Interface for creating a new fetch configuration */
export interface FetchConfigCreate extends FetchConfigBase {
  /** Target dataset identifier for fetching */
  dataset_id: string;
}

/** Interface for updating fetch configuration (all fields optional) */
export interface FetchConfigUpdate {
  /** User-friendly name for this fetch configuration */
  name?: string | null;
  /** Optional description of what data is being fetched */
  description?: string | null;
  /** Whether this configuration is enabled for fetching */
  is_active?: boolean | null;
  /** Hours between fetch attempts */
  fetch_interval_hours?: number | null;
  /** Fetch priority for queue ordering (higher = more urgent) */
  priority?: number | null;
}

/** Interface for fetch configuration API response */
export interface FetchConfigResponse extends FetchConfigBase {
  /** Unique identifier for the fetch configuration */
  id: number;
  /** Target dataset identifier for fetching */
  dataset_id: string;
  /** Timestamp of last successful fetch */
  last_fetch_at: string | null;
  /** Status of the last fetch attempt (success, failed, pending) */
  last_fetch_status: string;
  /** Error message from last failed fetch */
  last_error_message: string | null;
  /** Scheduled time for next fetch attempt */
  next_fetch_at: string | null;
  /** Total number of successful fetches */
  fetch_count: number;
  /** Timestamp when configuration was created */
  created_at: string;
  /** Timestamp of last configuration update */
  updated_at: string;
}

/** Interface for fetch configuration response with embedded dataset data */
export interface FetchConfigWithDataset extends FetchConfigResponse {
  /** Target dataset details */
  dataset: DatasetResponse | null;
}

/** Interface for paginated fetch configuration list response */
export interface FetchConfigListResponse {
  items: FetchConfigResponse[];
  total: number;
  page: number;
  page_size: number;
}

// =============================================================================
// Common Response Types
// =============================================================================

/** Interface for health check endpoint response */
export interface HealthResponse {
  /** Service health status */
  status: string;
  /** Database connection status */
  database: string;
  /** Health check timestamp */
  timestamp: string;
}

/** Interface for API error responses */
export interface ErrorResponse {
  /** Error type */
  error: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  detail: string | null;
}

/** Interface for simple message responses */
export interface MessageResponse {
  /** Response message */
  message: string;
}

// =============================================================================
// StatFin API Related Types
// =============================================================================

/** Interface for StatFin table metadata */
export interface StatFinTableInfo {
  /** StatFin table identifier */
  table_id: string;
  /** Table name/description */
  text: string;
  /** Node type (table, folder) */
  type: string;
  /** Path in StatFin hierarchy */
  path: string[];
}

/** Interface for list of StatFin tables */
export interface StatFinTableListResponse {
  tables: StatFinTableInfo[];
  total: number;
}

/** Interface for a dimension value from StatFin */
export interface StatFinDimensionValue {
  /** Dimension value code */
  code: string;
  /** Dimension value text/label */
  text: string;
}

/** Interface for a dimension from StatFin table metadata */
export interface StatFinDimension {
  /** Dimension name */
  name: string;
  /** Dimension display text */
  text: string;
  /** Available dimension values */
  values: StatFinDimensionValue[];
}

/** Interface for detailed StatFin table metadata */
export interface StatFinTableMetadata {
  /** StatFin table identifier */
  table_id: string;
  /** Table title */
  title: string;
  /** Available dimensions */
  dimensions: StatFinDimension[];
  /** Last update timestamp */
  last_updated: string | null;
  /** Data source information */
  source: string | null;
}
