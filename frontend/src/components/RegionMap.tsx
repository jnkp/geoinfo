/**
 * Finnish region map component with Leaflet and GeoJSON.
 *
 * This component provides:
 * - Interactive map centered on Finland
 * - GeoJSON layer for region boundaries (maakunta, seutukunta, kunta)
 * - Choropleth coloring based on data values
 * - Click interaction for region selection
 * - Integration with FilterContext for region filtering
 * - Hover tooltips with region information
 *
 * @example
 * // Basic usage
 * <RegionMap />
 *
 * // With custom height and level
 * <RegionMap height={600} regionLevel="seutukunta" />
 *
 * // With data for choropleth coloring
 * <RegionMap data={regionDataMap} />
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { Map as LeafletMap, PathOptions, Layer } from 'leaflet';
import type { Feature, Geometry, GeoJsonProperties, FeatureCollection } from 'geojson';
import { useFilterContext, type RegionLevel } from '../context/FilterContext';

// Import Leaflet CSS (required for proper map rendering)
import 'leaflet/dist/leaflet.css';

// =============================================================================
// Types
// =============================================================================

export interface RegionMapProps {
  /** Map height in pixels */
  height?: number;
  /** Region level to display */
  regionLevel?: RegionLevel;
  /** Data values keyed by region code for choropleth coloring */
  data?: Map<string, number> | Record<string, number>;
  /** Color scale for choropleth (array of hex colors from low to high) */
  colorScale?: string[];
  /** Minimum value for color scale (auto-calculated if not provided) */
  minValue?: number;
  /** Maximum value for color scale (auto-calculated if not provided) */
  maxValue?: number;
  /** Callback when a region is clicked */
  onRegionClick?: (regionCode: string, regionName: string) => void;
  /** Callback when a region is hovered */
  onRegionHover?: (regionCode: string | null, regionName: string | null) => void;
  /** Whether the map interaction is disabled */
  disabled?: boolean;
  /** Whether to show zoom controls */
  showZoomControls?: boolean;
  /** Whether to show tile layer (OpenStreetMap) */
  showTileLayer?: boolean;
  /** Custom GeoJSON data (overrides built-in finland-regions) */
  customGeoJSON?: FeatureCollection;
}

/** Region feature properties from GeoJSON */
interface RegionProperties extends GeoJsonProperties {
  code: string;
  name_fi: string;
  name_sv?: string;
  name_en?: string;
  level: RegionLevel;
}

/** Extended feature type with our properties */
type RegionFeature = Feature<Geometry, RegionProperties>;

// =============================================================================
// Constants
// =============================================================================

/** Finland center coordinates */
const FINLAND_CENTER: [number, number] = [64.5, 26.0];

/** Default zoom level for Finland */
const DEFAULT_ZOOM = 5;

/** Default color scale (sequential red-orange) */
const DEFAULT_COLOR_SCALE = [
  '#fee5d9', // Very light
  '#fcbba1', // Light
  '#fc9272', // Medium-light
  '#fb6a4a', // Medium
  '#ef3b2c', // Medium-dark
  '#cb181d', // Dark
  '#99000d', // Very dark
];

/** Default style for region features */
const DEFAULT_STYLE: PathOptions = {
  fillColor: '#cbd5e1',
  fillOpacity: 0.6,
  color: '#64748b',
  weight: 1,
  opacity: 1,
};

/** Hover style for region features */
const HOVER_STYLE: PathOptions = {
  fillOpacity: 0.8,
  weight: 2,
  color: '#1e40af',
};

/** Selected style for region features */
const SELECTED_STYLE: PathOptions = {
  fillOpacity: 0.9,
  weight: 3,
  color: '#1e3a8a',
};

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    position: 'relative' as const,
    width: '100%',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '1px solid var(--color-gray-200)',
    backgroundColor: 'var(--color-gray-100)',
  },
  mapContainer: {
    width: '100%',
    height: '100%',
  },
  tooltip: {
    position: 'absolute' as const,
    zIndex: 1000,
    backgroundColor: 'var(--color-white)',
    padding: 'var(--spacing-2) var(--spacing-3)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-lg)',
    pointerEvents: 'none' as const,
    fontSize: 'var(--font-size-sm)',
    maxWidth: '200px',
  },
  tooltipTitle: {
    fontWeight: 600,
    color: 'var(--color-gray-900)',
    marginBottom: 'var(--spacing-1)',
  },
  tooltipValue: {
    color: 'var(--color-gray-600)',
    fontSize: 'var(--font-size-xs)',
  },
  loading: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 500,
  },
  error: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center' as const,
    color: 'var(--color-error)',
  },
  legend: {
    position: 'absolute' as const,
    bottom: 'var(--spacing-4)',
    left: 'var(--spacing-4)',
    backgroundColor: 'var(--color-white)',
    padding: 'var(--spacing-3)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    zIndex: 1000,
    minWidth: '120px',
  },
  legendTitle: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    marginBottom: 'var(--spacing-2)',
    color: 'var(--color-gray-700)',
  },
  legendScale: {
    display: 'flex',
    gap: '1px',
  },
  legendColor: {
    flex: 1,
    height: '12px',
  },
  legendLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-gray-500)',
    marginTop: 'var(--spacing-1)',
  },
};

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Component to fit map bounds to Finland
 */
