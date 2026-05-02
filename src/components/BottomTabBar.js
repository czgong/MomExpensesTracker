import React from 'react';
import './BottomTabBar.scss';

const BottomTabBar = ({ activeTab, onTabChange, isMobile, tabBadges = {} }) => {
  const tabs = [
    {
      id: 'expenses',
      label: 'Activity',
      icon: '💳',
      ariaLabel: 'View monthly activity'
    },
    {
      id: 'balances',
      label: 'Balances',
      icon: '💰',
      ariaLabel: 'View outstanding balances and mark payments'
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
      <div className="tab-container">
        <div className="main-tabs">
          {tabs.map(tab => {
            const badge = tabBadges[tab.id];
            return (
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
                    {badge && <span className="tab-badge" aria-label="has unread items" />}
                  </span>
                  <span className="tab-label">{tab.label}</span>
                </div>
                {activeTab === tab.id && <div className="active-indicator" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomTabBar;
