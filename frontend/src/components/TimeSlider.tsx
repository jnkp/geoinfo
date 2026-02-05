/**
 * Time slider component for temporal navigation and filtering.
 *
 * This component provides:
 * - Year slider for selecting a specific year
 * - Time resolution toggle (year/quarter/month)
 * - Quarter and month selectors based on resolution
 * - Year range selection mode for time series
 * - Navigation buttons (previous/next period)
 *
 * Integrates with FilterContext for shared filter state.
 *
 * @example
 * // Basic usage
 * <TimeSlider />
 *
 * // With custom year range
 * <TimeSlider minYear={2010} maxYear={2024} />
 *
 * // Compact mode for sidebars
 * <TimeSlider compact />
 */

import { useCallback, useMemo, type ChangeEvent } from 'react';
import {
  useFilterContext,
  type TimeResolution,
} from '../context/FilterContext';

// =============================================================================
// Types
// =============================================================================

export interface TimeSliderProps {
  /** Minimum selectable year */
  minYear?: number;
  /** Maximum selectable year */
  maxYear?: number;
  /** Whether to show the time resolution selector */
  showResolutionSelector?: boolean;
  /** Whether to show the year range mode toggle */
  showRangeMode?: boolean;
  /** Whether to show navigation buttons */
  showNavigation?: boolean;
  /** Compact mode for sidebar display */
  compact?: boolean;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Custom label for the component */
  label?: string;
}

interface QuarterOption {
  value: number;
  label: string;
}

interface MonthOption {
  value: number;
  label: string;
}

// =============================================================================
// Constants
// =============================================================================

const QUARTERS: QuarterOption[] = [
  { value: 1, label: 'Q1 (Jan-Mar)' },
  { value: 2, label: 'Q2 (Apr-Jun)' },
  { value: 3, label: 'Q3 (Jul-Sep)' },
  { value: 4, label: 'Q4 (Oct-Dec)' },
];

const MONTHS: MonthOption[] = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const RESOLUTION_OPTIONS: { value: TimeResolution; label: string }[] = [
  { value: 'year', label: 'Year' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'month', label: 'Month' },
];

const DEFAULT_MIN_YEAR = 2000;
const DEFAULT_MAX_YEAR = new Date().getFullYear();

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--spacing-2)',
  },
  label: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    color: 'var(--color-gray-700)',
  },
  yearDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
  },
  yearValue: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 700,
    color: 'var(--color-primary)',
    minWidth: '60px',
    textAlign: 'center' as const,
  },
  sliderContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--spacing-2)',
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: 'var(--radius)',
    background: 'var(--color-gray-200)',
    outline: 'none',
    cursor: 'pointer',
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-gray-500)',
  },
  navigationButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-1)',
  },
  navButton: {
    padding: 'var(--spacing-1) var(--spacing-2)',
    fontSize: 'var(--font-size-sm)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  navButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  resolutionToggle: {
    display: 'flex',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    overflow: 'hidden',
  },
  resolutionButton: {
    padding: 'var(--spacing-1) var(--spacing-2)',
    fontSize: 'var(--font-size-xs)',
    border: 'none',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  resolutionButtonActive: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-white)',
  },
  secondaryControls: {
    display: 'flex',
    gap: 'var(--spacing-2)',
  },
  selectContainer: {
    flex: 1,
  },
  select: {
    width: '100%',
    padding: 'var(--spacing-2)',
    fontSize: 'var(--font-size-sm)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
  },
  rangeInputs: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
  },
  rangeInput: {
    width: '80px',
    padding: 'var(--spacing-2)',
    fontSize: 'var(--font-size-sm)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    textAlign: 'center' as const,
  },
  rangeSeparator: {
    color: 'var(--color-gray-500)',
    fontSize: 'var(--font-size-sm)',
  },
  modeToggle: {
    display: 'flex',
    gap: 'var(--spacing-2)',
    marginBottom: 'var(--spacing-2)',
  },
  modeButton: {
    padding: 'var(--spacing-1) var(--spacing-3)',
    fontSize: 'var(--font-size-xs)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-gray-300)',
    backgroundColor: 'var(--color-white)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  modeButtonActive: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-white)',
    borderColor: 'var(--color-primary)',
  },
  compact: {
    container: {
      gap: 'var(--spacing-2)',
    },
    yearValue: {
      fontSize: 'var(--font-size-lg)',
    },
  },
};

// =============================================================================
// Component
// =============================================================================

/**
 * TimeSlider component for selecting time periods.
 *
 * Supports year selection via slider, quarter/month selection via dropdowns,
 * and integrates with the filter context for state management.
 */
