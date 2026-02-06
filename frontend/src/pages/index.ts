/**
 * Central export point for all page components.
 *
 * This module re-exports all page components used in the application routing:
 * - Dashboard: Main statistics visualization page
 * - FetchConfig: StatFin dataset configuration page
 * - MapView: Geographic visualization page
 *
 * @example
 * import { Dashboard, FetchConfig, MapView } from './pages';
 */

export { default as Dashboard } from './Dashboard';
export { default as FetchConfig } from './FetchConfig';
export { default as MapView } from './MapView';
