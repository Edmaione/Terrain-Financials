/**
 * Date range utilities for filtering transactions
 */

export type DateRangePreset =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'ytd'
  | 'all_time'
  | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
}

/**
 * Parse date range from query parameters
 * @param range - Preset range or 'custom'
 * @param customStart - Custom start date (YYYY-MM-DD)
 * @param customEnd - Custom end date (YYYY-MM-DD)
 * @returns DateRange with start and end dates
 */
export function parseDateRange(
  range?: string,
  customStart?: string,
  customEnd?: string
): DateRange {
  const today = new Date();
  const preset = (range as DateRangePreset) || 'last_3_months';

  // Handle custom range
  if (preset === 'custom' && customStart && customEnd) {
    return {
      startDate: customStart,
      endDate: customEnd,
    };
  }

  // Handle preset ranges
  switch (preset) {
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
      };
    }

    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: formatDate(start),
        endDate: formatDate(end),
      };
    }

    case 'last_3_months': {
      const start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
      };
    }

    case 'ytd': {
      const start = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
      };
    }

    case 'all_time': {
      // Go back 5 years
      const start = new Date(today.getFullYear() - 5, 0, 1);
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
      };
    }

    default: {
      // Default to last 3 months
      const start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
      };
    }
  }
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get human-readable label for date range preset
 */
export function getDateRangeLabel(preset: DateRangePreset): string {
  switch (preset) {
    case 'this_month':
      return 'This Month';
    case 'last_month':
      return 'Last Month';
    case 'last_3_months':
      return 'Last 3 Months';
    case 'ytd':
      return 'Year to Date';
    case 'all_time':
      return 'All Time';
    case 'custom':
      return 'Custom';
    default:
      return 'Last 3 Months';
  }
}