function FitBounds({ geoJSON }: { geoJSON: FeatureCollection | null }) {
  const map = useMap();

  useEffect(() => {
    if (geoJSON && geoJSON.features.length > 0) {
      // Create bounds from all features
      const bounds = geoJSON.features.reduce(
        (acc, feature) => {
          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach((coord) => {
              if (coord[1] < acc.minLat) acc.minLat = coord[1];
              if (coord[1] > acc.maxLat) acc.maxLat = coord[1];
              if (coord[0] < acc.minLng) acc.minLng = coord[0];
              if (coord[0] > acc.maxLng) acc.maxLng = coord[0];
            });
          } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((polygon) => {
              polygon[0].forEach((coord) => {
                if (coord[1] < acc.minLat) acc.minLat = coord[1];
                if (coord[1] > acc.maxLat) acc.maxLat = coord[1];
                if (coord[0] < acc.minLng) acc.minLng = coord[0];
                if (coord[0] > acc.maxLng) acc.maxLng = coord[0];
              });
            });
          }
          return acc;
        },
        { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 }
      );

      map.fitBounds([
        [bounds.minLat, bounds.minLng],
        [bounds.maxLat, bounds.maxLng],
      ]);
    }
  }, [map, geoJSON]);

  return null;
}

/**
 * Legend component for map color scale
 */
interface MapLegendProps {
  colorScale: string[];
  minValue: number;
  maxValue: number;
  title?: string;
}

function MapLegend({ colorScale, minValue, maxValue, title = 'Value' }: MapLegendProps) {
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  return (
    <div style={styles.legend}>
      <div style={styles.legendTitle}>{title}</div>
      <div style={styles.legendScale}>
        {colorScale.map((color, index) => (
          <div
            key={index}
            style={{
              ...styles.legendColor,
              backgroundColor: color,
            }}
          />
        ))}
      </div>
      <div style={styles.legendLabels}>
        <span>{formatValue(minValue)}</span>
        <span>{formatValue(maxValue)}</span>
      </div>
    </div>
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get color for a value based on color scale
 */
function getColorForValue(
  value: number | undefined,
  minValue: number,
  maxValue: number,
  colorScale: string[]
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return DEFAULT_STYLE.fillColor || '#cbd5e1';
  }

  const range = maxValue - minValue;
  if (range === 0) return colorScale[Math.floor(colorScale.length / 2)];

  const normalized = (value - minValue) / range;
  const index = Math.min(
    Math.floor(normalized * colorScale.length),
    colorScale.length - 1
  );

  return colorScale[Math.max(0, index)];
}

/**
 * Calculate min and max values from data
 */
function calculateValueRange(data: Map<string, number> | Record<string, number> | undefined): {
  min: number;
  max: number;
} {
  if (!data) return { min: 0, max: 100 };

  const values = data instanceof Map ? Array.from(data.values()) : Object.values(data);
  const validValues = values.filter((v) => typeof v === 'number' && !isNaN(v));

  if (validValues.length === 0) return { min: 0, max: 100 };

  return {
    min: Math.min(...validValues),
    max: Math.max(...validValues),
  };
}

// =============================================================================
// Built-in GeoJSON Data
// =============================================================================

/**
 * Built-in Finnish maakunta (region) boundaries.
 * Simplified GeoJSON for the 19 Finnish regions.
 */
const FINLAND_REGIONS_GEOJSON: FeatureCollection<Geometry, RegionProperties> = {
  type: 'FeatureCollection',
  features: [
    // Uusimaa (Helsinki region)
    {
      type: 'Feature',
      properties: { code: 'MK01', name_fi: 'Uusimaa', name_sv: 'Nyland', name_en: 'Uusimaa', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[24.0, 59.8], [25.8, 59.8], [26.2, 60.3], [25.5, 60.8], [24.8, 60.9], [23.8, 60.5], [23.5, 60.0], [24.0, 59.8]]],
      },
    },
    // Varsinais-Suomi (Southwest Finland)
    {
      type: 'Feature',
      properties: { code: 'MK02', name_fi: 'Varsinais-Suomi', name_sv: 'Egentliga Finland', name_en: 'Southwest Finland', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[21.0, 59.8], [23.0, 59.8], [23.5, 60.0], [23.8, 60.5], [23.0, 61.0], [21.5, 61.0], [20.5, 60.5], [21.0, 59.8]]],
      },
    },
    // Satakunta
    {
      type: 'Feature',
      properties: { code: 'MK04', name_fi: 'Satakunta', name_sv: 'Satakunta', name_en: 'Satakunta', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[21.0, 61.0], [23.0, 61.0], [23.0, 62.0], [22.0, 62.3], [21.0, 62.0], [20.5, 61.5], [21.0, 61.0]]],
      },
    },
    // Kanta-Häme
    {
      type: 'Feature',
      properties: { code: 'MK05', name_fi: 'Kanta-Häme', name_sv: 'Egentliga Tavastland', name_en: 'Tavastia Proper', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[23.8, 60.5], [24.8, 60.9], [25.0, 61.3], [24.2, 61.5], [23.5, 61.2], [23.0, 61.0], [23.8, 60.5]]],
      },
    },
    // Pirkanmaa (Tampere region)
    {
      type: 'Feature',
      properties: { code: 'MK06', name_fi: 'Pirkanmaa', name_sv: 'Birkaland', name_en: 'Pirkanmaa', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[23.0, 61.0], [24.2, 61.5], [24.5, 62.2], [23.5, 62.5], [22.5, 62.2], [22.0, 62.3], [23.0, 62.0], [23.0, 61.0]]],
      },
    },
    // Päijät-Häme (Lahti region)
    {
      type: 'Feature',
      properties: { code: 'MK07', name_fi: 'Päijät-Häme', name_sv: 'Päijänne-Tavastland', name_en: 'Päijänne Tavastia', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[24.8, 60.9], [25.5, 60.8], [26.0, 61.2], [25.8, 61.6], [25.0, 61.3], [24.8, 60.9]]],
      },
    },
    // Kymenlaakso
    {
      type: 'Feature',
      properties: { code: 'MK08', name_fi: 'Kymenlaakso', name_sv: 'Kymmenedalen', name_en: 'Kymenlaakso', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[26.2, 60.3], [27.5, 60.5], [27.8, 61.0], [27.0, 61.3], [26.0, 61.2], [25.5, 60.8], [26.2, 60.3]]],
      },
    },
    // Etelä-Karjala (South Karelia)
    {
      type: 'Feature',
      properties: { code: 'MK09', name_fi: 'Etelä-Karjala', name_sv: 'Södra Karelen', name_en: 'South Karelia', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[27.5, 60.5], [29.0, 60.8], [29.5, 61.5], [28.5, 61.8], [27.0, 61.3], [27.8, 61.0], [27.5, 60.5]]],
      },
    },
    // Etelä-Savo (South Savo)
    {
      type: 'Feature',
      properties: { code: 'MK10', name_fi: 'Etelä-Savo', name_sv: 'Södra Savolax', name_en: 'South Savo', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[26.0, 61.2], [27.0, 61.3], [28.5, 61.8], [29.0, 62.5], [27.5, 62.8], [26.0, 62.5], [25.8, 61.6], [26.0, 61.2]]],
      },
    },
    // Pohjois-Savo (North Savo)
    {
      type: 'Feature',
      properties: { code: 'MK11', name_fi: 'Pohjois-Savo', name_sv: 'Norra Savolax', name_en: 'North Savo', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[26.0, 62.5], [27.5, 62.8], [28.5, 63.5], [28.0, 64.0], [26.5, 64.0], [25.5, 63.5], [25.5, 62.8], [26.0, 62.5]]],
      },
    },
    // Pohjois-Karjala (North Karelia)
    {
      type: 'Feature',
      properties: { code: 'MK12', name_fi: 'Pohjois-Karjala', name_sv: 'Norra Karelen', name_en: 'North Karelia', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[28.5, 61.8], [29.5, 61.5], [31.0, 62.0], [31.5, 63.5], [30.5, 64.0], [28.5, 63.5], [29.0, 62.5], [28.5, 61.8]]],
      },
    },
    // Keski-Suomi (Central Finland)
    {
      type: 'Feature',
      properties: { code: 'MK13', name_fi: 'Keski-Suomi', name_sv: 'Mellersta Finland', name_en: 'Central Finland', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[24.5, 62.2], [25.8, 61.6], [26.0, 62.5], [25.5, 63.5], [24.5, 63.5], [23.5, 63.0], [23.5, 62.5], [24.5, 62.2]]],
      },
    },
    // Etelä-Pohjanmaa (South Ostrobothnia)
    {
      type: 'Feature',
      properties: { code: 'MK14', name_fi: 'Etelä-Pohjanmaa', name_sv: 'Södra Österbotten', name_en: 'South Ostrobothnia', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[21.5, 62.2], [23.5, 62.5], [23.5, 63.0], [22.5, 63.5], [21.5, 63.3], [21.0, 62.8], [21.5, 62.2]]],
      },
    },
    // Pohjanmaa (Ostrobothnia)
    {
      type: 'Feature',
      properties: { code: 'MK15', name_fi: 'Pohjanmaa', name_sv: 'Österbotten', name_en: 'Ostrobothnia', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[21.0, 62.8], [21.5, 63.3], [21.5, 64.0], [21.0, 64.2], [20.5, 63.5], [21.0, 62.8]]],
      },
    },
    // Keski-Pohjanmaa (Central Ostrobothnia)
    {
      type: 'Feature',
      properties: { code: 'MK16', name_fi: 'Keski-Pohjanmaa', name_sv: 'Mellersta Österbotten', name_en: 'Central Ostrobothnia', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[22.5, 63.5], [24.5, 63.5], [24.5, 64.2], [23.0, 64.5], [22.0, 64.2], [21.5, 64.0], [21.5, 63.3], [22.5, 63.5]]],
      },
    },
    // Pohjois-Pohjanmaa (North Ostrobothnia)
    {
      type: 'Feature',
      properties: { code: 'MK17', name_fi: 'Pohjois-Pohjanmaa', name_sv: 'Norra Österbotten', name_en: 'North Ostrobothnia', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[24.5, 64.2], [26.5, 64.0], [28.0, 64.0], [29.0, 65.0], [27.5, 66.0], [25.0, 66.0], [23.5, 65.5], [23.0, 64.5], [24.5, 64.2]]],
      },
    },
    // Kainuu
    {
      type: 'Feature',
      properties: { code: 'MK18', name_fi: 'Kainuu', name_sv: 'Kajanaland', name_en: 'Kainuu', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[26.5, 64.0], [28.5, 63.5], [30.5, 64.0], [30.0, 65.5], [29.0, 65.0], [28.0, 64.0], [26.5, 64.0]]],
      },
    },
    // Lappi (Lapland)
    {
      type: 'Feature',
      properties: { code: 'MK19', name_fi: 'Lappi', name_sv: 'Lappland', name_en: 'Lapland', level: 'maakunta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[23.5, 65.5], [25.0, 66.0], [27.5, 66.0], [29.0, 65.0], [30.0, 65.5], [29.5, 68.0], [28.0, 69.5], [26.0, 70.0], [24.0, 69.5], [21.0, 69.0], [20.5, 67.0], [21.5, 66.0], [23.5, 65.5]]],
      },
    },
  ],
};