export function TimeSlider({
  minYear = DEFAULT_MIN_YEAR,
  maxYear = DEFAULT_MAX_YEAR,
  showResolutionSelector = true,
  showRangeMode = true,
  showNavigation = true,
  compact = false,
  disabled = false,
  label = 'Time Period',
}: TimeSliderProps) {
  const {
    filters,
    setYear,
    setYearRange,
    setQuarter,
    setMonth,
    setTimeResolution,
  } = useFilterContext();

  const { year, yearFrom, yearTo, quarter, month, timeResolution } = filters;

  // Determine if in range mode
  const isRangeMode = yearFrom !== null || yearTo !== null;

  // Get current year value for slider
  const currentYear = useMemo(() => {
    if (isRangeMode) {
      return yearTo ?? yearFrom ?? maxYear;
    }
    return year ?? maxYear;
  }, [year, yearFrom, yearTo, isRangeMode, maxYear]);

  // Format current period for display
  const periodDisplay = useMemo(() => {
    if (isRangeMode) {
      const from = yearFrom ?? '...';
      const to = yearTo ?? '...';
      return `${from} - ${to}`;
    }

    let display = year?.toString() ?? '—';

    if (timeResolution === 'quarter' && quarter !== null) {
      display = `Q${quarter} ${display}`;
    } else if (timeResolution === 'month' && month !== null) {
      const monthName = MONTHS.find((m) => m.value === month)?.label ?? '';
      display = `${monthName} ${display}`;
    }

    return display;
  }, [year, yearFrom, yearTo, quarter, month, timeResolution, isRangeMode]);

  // Handle slider change
  const handleSliderChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newYear = parseInt(e.target.value, 10);
      if (isRangeMode) {
        // In range mode, update the 'to' year
        setYearRange(yearFrom ?? minYear, newYear);
      } else {
        setYear(newYear);
      }
    },
    [isRangeMode, yearFrom, minYear, setYear, setYearRange]
  );

  // Handle range start change
  const handleRangeFromChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value ? parseInt(e.target.value, 10) : null;
      if (value === null || (value >= minYear && value <= maxYear)) {
        setYearRange(value, yearTo);
      }
    },
    [minYear, maxYear, yearTo, setYearRange]
  );

  // Handle range end change
  const handleRangeToChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value ? parseInt(e.target.value, 10) : null;
      if (value === null || (value >= minYear && value <= maxYear)) {
        setYearRange(yearFrom, value);
      }
    },
    [minYear, maxYear, yearFrom, setYearRange]
  );

  // Handle quarter change
  const handleQuarterChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value ? parseInt(e.target.value, 10) : null;
      setQuarter(value);
    },
    [setQuarter]
  );

  // Handle month change
  const handleMonthChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value ? parseInt(e.target.value, 10) : null;
      setMonth(value);
    },
    [setMonth]
  );

  // Handle resolution change
  const handleResolutionChange = useCallback(
    (resolution: TimeResolution) => {
      setTimeResolution(resolution);
    },
    [setTimeResolution]
  );

  // Handle mode toggle
  const handleModeToggle = useCallback(
    (rangeMode: boolean) => {
      if (rangeMode) {
        // Switch to range mode
        const currentYearValue = year ?? maxYear;
        setYearRange(currentYearValue - 5, currentYearValue);
      } else {
        // Switch to single year mode
        const yearValue = yearTo ?? yearFrom ?? maxYear;
        setYear(yearValue);
        setYearRange(null, null);
      }
    },
    [year, yearFrom, yearTo, maxYear, setYear, setYearRange]
  );

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    if (disabled) return;

    if (isRangeMode) {
      setYearRange(
        yearFrom !== null ? yearFrom - 1 : null,
        yearTo !== null ? yearTo - 1 : null
      );
      return;
    }

    switch (timeResolution) {
      case 'month':
        if (month !== null && year !== null) {
          if (month === 1) {
            setYear(year - 1);
            setMonth(12);
          } else {
            setMonth(month - 1);
          }
        } else if (year !== null) {
          setYear(year - 1);
        }
        break;
      case 'quarter':
        if (quarter !== null && year !== null) {
          if (quarter === 1) {
            setYear(year - 1);
            setQuarter(4);
          } else {
            setQuarter(quarter - 1);
          }
        } else if (year !== null) {
          setYear(year - 1);
        }
        break;
      case 'year':
      default:
        if (year !== null) {
          setYear(year - 1);
        }
        break;
    }
  }, [
    disabled,
    isRangeMode,
    timeResolution,
    year,
    quarter,
    month,
    yearFrom,
    yearTo,
    setYear,
    setQuarter,
    setMonth,
    setYearRange,
  ]);

  const handleNext = useCallback(() => {
    if (disabled) return;

    if (isRangeMode) {
      setYearRange(
        yearFrom !== null ? yearFrom + 1 : null,
        yearTo !== null ? yearTo + 1 : null
      );
      return;
    }

    switch (timeResolution) {
      case 'month':
        if (month !== null && year !== null) {
          if (month === 12) {
            setYear(year + 1);
            setMonth(1);
          } else {
            setMonth(month + 1);
          }
        } else if (year !== null) {
          setYear(year + 1);
        }
        break;
      case 'quarter':
        if (quarter !== null && year !== null) {
          if (quarter === 4) {
            setYear(year + 1);
            setQuarter(1);
          } else {
            setQuarter(quarter + 1);
          }
        } else if (year !== null) {
          setYear(year + 1);
        }
        break;
      case 'year':
      default:
        if (year !== null) {
          setYear(year + 1);
        }
        break;
    }
  }, [
    disabled,
    isRangeMode,
    timeResolution,
    year,
    quarter,
    month,
    yearFrom,
    yearTo,
    setYear,
    setQuarter,
    setMonth,
    setYearRange,
  ]);

  // Check navigation bounds
  const canGoPrevious = useMemo(() => {
    if (disabled) return false;
    if (isRangeMode) {
      return (yearFrom ?? minYear) > minYear;
    }
    return (year ?? minYear) > minYear;
  }, [disabled, isRangeMode, year, yearFrom, minYear]);

  const canGoNext = useMemo(() => {
    if (disabled) return false;
    if (isRangeMode) {
      return (yearTo ?? maxYear) < maxYear;
    }
    return (year ?? maxYear) < maxYear;
  }, [disabled, isRangeMode, year, yearTo, maxYear]);

  // Compact styles
  const containerStyle = compact
    ? { ...styles.container, ...styles.compact.container }
    : styles.container;
  const yearValueStyle = compact
    ? { ...styles.yearValue, ...styles.compact.yearValue }
    : styles.yearValue;

  return (
    <div style={containerStyle}>
      {/* Header with label and resolution selector */}
      <div style={styles.header}>
        <span style={styles.label}>{label}</span>
        {showResolutionSelector && !isRangeMode && (
          <div style={styles.resolutionToggle}>
            {RESOLUTION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                style={{
                  ...styles.resolutionButton,
                  ...(timeResolution === option.value
                    ? styles.resolutionButtonActive
                    : {}),
                }}
                onClick={() => handleResolutionChange(option.value)}
                disabled={disabled}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode toggle (single year vs range) */}
      {showRangeMode && (
        <div style={styles.modeToggle}>
          <button
            type="button"
            style={{
              ...styles.modeButton,
              ...(!isRangeMode ? styles.modeButtonActive : {}),
            }}
            onClick={() => handleModeToggle(false)}
            disabled={disabled}
          >
            Single Year
          </button>
          <button
            type="button"
            style={{
              ...styles.modeButton,
              ...(isRangeMode ? styles.modeButtonActive : {}),
            }}
            onClick={() => handleModeToggle(true)}
            disabled={disabled}
          >
            Year Range
          </button>
        </div>
      )}

      {/* Year display with navigation */}
      <div style={styles.yearDisplay}>
        {showNavigation && (
          <div style={styles.navigationButtons}>
            <button
              type="button"
              style={{
                ...styles.navButton,
                ...(!canGoPrevious ? styles.navButtonDisabled : {}),
              }}
              onClick={handlePrevious}
              disabled={!canGoPrevious}
              aria-label="Previous period"
            >
              ←
            </button>
          </div>
        )}

        <div style={yearValueStyle}>{periodDisplay}</div>

        {showNavigation && (
          <div style={styles.navigationButtons}>
            <button
              type="button"
              style={{
                ...styles.navButton,
                ...(!canGoNext ? styles.navButtonDisabled : {}),
              }}
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="Next period"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Year slider or range inputs */}
      {isRangeMode ? (
        <div style={styles.rangeInputs}>
          <input
            type="number"
            style={styles.rangeInput}
            value={yearFrom ?? ''}
            onChange={handleRangeFromChange}
            min={minYear}
            max={maxYear}
            placeholder="From"
            disabled={disabled}
            aria-label="Start year"
          />
          <span style={styles.rangeSeparator}>to</span>
          <input
            type="number"
            style={styles.rangeInput}
            value={yearTo ?? ''}
            onChange={handleRangeToChange}
            min={minYear}
            max={maxYear}
            placeholder="To"
            disabled={disabled}
            aria-label="End year"
          />
        </div>
      ) : (
        <div style={styles.sliderContainer}>
          <input
            type="range"
            style={styles.slider}
            min={minYear}
            max={maxYear}
            value={currentYear}
            onChange={handleSliderChange}
            disabled={disabled}
            aria-label="Year slider"
          />
          <div style={styles.sliderLabels}>
            <span>{minYear}</span>
            <span>{maxYear}</span>
          </div>
        </div>
      )}

      {/* Quarter/Month selectors based on resolution */}
      {!isRangeMode && (timeResolution === 'quarter' || timeResolution === 'month') && (
        <div style={styles.secondaryControls}>
          {timeResolution === 'quarter' && (
            <div style={styles.selectContainer}>
              <select
                style={styles.select}
                value={quarter ?? ''}
                onChange={handleQuarterChange}
                disabled={disabled}
                aria-label="Select quarter"
              >
                <option value="">All Quarters</option>
                {QUARTERS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {timeResolution === 'month' && (
            <div style={styles.selectContainer}>
              <select
                style={styles.select}
                value={month ?? ''}
                onChange={handleMonthChange}
                disabled={disabled}
                aria-label="Select month"
              >
                <option value="">All Months</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TimeSlider;
