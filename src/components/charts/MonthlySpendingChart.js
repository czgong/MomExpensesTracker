import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { formatCurrency, getChartConfig } from '../../utils/reportUtils';

const MonthlySpendingChart = ({ data, isMobile, onMonthClick }) => {
  const config = getChartConfig(isMobile);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <div className="tooltip-header">{label}</div>
          <div className="tooltip-content">
            <div className="tooltip-row">
              <span className="tooltip-label">Total:</span>
              <span className="tooltip-value">{formatCurrency(data.total)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Expenses:</span>
              <span className="tooltip-value">{data.count}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Average:</span>
              <span className="tooltip-value">
                {formatCurrency(data.count > 0 ? data.total / data.count : 0)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Handle chart click to navigate to month
  const handleChartClick = (data) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const monthData = data.activePayload[0].payload;
      if (onMonthClick && monthData.monthKey) {
        onMonthClick(monthData.monthKey);
      }
    }
  };

  // Format Y-axis values
  const formatYAxis = (value) => {
    if (value >= 1000) {
      const kValue = value / 1000;
      if (kValue % 1 === 0) {
        return `$${kValue}K`; // Whole numbers: $1K, $2K
      } else {
        return `$${kValue.toFixed(1)}K`; // Decimals: $1.2K, $1.6K
      }
    }
    return `$${value}`;
  };

  // Calculate Y-axis with explicit, evenly-spaced ticks
  const calculateYAxisConfig = (data) => {
    if (!data || data.length === 0) return { domain: [0, 1000], ticks: [0, 200, 400, 600, 800, 1000] };
    
    const maxValue = Math.max(...data.map(d => d.total));
    
    // Determine step size based on data range for 5-6 ticks
    let step, maxTick;
    
    if (maxValue <= 1000) {
      step = 200;
      maxTick = 1000;
    } else if (maxValue <= 2500) {
      step = 400; // 0, 400, 800, 1200, 1600, 2000, 2400
      maxTick = Math.ceil(maxValue / step) * step;
    } else if (maxValue <= 5000) {
      step = 1000;
      maxTick = Math.ceil(maxValue / step) * step;
    } else if (maxValue <= 10000) {
      step = 2000;
      maxTick = Math.ceil(maxValue / step) * step;
    } else {
      step = 5000;
      maxTick = Math.ceil(maxValue / step) * step;
    }
    
    // Generate explicit ticks
    const ticks = [];
    for (let i = 0; i <= maxTick; i += step) {
      ticks.push(i);
    }
    
    return {
      domain: [0, maxTick],
      ticks: [...new Set(ticks)] // Remove any potential duplicates
    };
  };
  
  const yAxisConfig = calculateYAxisConfig(data);

  // Ensure we have data
  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3>Monthly Spending Trend</h3>
          <p className="chart-subtitle">Track your spending over time</p>
        </div>
        <div className="chart-empty-state">
          <div className="empty-icon">📈</div>
          <p>No spending data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>Monthly Spending Trend</h3>
        <p className="chart-subtitle">
          {data.length} {data.length === 1 ? 'month' : 'months'} of data
          {onMonthClick && <span className="chart-hint"> • Tap points to view details</span>}
        </p>
      </div>
      
      <div className="chart-wrapper" style={{ height: config.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={config.margin}
            onClick={handleChartClick}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#f0f0f0"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ 
                fontSize: config.tickFontSize, 
                fill: '#666'
              }}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? 'end' : 'middle'}
              height={isMobile ? 60 : 40}
              interval={isMobile && data.length > 6 ? 1 : 0} // Skip some labels on mobile if too many
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ 
                fontSize: config.tickFontSize, 
                fill: '#666'
              }}
              tickFormatter={formatYAxis}
              width={isMobile ? 50 : 60}
              domain={yAxisConfig.domain}
              ticks={yAxisConfig.ticks}
              type="number"
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: '#007AFF', strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#007AFF"
              strokeWidth={config.strokeWidth}
              dot={{ 
                fill: '#007AFF', 
                strokeWidth: 2, 
                stroke: '#fff',
                r: config.dotRadius 
              }}
              activeDot={{ 
                r: config.dotRadius + 2, 
                stroke: '#007AFF',
                strokeWidth: 2,
                fill: '#fff'
              }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {data.length > 0 && (
        <div className="chart-summary">
          <div className="summary-stat">
            <span className="stat-label">Peak:</span>
            <span className="stat-value">
              {formatCurrency(Math.max(...data.map(d => d.total)))}
            </span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Average:</span>
            <span className="stat-value">
              {formatCurrency(data.reduce((sum, d) => sum + d.total, 0) / data.length)}
            </span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Total:</span>
            <span className="stat-value">
              {formatCurrency(data.reduce((sum, d) => sum + d.total, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlySpendingChart;