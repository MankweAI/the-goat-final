/**
 * Enhanced Date Parser for Natural Language Input
 * Supports: "22 Aug 7pm", "tomorrow 2pm", "next Friday 9:30", "skip"
 * Timezone: Africa/Johannesburg (UTC+2)
<<<<<<< HEAD
 * Date: 2025-08-17 17:13:23 UTC
 * MINIMAL VERSION - Only what's needed for date parsing fix
=======
 * Date: 2025-08-17 15:36:12 UTC
>>>>>>> safeHouse
 */

export class DateParser {
  constructor() {
    this.timezone = 'Africa/Johannesburg';
    this.defaultTime = '19:00'; // 7pm default
  }

  parseExamDate(input) {
    const cleaned = input.trim().toLowerCase();

    console.log(`🕐 Parsing date input: "${cleaned}"`);

    // Handle skip
    if (cleaned === 'skip' || cleaned === 'not sure' || cleaned === 'later') {
      return {
        success: true,
        isSkipped: true,
        message: "No worries! We'll focus on general preparation.",
        date: null
      };
    }

    try {
      let parsedDate = null;
      let timeIncluded = false;

      // Pattern matching for various formats
      if (this.matchesTomorrow(cleaned)) {
        parsedDate = this.parseTomorrowFormat(cleaned);
        timeIncluded =
          cleaned.includes('pm') || cleaned.includes('am') || /\d{1,2}:\d{2}/.test(cleaned);
      } else if (this.matchesDateMonth(cleaned)) {
        parsedDate = this.parseDateMonthFormat(cleaned);
        timeIncluded =
          cleaned.includes('pm') || cleaned.includes('am') || /\d{1,2}:\d{2}/.test(cleaned);
      } else if (this.matchesRelativeDay(cleaned)) {
        parsedDate = this.parseRelativeDayFormat(cleaned);
        timeIncluded =
          cleaned.includes('pm') || cleaned.includes('am') || /\d{1,2}:\d{2}/.test(cleaned);
      } else if (this.matchesTimeOnly(cleaned)) {
        parsedDate = this.parseTimeOnlyFormat(cleaned);
        timeIncluded = true;
      } else if (this.matchesNumericDate(cleaned)) {
        parsedDate = this.parseNumericDateFormat(cleaned);
        timeIncluded =
          cleaned.includes('pm') || cleaned.includes('am') || /\d{1,2}:\d{2}/.test(cleaned);
      }

      if (!parsedDate) {
        return {
          success: false,
          message: this.getHelpfulErrorMessage(),
          suggestions: ['22 Aug 7pm', 'tomorrow 2pm', 'next Friday 9:30']
        };
      }

      // Apply default time if not included
      if (!timeIncluded) {
        parsedDate.setHours(19, 0, 0, 0); // 7pm default
      }

      // Convert to Africa/Johannesburg timezone
      const examDate = parsedDate;
      const now = new Date();
      const hoursAway = Math.round((examDate - now) / (1000 * 60 * 60));

      // Validation
      if (hoursAway < 0) {
        return {
          success: false,
          message: 'That date has already passed. Please enter a future date.',
          suggestions: ['tomorrow 7pm', 'next Monday 2pm']
        };
      }

      const confirmation = this.formatConfirmation(examDate);

      console.log(`✅ Parsed date successfully: ${examDate.toISOString()}, ${hoursAway}h away`);

      return {
        success: true,
        date: examDate.toISOString(),
        hoursAway,
        confirmation,
        timeIncluded
      };
    } catch (error) {
      console.error(`❌ Date parsing error:`, error);
      return {
        success: false,
        message: this.getHelpfulErrorMessage(),
        suggestions: ['22 Aug 7pm', 'tomorrow 2pm', 'skip']
      };
    }
  }

  matchesTomorrow(input) {
    return /tomorrow|tom\b/.test(input);
  }

  matchesDateMonth(input) {
    return /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(
      input
    );
  }

  matchesRelativeDay(input) {
    return /(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i.test(
      input
    );
  }

  matchesTimeOnly(input) {
    return (
      /^\d{1,2}(:\d{2})?\s*(am|pm)$/i.test(input) ||
      /^(today|tonight)\s+\d{1,2}(:\d{2})?\s*(am|pm)?/i.test(input)
    );
  }

  matchesNumericDate(input) {
    return /\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}/.test(input);
  }

