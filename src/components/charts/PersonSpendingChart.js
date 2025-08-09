import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { formatCurrency, formatPercentage, getChartConfig } from '../../utils/reportUtils';

const PersonSpendingChart = ({ data, isMobile }) => {
  const config = getChartConfig(isMobile);

  // Color palette for different people
  const colors = [
    '#007AFF', // Blue
    '#34C759', // Green  
    '#FF9500', // Orange
    '#FF3B30', // Red
    '#AF52DE', // Purple
    '#FF2D92', // Pink
    '#5AC8FA', // Light Blue
    '#FFCC00', // Yellow
  ];

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <div className="tooltip-header">{label}</div>
          <div className="tooltip-content">
            <div className="tooltip-row">
              <span className="tooltip-label">Net Spending:</span>
              <span className="tooltip-value">{formatCurrency(data.netSpending)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Actually Paid:</span>
              <span className="tooltip-value">{formatCurrency(data.paid)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Share:</span>
              <span className="tooltip-value">{formatPercentage(data.percentageShare / 100)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Difference:</span>
              <span className="tooltip-value">
                {formatCurrency(Math.abs(data.paid - data.netSpending))}
                {data.paid > data.netSpending ? ' overpaid' : ' underpaid'}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
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

  // Ensure we have data
  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3>Net Spending by Person</h3>
          <p className="chart-subtitle">How much each person owes after expense sharing</p>
        </div>
        <div className="chart-empty-state">
          <div className="empty-icon">👥</div>
          <p>No person data available</p>
        </div>
      </div>
    );
  }

  // Include all people with participation for proper visualization  
  const dataWithSpending = data.filter(person => person.percentageShare > 0);
  
  // Calculate Y-axis with explicit, evenly-spaced ticks
  const calculateYAxisConfig = (data) => {
    if (!data || data.length === 0) return { domain: [0, 1000], ticks: [0, 200, 400, 600, 800, 1000] };
    
    const maxValue = Math.max(...data.map(d => d.netSpending));
    
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
  
  const yAxisConfig = calculateYAxisConfig(dataWithSpending);


  if (dataWithSpending.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3>Net Spending by Person</h3>
          <p className="chart-subtitle">How much each person owes after expense sharing</p>
        </div>
        <div className="chart-empty-state">
          <div className="empty-icon">👥</div>
          <p>No spending recorded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>Net Spending by Person</h3>
        <p className="chart-subtitle">
          How much each person owes after expense sharing
        </p>
      </div>
      
      <div className="chart-wrapper" style={{ height: config.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dataWithSpending}
            margin={config.margin}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#f0f0f0"
            />
            
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: config.tickFontSize, fill: '#666' }}
              angle={isMobile ? -45 : -45}
              textAnchor="end"
              height={isMobile ? 80 : 60}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: config.tickFontSize, fill: '#666' }}
              tickFormatter={formatYAxis}
              domain={yAxisConfig.domain}
              ticks={yAxisConfig.ticks}
              type="number"
            />
            
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(0, 122, 255, 0.1)' }}
            />
            
            <Bar 
              dataKey="netSpending" 
              radius={[4, 4, 0, 0]}
              fill="#007AFF"
            >
              {dataWithSpending.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend/Summary for mobile */}
      {isMobile && dataWithSpending.length > 0 && (
        <div className="chart-legend">
          {dataWithSpending.map((person, index) => (
            <div key={person.id} className="legend-item">
              <div 
                className="legend-color" 
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <div className="legend-content">
                <span className="legend-name">{person.name}</span>
                <span className="legend-value">
                  {formatCurrency(person.netSpending)} ({formatPercentage(person.percentageShare / 100)})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Summary stats */}
      <div className="chart-summary">
        <div className="summary-stat">
          <span className="stat-label">Top Spender:</span>
          <span className="stat-value">
            {dataWithSpending[0]?.name} ({formatCurrency(dataWithSpending[0]?.netSpending)})
          </span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Average:</span>
          <span className="stat-value">
            {formatCurrency(
              dataWithSpending.reduce((sum, p) => sum + p.netSpending, 0) / dataWithSpending.length
            )}
          </span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Range:</span>
          <span className="stat-value">
            {formatCurrency(dataWithSpending[dataWithSpending.length - 1]?.netSpending)} - {formatCurrency(dataWithSpending[0]?.netSpending)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PersonSpendingChart;