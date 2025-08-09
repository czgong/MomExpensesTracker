import React from 'react';
import './BottomTabBar.scss';

const BottomTabBar = ({ activeTab, onTabChange, isMobile, timelineData, monthLockStatus }) => {
  const tabs = [
    {
      id: 'expenses',
      label: 'Expenses',
      icon: '💳',
      ariaLabel: 'View expenses'
    },
    {
      id: 'reports',
      label: 'Reports', 
      icon: '📊',
      ariaLabel: 'View reports and analytics'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      ariaLabel: 'View settings and configuration'
    }
  ];

  return (
    <div className={`bottom-tab-bar ${isMobile ? 'mobile' : 'desktop'}`}>
      {/* Single integrated row with tabs and timeline */}
      <div className="tab-container">
        {/* Main tabs */}
        <div className="main-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.ariaLabel}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              <div className="tab-content">
                <span className="tab-icon" role="img" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="tab-label">{tab.label}</span>
              </div>
              {activeTab === tab.id && <div className="active-indicator" />}
            </button>
          ))}
        </div>
        
        {/* Integrated timeline - only on desktop */}
        {!isMobile && timelineData && timelineData.monthTabs && timelineData.monthTabs.length > 0 && (
          <div className="integrated-timeline">
            {(() => {
              // Get current year from active month or default to current year
              const currentYear = timelineData.activeMonthTab 
                ? parseInt(timelineData.activeMonthTab.split('-')[0])
                : new Date().getFullYear();
              
              // Filter months for current year (max 12 months)
              const currentYearMonths = timelineData.monthTabs.filter(month => {
                const monthYear = parseInt(month.key.split('-')[0]);
                return monthYear === currentYear;
              });
              
              // Get available years for navigation
              const availableYears = [...new Set(timelineData.monthTabs.map(month => 
                parseInt(month.key.split('-')[0])
              ))].sort((a, b) => b - a); // Sort descending (newest first)
              
              const canGoPrevious = availableYears.includes(currentYear + 1);
              const canGoNext = availableYears.includes(currentYear - 1);
              
              return (
                <>
                  {/* Compact year selector */}
                  <div className="year-selector">
                    {canGoNext && (
                      <button 
                        className="year-nav"
                        onClick={() => {
                          const prevYearMonth = timelineData.monthTabs.find(month => 
                            month.key.startsWith(`${currentYear - 1}-`)
                          );
                          if (prevYearMonth && timelineData.onMonthClick) {
                            timelineData.onMonthClick(prevYearMonth.key);
                          }
                        }}
                        title={`Go to ${currentYear - 1}`}
                      >
                        ‹
                      </button>
                    )}
                    
                    <span className="current-year">{currentYear}</span>
                    
                    {canGoPrevious && (
                      <button 
                        className="year-nav"
                        onClick={() => {
                          const nextYearMonth = timelineData.monthTabs.find(month => 
                            month.key.startsWith(`${currentYear + 1}-`)
                          );
                          if (nextYearMonth && timelineData.onMonthClick) {
                            timelineData.onMonthClick(nextYearMonth.key);
                          }
                        }}
                        title={`Go to ${currentYear + 1}`}
                      >
                        ›
                      </button>
                    )}
                  </div>
                  
                  {/* Minimal month indicators */}
                  <div className="month-indicators">
                    {currentYearMonths.reverse().map((month) => {
                      const isActive = timelineData.activeMonthTab === month.key;
                      const isLocked = monthLockStatus && monthLockStatus[month.key]?.isLocked;
                      const lockReason = monthLockStatus && monthLockStatus[month.key]?.lockedReason;
                      
                      const tooltipText = isLocked 
                        ? `${month.name} - ${month.expenses.length} expenses (🔒 Locked - ${lockReason})`
                        : `${month.name} - ${month.expenses.length} expenses`;
                      
                      return (
                        <button
                          key={month.key}
                          className={`month-dot ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                          onClick={() => timelineData.onMonthClick && timelineData.onMonthClick(month.key)}
                          title={tooltipText}
                        >
                          <span className="month-abbrev">{month.name.split(' ')[0].substring(0, 3)}</span>
                          {isLocked && <span className="lock-indicator">🔒</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()
}</div>
        )}
      </div>
    </div>
  );
};

export default BottomTabBar;