// =============================================================================
// Component
// =============================================================================

/**
 * RegionMap component for displaying Finnish region boundaries with data visualization.
 *
 * Supports choropleth coloring based on data values and integrates with FilterContext
 * for region selection.
 */
export function RegionMap({
  height = 500,
  regionLevel = 'maakunta',
  data,
  colorScale = DEFAULT_COLOR_SCALE,
  minValue: propMinValue,
  maxValue: propMaxValue,
  onRegionClick,
  onRegionHover,
  disabled = false,
  showZoomControls = true,
  showTileLayer = true,
  customGeoJSON,
}: RegionMapProps) {
  const { filters, setRegion } = useFilterContext();
  const mapRef = useRef<LeafletMap | null>(null);
  const hoveredLayerRef = useRef<Layer | null>(null);

  // Use provided GeoJSON or built-in data
  const geoJSONData = useMemo(() => {
    if (customGeoJSON) return customGeoJSON;

    // Filter built-in data by region level
    if (regionLevel === 'maakunta') {
      return FINLAND_REGIONS_GEOJSON;
    }

    // For other levels, return maakunta as fallback
    // (seutukunta and kunta data would need more detailed GeoJSON)
    return FINLAND_REGIONS_GEOJSON;
  }, [customGeoJSON, regionLevel]);

  // Calculate value range
  const { min: calcMinValue, max: calcMaxValue } = useMemo(
    () => calculateValueRange(data),
    [data]
  );

  const minValue = propMinValue ?? calcMinValue;
  const maxValue = propMaxValue ?? calcMaxValue;

  // Get data value for a region
  const getRegionValue = useCallback(
    (regionCode: string): number | undefined => {
      if (!data) return undefined;
      if (data instanceof Map) return data.get(regionCode);
      return data[regionCode];
    },
    [data]
  );

  // Style function for GeoJSON features
  const styleFeature = useCallback(
    (feature: Feature<Geometry, RegionProperties> | undefined): PathOptions => {
      if (!feature?.properties) return DEFAULT_STYLE;

      const regionCode = feature.properties.code;
      const value = getRegionValue(regionCode);
      const fillColor = getColorForValue(value, minValue, maxValue, colorScale);

      // Check if this region is selected
      const isSelected = filters.regionCode === regionCode;

      return {
        ...DEFAULT_STYLE,
        fillColor,
        ...(isSelected ? SELECTED_STYLE : {}),
      };
    },
    [getRegionValue, minValue, maxValue, colorScale, filters.regionCode]
  );

  // Event handlers for each feature
  const onEachFeature = useCallback(
    (feature: RegionFeature, layer: Layer) => {
      const props = feature.properties;

      // Click handler
      layer.on('click', () => {
        if (disabled) return;

        if (onRegionClick) {
          onRegionClick(props.code, props.name_fi);
        }

        // Update filter context
        setRegion(props.code, regionLevel);
      });

      // Hover handlers
      layer.on('mouseover', () => {
        if (disabled) return;

        if (onRegionHover) {
          onRegionHover(props.code, props.name_fi);
        }

        // Apply hover style
        if ('setStyle' in layer && typeof layer.setStyle === 'function') {
          (layer as { setStyle: (style: PathOptions) => void }).setStyle(HOVER_STYLE);
          hoveredLayerRef.current = layer;
        }
      });

      layer.on('mouseout', () => {
        if (onRegionHover) {
          onRegionHover(null, null);
        }

        // Reset style
        if (hoveredLayerRef.current && 'setStyle' in hoveredLayerRef.current) {
          const resetStyle = styleFeature(feature);
          (hoveredLayerRef.current as { setStyle: (style: PathOptions) => void }).setStyle(resetStyle);
          hoveredLayerRef.current = null;
        }
      });

      // Add tooltip
      const value = getRegionValue(props.code);
      const tooltipContent = `
        <strong>${props.name_fi}</strong>
        ${props.name_sv ? `<br/><em>${props.name_sv}</em>` : ''}
        ${value !== undefined ? `<br/>Value: ${value.toLocaleString('fi-FI')}` : ''}
      `;
      layer.bindTooltip(tooltipContent, { sticky: true });
    },
    [disabled, onRegionClick, onRegionHover, setRegion, regionLevel, getRegionValue, styleFeature]
  );

  // Check if we have data for legend
  const showLegend = data && (data instanceof Map ? data.size > 0 : Object.keys(data).length > 0);

  return (
    <div style={{ ...styles.container, height: `${height}px` }}>
      <MapContainer
        center={FINLAND_CENTER}
        zoom={DEFAULT_ZOOM}
        style={styles.mapContainer}
        zoomControl={showZoomControls}
        ref={(map) => {
          mapRef.current = map ?? null;
        }}
      >
        {/* Optional tile layer */}
        {showTileLayer && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.3}
          />
        )}

        {/* GeoJSON regions */}
        {geoJSONData && (
          <GeoJSON
            key={`${regionLevel}-${JSON.stringify(data ? Object.keys(data) : [])}`}
            data={geoJSONData as FeatureCollection}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Fit bounds to Finland */}
        <FitBounds geoJSON={geoJSONData} />
      </MapContainer>

      {/* Legend */}
      {showLegend && (
        <MapLegend
          colorScale={colorScale}
          minValue={minValue}
          maxValue={maxValue}
          title="Value"
        />
      )}
    </div>
  );
}

export default RegionMap;
