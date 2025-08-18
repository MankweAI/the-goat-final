/**
 * Date Formatter Utility
 * Date: 2025-08-18 11:23:50 UTC
 * Author: sophoniagoat
 */

/**
 * Format date to friendly string
 * @param {Date|string} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    const { includeTime = false, useRelative = true, shortMonth = true } = options;

    // If date is invalid, return placeholder
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    // For relative dates
    if (useRelative) {
      const now = new Date();
      const diffMs = dateObj.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return includeTime ? `Today at ${formatTime(dateObj)}` : 'Today';
      } else if (diffDays === 1) {
        return includeTime ? `Tomorrow at ${formatTime(dateObj)}` : 'Tomorrow';
      } else if (diffDays === -1) {
        return includeTime ? `Yesterday at ${formatTime(dateObj)}` : 'Yesterday';
      } else if (diffDays > 1 && diffDays < 7) {
        return includeTime
          ? `${getDayName(dateObj)} at ${formatTime(dateObj)}`
          : getDayName(dateObj);
      }
    }

    // For non-relative dates
    const months = shortMonth
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      : [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December'
        ];

    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];

    if (includeTime) {
      return `${day} ${month} at ${formatTime(dateObj)}`;
    } else {
      return `${day} ${month}`;
    }
  } catch (error) {
    console.error('❌ Date formatting error:', error);
    return 'Date unavailable';
  }
}

/**
 * Format time to 12-hour format
 */
function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12

  const minutesStr = minutes < 10 ? '0' + minutes : minutes;

  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Get day name from date
 */
function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Format time remaining until date
 */
export function formatTimeRemaining(targetDate) {
  try {
    const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    const now = new Date();

    // Get time difference in milliseconds
    const diffMs = target.getTime() - now.getTime();

    // Return if date is in the past
    if (diffMs < 0) {
      return 'Time elapsed';
    }

    // Calculate time units
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    // Format the string
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ${hours} hr${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  } catch (error) {
    console.error('❌ Time remaining formatting error:', error);
    return 'Time unavailable';
  }
}

/**
 * Check if date is today
 */
export function isToday(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();

  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

/**
 * Format date range
 */
export function formatDateRange(startDate, endDate, options = {}) {
  try {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

    // For same day
    if (
      start.getDate() === end.getDate() &&
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear()
    ) {
      return `${formatDate(start, options)} (${formatTime(start)} - ${formatTime(end)})`;
    }

    // For different days
    return `${formatDate(start, { ...options, includeTime: true })} - ${formatDate(end, options)}`;
  } catch (error) {
    console.error('❌ Date range formatting error:', error);
    return 'Date range unavailable';
  }
}
