import React, { useEffect, useMemo, useRef, useState } from 'react';
import './MonthPicker.scss';

const MonthPicker = ({ monthTabs, activeMonthTab, onMonthClick, monthLockStatus }) => {
  const years = useMemo(
    () => [...new Set(monthTabs.map(m => m.key.split('-')[0]))].sort((a, b) => b.localeCompare(a)),
    [monthTabs]
  );

  const activeYear = activeMonthTab ? activeMonthTab.split('-')[0] : years[0];
  const [selectedYear, setSelectedYear] = useState(activeYear);

  // If the active month changes from elsewhere (e.g. tab badge nav), follow it.
  useEffect(() => {
    if (activeMonthTab) {
      setSelectedYear(activeMonthTab.split('-')[0]);
    }
  }, [activeMonthTab]);

  const yearScrollerRef = useRef(null);
  const activeYearRef = useRef(null);
  const monthScrollerRef = useRef(null);
  const activeMonthRef = useRef(null);

  useEffect(() => {
    const center = (parent, el) => {
      if (!parent || !el) return;
      const offset = el.offsetLeft - parent.clientWidth / 2 + el.clientWidth / 2;
      parent.scrollTo({ left: offset, behavior: 'smooth' });
    };
    center(yearScrollerRef.current, activeYearRef.current);
    center(monthScrollerRef.current, activeMonthRef.current);
  }, [selectedYear, activeMonthTab]);

  if (!monthTabs || monthTabs.length === 0) {
    return null;
  }

  const monthsForYear = monthTabs.filter(m => m.key.startsWith(`${selectedYear}-`));
  const showYearRow = years.length > 1;

  return (
    <div className="month-picker">
      {showYearRow && (
        <div className="year-row" ref={yearScrollerRef}>
          {years.map(year => {
            const isSelected = year === selectedYear;
            return (
              <button
                key={year}
                ref={isSelected ? activeYearRef : null}
                type="button"
                className={`year-pill ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}

      <div className="month-row" ref={monthScrollerRef}>
        {monthsForYear.map(month => {
          const isActive = month.key === activeMonthTab;
          const isLocked = !!(monthLockStatus && monthLockStatus[month.key]?.locked);
          const monthLabel = month.name.split(' ')[0]; // e.g. "December 2025" → "December"
          return (
            <button
              key={month.key}
              ref={isActive ? activeMonthRef : null}
              type="button"
              className={`month-pill ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
              onClick={() => onMonthClick(month.key)}
              title={isLocked ? `${month.name} (locked)` : month.name}
              aria-current={isActive ? 'page' : undefined}
            >
              {isLocked && <span className="lock-mark" aria-hidden="true">🔒</span>}
              <span className="month-pill-label">{monthLabel}</span>
              <span className="month-pill-count">{month.expenses.length}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MonthPicker;