  parseTomorrowFormat(input) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeMatch = input.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0;
      const period = timeMatch[3].toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      tomorrow.setHours(hours, minutes, 0, 0);
    }

    return tomorrow;
  }

  parseDateMonthFormat(input) {
    const currentYear = new Date().getFullYear();
    const monthMap = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11
    };

    const match = input.match(
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)/i
    );
    if (!match) return null;

    const day = parseInt(match[1]);
    const month = monthMap[match[2].toLowerCase()];

    const date = new Date(currentYear, month, day);

    if (date < new Date()) {
      date.setFullYear(currentYear + 1);
    }

    const timeMatch = input.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0;
      const period = timeMatch[3].toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      date.setHours(hours, minutes, 0, 0);
    }

    return date;
  }

  parseRelativeDayFormat(input) {
    const dayMap = {
      monday: 1,
      mon: 1,
      tuesday: 2,
      tue: 2,
      wednesday: 3,
      wed: 3,
      thursday: 4,
      thu: 4,
      friday: 5,
      fri: 5,
      saturday: 6,
      sat: 6,
      sunday: 0,
      sun: 0
    };

    const match = input.match(
      /(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i
    );
    if (!match) return null;

    const isNext = match[1].toLowerCase() === 'next';
    const targetDay = dayMap[match[2].toLowerCase()];

    const date = new Date();
    const currentDay = date.getDay();
    let daysToAdd = targetDay - currentDay;

    if (daysToAdd <= 0 || isNext) {
      daysToAdd += 7;
    }

    date.setDate(date.getDate() + daysToAdd);

    const timeMatch = input.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0;
      const period = timeMatch[3].toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      date.setHours(hours, minutes, 0, 0);
    }

    return date;
  }

  parseTimeOnlyFormat(input) {
    const date = new Date();

    if (input.includes('today') || input.includes('tonight')) {
      // Use today
    } else {
      const timeMatch = input.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const period = timeMatch[3].toLowerCase();

        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;

        const testDate = new Date();
        testDate.setHours(hours, 0, 0, 0);

        if (testDate <= new Date()) {
          date.setDate(date.getDate() + 1);
        }
      }
    }

    const timeMatch = input.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0;
      const period = timeMatch[3].toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      date.setHours(hours, minutes, 0, 0);
    }

    return date;
  }

<<<<<<< HEAD
=======
  parseNumericDateFormat(input) {
    const match = input.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (!match) return null;

    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; // JavaScript months are 0-based
    const currentYear = new Date().getFullYear();

    const date = new Date(currentYear, month, day);

    // If date is in the past, assume next year
    if (date < new Date()) {
      date.setFullYear(currentYear + 1);
    }

    const timeMatch = input.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0;
      const period = timeMatch[3].toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      date.setHours(hours, minutes, 0, 0);
    }

    return date;
  }

  toJohannesburgTime(date) {
    // Simple UTC+2 conversion for South Africa
    const utcTime = date.getTime();
    const offsetMs = 2 * 60 * 60 * 1000; // UTC+2
    return new Date(utcTime);
  }

>>>>>>> safeHouse
  formatConfirmation(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = date.getHours();
    const minutes = date.getMinutes();

    const timeStr =
      hours === 0
        ? '12am'
        : hours < 12
          ? `${hours}${minutes > 0 ? ':' + minutes.toString().padStart(2, '0') : ''}am`
          : hours === 12
            ? `12${minutes > 0 ? ':' + minutes.toString().padStart(2, '0') : ''}pm`
            : `${hours - 12}${minutes > 0 ? ':' + minutes.toString().padStart(2, '0') : ''}pm`;

    return `${dayName} ${day} ${month} at ${timeStr}`;
  }

  getHelpfulErrorMessage() {
    return "I didn't catch the date. Try formats like:\n• 22 Aug 7pm\n• tomorrow 2pm\n• next Friday 9:30\n• skip";
  }
}

export const dateParser = new DateParser();
