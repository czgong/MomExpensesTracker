import React, { useMemo } from 'react';
import './ReportsView.scss';
import './charts/Charts.scss';
import MonthlySpendingChart from './charts/MonthlySpendingChart';
import PersonSpendingChart from './charts/PersonSpendingChart';
import {
  aggregateMonthlySpending,
  calculatePersonNetSpending,
  calculateGrowthMetrics,
  generateSummaryStats,
  truncateDataForMobile
} from '../utils/reportUtils';

const ReportsView = ({ expenses, persons, monthTabs, isMobile, onNavigateToMonth, currentMonthParticipants }) => {
  
  // Process data for charts using useMemo for performance
  const processedData = useMemo(() => {
    try {
      // Generate monthly data
      const monthlyData = aggregateMonthlySpending(expenses) || [];
      const monthlyDataForDisplay = truncateDataForMobile(monthlyData, isMobile, 6) || [];
      
      // Generate person net spending data (after expense sharing)
      const personData = calculatePersonNetSpending(expenses, persons, currentMonthParticipants) || [];
      
      // Calculate metrics
      const growthMetrics = calculateGrowthMetrics(monthlyData) || { monthOverMonth: 0, trend: 'stable', growth: 0 };
      const summaryStats = generateSummaryStats(expenses, monthlyData) || {
        totalSpending: 0,
        totalExpenses: 0,
        averageExpense: 0,
        monthlyAverage: 0,
        highestMonth: null,
        currentMonth: null
      };
      
      console.log('ProcessedData Debug:', {
        monthlyData: monthlyData.length,
        personData: personData.length,
        growthMetrics,
        summaryStats
      });
      
      return {
        monthlyData: monthlyDataForDisplay,
        personData,
        growthMetrics,
        summaryStats,
        fullMonthlyData: monthlyData // Keep full data for calculations
      };
    } catch (error) {
      console.error('Error processing data:', error);
      return {
        monthlyData: [],
        personData: [],
        growthMetrics: { monthOverMonth: 0, trend: 'stable', growth: 0 },
        summaryStats: {
          totalSpending: 0,
          totalExpenses: 0,
          averageExpense: 0,
          monthlyAverage: 0,
          highestMonth: null,
          currentMonth: null
        },
        fullMonthlyData: []
      };
    }
  }, [expenses, persons, isMobile, currentMonthParticipants]);

  // Handle month navigation from chart clicks
  const handleMonthClick = (monthKey) => {
    if (onNavigateToMonth) {
      onNavigateToMonth(monthKey);
    }
  };

  // Show loading state if data is not ready
  if (!expenses || !persons || !processedData) {
    return (
      <div className="reports-view">
        <div className="reports-header">
          <h2>Reports & Analytics</h2>
          <p className="reports-subtitle">Loading your spending insights...</p>
        </div>
        <div className="reports-loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // Show empty state if no expenses
  if (expenses.length === 0) {
    return (
      <div className="reports-view">
        <div className="reports-header">
          <h2>Reports & Analytics</h2>
          <p className="reports-subtitle">Track your spending patterns over time</p>
        </div>
        <div className="reports-empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Data Yet</h3>
          <p>Add some expenses to see your spending reports and analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-view">
      <div className="reports-header">
        <h2>Reports & Analytics</h2>
        <div className="reports-subtitle">
          <span>Insights from {expenses.length} expenses</span>
          {processedData.fullMonthlyData.length > 0 && (
            <span> • {processedData.fullMonthlyData.length} months of data</span>
          )}
        </div>
      </div>

      <div className="reports-content">

        {/* Monthly Spending Trend */}
        {processedData.monthlyData.length > 0 && (
          <div className="report-section">
            <MonthlySpendingChart
              data={processedData.monthlyData}
              isMobile={isMobile}
              onMonthClick={handleMonthClick}
            />
            {isMobile && processedData.fullMonthlyData.length > 6 && (
              <div className="chart-note">
                <p>📱 Showing last 6 months on mobile. Switch to desktop for full history.</p>
              </div>
            )}
          </div>
        )}

        {/* Person Spending Breakdown */}
        {processedData.personData.length > 0 && (
          <div className="report-section">
            <PersonSpendingChart
              data={processedData.personData}
              isMobile={isMobile}
            />
          </div>
        )}

        {/* Additional Insights Section */}
        {processedData.fullMonthlyData.length > 1 && (
          <div className="report-section insights-section">
            <h3>Key Insights</h3>
            <div className="insights-grid">
              <div className="insight-card">
                <div className="insight-icon">📈</div>
                <div className="insight-content">
                  <h4>Spending Pattern</h4>
                  <p>
                    {processedData.growthMetrics?.trend === 'increasing' 
                      ? `Your spending has increased by ${((processedData.growthMetrics?.growth || 0)).toFixed(1)}% this month.`
                      : processedData.growthMetrics?.trend === 'decreasing'
                      ? `Your spending has decreased by ${((processedData.growthMetrics?.growth || 0)).toFixed(1)}% this month.`
                      : 'Your spending has remained stable this month.'
                    }
                  </p>
                </div>
              </div>

              {processedData.personData[0] && (
                <div className="insight-card">
                  <div className="insight-icon">🏆</div>
                  <div className="insight-content">
                    <h4>Top Contributor</h4>
                    <p>
                      {processedData.personData[0].name} has the highest spending at{' '}
                      {((processedData.personData[0].percentageShare || 0)).toFixed(1)}% of total expenses.
                    </p>
                  </div>
                </div>
              )}

              {processedData.fullMonthlyData.length >= 3 && (
                <div className="insight-card">
                  <div className="insight-icon">📊</div>
                  <div className="insight-content">
                    <h4>Monthly Average</h4>
                    <p>
                      Over the last {processedData.fullMonthlyData.length} months, you've averaged{' '}
                      ${((processedData.summaryStats?.monthlyAverage || 0)).toFixed(0)} per month in expenses.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Summary Footer */}
        <div className="report-section data-summary">
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Data Period</span>
              <span className="summary-value">
                {processedData.fullMonthlyData.length > 0 ? (
                  `${processedData.fullMonthlyData[0]?.month} - ${processedData.fullMonthlyData[processedData.fullMonthlyData.length - 1]?.month}`
                ) : (
                  'Current data only'
                )}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Last Updated</span>
              <span className="summary-value">
                {new Date().toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;