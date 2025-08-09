// reportUtils.js - Data processing utilities for reports

/**
 * Aggregate expenses by month for trending charts
 * @param {Array} expenses - Array of expense objects
 * @returns {Array} Array of {month, total, count} objects sorted chronologically
 */
export const aggregateMonthlySpending = (expenses) => {
  if (!expenses || expenses.length === 0) return [];

  const monthlyData = {};
  
  expenses.forEach(expense => {
    // Extract year and month from the date string directly to avoid timezone issues
    // expense.date format is typically "YYYY-MM-DD"
    const dateParts = expense.date.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Convert to 0-based month for Date constructor
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const currentYear = new Date().getFullYear();
    
    // Create shorter month labels for better readability using the extracted year and month
    const date = new Date(year, month); // Use extracted values to avoid timezone issues
    const monthName = currentYear === year 
      ? date.toLocaleDateString('en-US', { month: 'short' }) // "Jan" for current year
      : date.toLocaleDateString('en-US', { month: 'short' }).substring(0, 1) + 
        "'" + year.toString().slice(-2); // "J'24" for other years
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthName,
        monthKey: monthKey,
        total: 0,
        count: 0,
        date: new Date(year, month) // For sorting
      };
    }
    
    monthlyData[monthKey].total += parseFloat(expense.cost || 0);
    monthlyData[monthKey].count += 1;
  });
  
  return Object.values(monthlyData)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(({ date, ...rest }) => rest); // Remove date used for sorting
};

/**
 * Calculate net spending per person after expense sharing
 * @param {Array} expenses - Array of expense objects  
 * @param {Array} persons - Array of person objects
 * @param {Object} currentMonthParticipants - Participants with percentage shares for current month
 * @returns {Array} Array of {name, netSpending, paid, owes, percentage} objects
 */
export const calculatePersonNetSpending = (expenses, persons, currentMonthParticipants = null) => {
  if (!expenses || expenses.length === 0 || !persons || persons.length === 0) {
    return [];
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.cost || 0), 0);
  
  // Use provided participants or default to equal sharing
  const participants = currentMonthParticipants && currentMonthParticipants.length > 0 
    ? currentMonthParticipants 
    : persons.map(person => ({
        id: person.id,
        name: person.name,
        percentShare: 100 / persons.length
      }));
  
  const personData = {};
  
  // Initialize with participants data
  participants.forEach(participant => {
    personData[participant.id] = {
      id: participant.id,
      name: participant.name,
      paid: 0,
      owes: (participant.percentShare / 100) * totalExpenses,
      netSpending: 0,
      percentageShare: participant.percentShare
    };
  });
  
  // Calculate how much each person actually paid
  expenses.forEach(expense => {
    const personId = expense.person_id;
    if (personData[personId]) {
      personData[personId].paid += parseFloat(expense.cost || 0);
    }
  });
  
  // Calculate net spending (how much they owe based on sharing percentage)
  Object.values(personData).forEach(person => {
    person.netSpending = person.owes; // This is what they should pay based on percentage
  });
  
  // Return sorted by net spending (highest first)
  // Include people with any participation (even 0 spending) for proper visualization
  return Object.values(personData)
    .filter(person => person.percentageShare > 0)
    .sort((a, b) => b.netSpending - a.netSpending);
};

/**
 * Aggregate expenses by person (legacy function - shows who paid what)
 * @param {Array} expenses - Array of expense objects  
 * @param {Array} persons - Array of person objects
 * @returns {Array} Array of {name, total, count, percentage} objects
 */
