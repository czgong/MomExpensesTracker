import React from 'react';
import { formatCurrency, formatPercentage } from '../../utils/reportUtils';

const SpendingSummaryCards = ({ summaryStats, growthMetrics, isMobile }) => {
  // Debug logging to see what data we're receiving
  console.log('SpendingSummaryCards Debug:', {
    summaryStats,
    growthMetrics,
    summaryStatsKeys: summaryStats ? Object.keys(summaryStats) : 'undefined',
    growthMetricsKeys: growthMetrics ? Object.keys(growthMetrics) : 'undefined'
  });

  const cards = [
    {
      id: 'total',
      title: 'Total Spending',
      value: summaryStats?.totalSpending ? formatCurrency(summaryStats.totalSpending) : 'TEST $0',
      subtitle: summaryStats?.totalExpenses ? `${summaryStats.totalExpenses} expenses` : 'TEST 0 expenses',
      icon: '💰',
      color: '#007AFF'
    },
    {
      id: 'average',
      title: 'Monthly Average',
      value: summaryStats?.monthlyAverage ? formatCurrency(summaryStats.monthlyAverage) : 'TEST $0',
      subtitle: summaryStats?.averageExpense ? `${formatCurrency(summaryStats.averageExpense)} per expense` : 'TEST $0 per expense',
      icon: '📊',
      color: '#34C759'
    },
    {
      id: 'trend',
      title: 'Monthly Trend',
      value: growthMetrics?.monthOverMonth !== undefined 
        ? `${growthMetrics.monthOverMonth >= 0 ? '+' : ''}${growthMetrics.monthOverMonth.toFixed(1)}%`
        : 'TEST 0%',
      subtitle: getTrendText(growthMetrics?.trend || 'stable'),
      icon: getTrendIcon(growthMetrics?.trend || 'stable'),
      color: getTrendColor(growthMetrics?.trend || 'stable')  
    },
    {
      id: 'highest',
      title: 'Highest Month',
      value: summaryStats?.highestMonth ? formatCurrency(summaryStats.highestMonth.total) : '$0',
      subtitle: summaryStats?.highestMonth ? summaryStats.highestMonth.month : 'No data',
      icon: '📈',
      color: '#FF9500'
    },
    {
      id: 'categories',
      title: 'Categories',
      value: 'Coming Soon',
      subtitle: 'Category tracking planned',
      icon: '🏷️',
      color: '#AF52DE'
    }
  ];

  console.log('Cards array:', cards);

  return (
    <div className="spending-summary-cards">
      <div className="cards-grid">
        {cards.map(card => (
          <div key={card.id} className="summary-card" style={{'--card-color': card.color}}>
            <div className="card-header">
              <div className="card-icon" role="img" aria-hidden="true">
                {card.icon}
              </div>
              <div className="card-title">{card.title}</div>
            </div>
            <div className="card-content">
              <div className="card-value" style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>{card.value}</div>
              <div className="card-subtitle" style={{ color: 'white', fontSize: '13px', opacity: '0.8' }}>{card.subtitle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper functions
function getTrendText(trend) {
  switch (trend) {
    case 'increasing': return 'Spending up';
    case 'decreasing': return 'Spending down';
    default: return 'Stable spending';
  }
}

function getTrendIcon(trend) {
  switch (trend) {
    case 'increasing': return '📈';
    case 'decreasing': return '📉';
    default: return '➡️';
  }
}

function getTrendColor(trend) {
  switch (trend) {
    case 'increasing': return '#FF3B30';
    case 'decreasing': return '#34C759';
    default: return '#8E8E93';
  }
}

export default SpendingSummaryCards;