/**
 * Central export point for all React Contexts.
 *
 * This module re-exports all context providers and hooks:
 * - FilterContext: Shared filter state management
 *
 * @example
 * import { FilterProvider, useFilterContext } from '@/context';
 */

// Filter context and provider
export {
  FilterContext,
  FilterProvider,
  useFilterContext,
  type FilterState,
  type FilterAction,
  type FilterContextValue,
  type FilterProviderProps,
  type RegionLevel,
  type IndustryLevel,
  type TimeResolution,
} from './FilterContext';