export const aggregatePersonSpending = (expenses, persons) => {
  if (!expenses || expenses.length === 0 || !persons || persons.length === 0) {
    return [];
  }

  const personData = {};
  const totalSpending = expenses.reduce((sum, exp) => sum + parseFloat(exp.cost || 0), 0);
  
  // Initialize all persons with zero spending
  persons.forEach(person => {
    personData[person.id] = {
      id: person.id,
      name: person.name,
      total: 0,
      count: 0,
      percentage: 0
    };
  });
  
  // Aggregate spending by person
  expenses.forEach(expense => {
    const personId = expense.person_id;
    if (personData[personId]) {
      personData[personId].total += parseFloat(expense.cost || 0);
      personData[personId].count += 1;
    }
  });
  
  // Calculate percentages and return sorted by total (highest first)
  return Object.values(personData)
    .map(person => ({
      ...person,
      percentage: totalSpending > 0 ? (person.total / totalSpending) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total);
};

/**
 * Calculate growth metrics for monthly data
 * @param {Array} monthlyData - Array from aggregateMonthlySpending
 * @returns {Object} Growth metrics
 */
export const calculateGrowthMetrics = (monthlyData) => {
  if (!monthlyData || monthlyData.length < 2) {
    return {
      monthOverMonth: 0,
      trend: 'stable',
      growth: 0
    };
  }
  
  const current = monthlyData[monthlyData.length - 1];
  const previous = monthlyData[monthlyData.length - 2];
  
  const growth = previous.total > 0 
    ? ((current.total - previous.total) / previous.total) * 100
    : 0;
    
  return {
    monthOverMonth: growth,
    trend: growth > 5 ? 'increasing' : growth < -5 ? 'decreasing' : 'stable',
    growth: Math.abs(growth)
  };
};

/**
 * Generate summary statistics
 * @param {Array} expenses - Array of expense objects
 * @param {Array} monthlyData - Array from aggregateMonthlySpending
 * @returns {Object} Summary statistics
 */
export const generateSummaryStats = (expenses, monthlyData = null) => {
  if (!expenses || expenses.length === 0) {
    return {
      totalSpending: 0,
      totalExpenses: 0,
      averageExpense: 0,
      monthlyAverage: 0,
      highestMonth: null,
      currentMonth: null
    };
  }
  
  const totalSpending = expenses.reduce((sum, exp) => sum + parseFloat(exp.cost || 0), 0);
  const totalExpenses = expenses.length;
  const averageExpense = totalSpending / totalExpenses;
  
  let monthlyAverage = 0;
  let highestMonth = null;
  let currentMonth = null;
  
  if (monthlyData && monthlyData.length > 0) {
    monthlyAverage = monthlyData.reduce((sum, month) => sum + month.total, 0) / monthlyData.length;
    highestMonth = monthlyData.reduce((highest, month) => 
      month.total > highest.total ? month : highest
    );
    currentMonth = monthlyData[monthlyData.length - 1];
  }
  
  return {
    totalSpending,
    totalExpenses,
    averageExpense,
    monthlyAverage,
    highestMonth,
    currentMonth
  };
};

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @param {boolean} compact - Whether to use compact notation (K, M)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, compact = false) => {
  if (!amount || isNaN(amount)) return '$0';
  
  if (compact && amount >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(amount);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format percentage for display
 * @param {number} percentage - Percentage to format
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (percentage) => {
  if (!percentage || isNaN(percentage)) return '0%';
  return `${Math.round(percentage * 10) / 10}%`;
};

/**
 * Truncate monthly data for mobile view
 * @param {Array} monthlyData - Full monthly data array
 * @param {boolean} isMobile - Whether to apply mobile truncation
 * @param {number} mobileLimit - Number of months to show on mobile
 * @returns {Array} Truncated or full data array
 */
export const truncateDataForMobile = (monthlyData, isMobile, mobileLimit = 6) => {
  if (!isMobile || !monthlyData || monthlyData.length <= mobileLimit) {
    return monthlyData;
  }
  
  return monthlyData.slice(-mobileLimit); // Show last N months
};

/**
 * Get chart configuration based on device type
 * @param {boolean} isMobile - Whether device is mobile
 * @returns {Object} Chart configuration object
 */
export const getChartConfig = (isMobile) => {
  return {
    height: isMobile ? 300 : 400,
    margin: isMobile 
      ? { top: 20, right: 20, left: 20, bottom: 80 }
      : { top: 20, right: 30, left: 20, bottom: 50 },
    strokeWidth: isMobile ? 3 : 2,
    dotRadius: isMobile ? 6 : 4,
    fontSize: isMobile ? 12 : 14,
    tickFontSize: isMobile ? 10 : 12
  };
};