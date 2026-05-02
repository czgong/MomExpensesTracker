import React, { useState, useMemo } from 'react';
import './BalancesView.scss';

const formatTimestamp = (ts) => {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const BalancesView = ({
  outstandingBalances,
  loadingPayments,
  onTogglePayment,
  onNavigateToMonth,
  isMobile,
}) => {
  const [selectedNames, setSelectedNames] = useState(new Set());
  const [showOlderPaid, setShowOlderPaid] = useState(false);

  const toggleNameFilter = (name) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Per-person totals are computed from ALL unpaid (unfiltered) so the cards
  // always reflect the true outstanding picture. Clicking a card filters the
  // detail tables, but doesn't change the totals shown on the cards.
  const allUnpaid = outstandingBalances.filter(s => !s.paid);
  const totals = useMemo(() => {
    const t = {};
    allUnpaid.forEach(s => {
      if (!t[s.from]) t[s.from] = { owes: 0, owed: 0 };
      if (!t[s.to]) t[s.to] = { owes: 0, owed: 0 };
      t[s.from].owes += s.amount;
      t[s.to].owed += s.amount;
    });
    return t;
  }, [allUnpaid]);

  const personEntries = Object.entries(totals)
    .filter(([, t]) => t.owes > 0.01 || t.owed > 0.01)
    .sort(([a], [b]) => a.localeCompare(b));

  const matchesFilter = (s) =>
    selectedNames.size === 0 ||
    selectedNames.has(s.from) ||
    selectedNames.has(s.to);

  const unpaid = allUnpaid.filter(matchesFilter);
  const paid = outstandingBalances
    .filter(s => s.paid)
    .filter(matchesFilter)
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

  // Recent = updated in the last 30 days. Older entries collapse by default
  // so the audit trail doesn't dominate the view.
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const paidRecent = paid.filter(s => new Date(s.updated_at || 0).getTime() >= cutoff);
  const paidOlder = paid.filter(s => new Date(s.updated_at || 0).getTime() < cutoff);

  const totalOutstanding = unpaid.reduce((sum, s) => sum + s.amount, 0);
  const filterActive = selectedNames.size > 0;

  const renderRow = (settlement, checked) => {
    const monthBtn = (
      <button
        type="button"
        className="month-link"
        onClick={() => onNavigateToMonth && onNavigateToMonth(settlement.monthKey)}
        title={`Open ${settlement.monthName}`}
      >
        {settlement.monthName}
      </button>
    );

    if (isMobile) {
      return (
        <li
          key={`${settlement.monthKey}-${settlement.id}`}
          className={`balance-row ${checked ? 'paid' : ''}`}
        >
          <label className="balance-row-checkbox">
            <input
              type="checkbox"
              checked={checked}
              disabled={loadingPayments}
              onChange={() => onTogglePayment(settlement)}
              aria-label={`Toggle ${settlement.from} → ${settlement.to}`}
            />
          </label>
          <div className="balance-row-info">
            <div className="balance-row-pair">
              <span className="balance-row-from">{settlement.from}</span>
              <span className="balance-row-arrow">→</span>
              <span className="balance-row-to">{settlement.to}</span>
            </div>
            <div className="balance-row-meta">
              {monthBtn}
              {checked && settlement.updated_at && (
                <> · paid {formatTimestamp(settlement.updated_at)}</>
              )}
            </div>
          </div>
          <div className="balance-row-amount">${settlement.amount.toFixed(2)}</div>
        </li>
      );
    }

    return (
      <tr
        key={`${settlement.monthKey}-${settlement.id}`}
        className={`outstanding-row ${checked ? 'paid-settlement' : 'unpaid-settlement'}`}
      >
        <td className="settlement-status">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={checked}
              disabled={loadingPayments}
              onChange={() => onTogglePayment(settlement)}
            />
            <span className="checkmark"></span>
          </label>
        </td>
        <td className="month-cell">{monthBtn}</td>
        <td>{settlement.from}</td>
        <td>{settlement.to}</td>
        <td className="amount-col">${settlement.amount.toFixed(2)}</td>
        <td className="paid-when">
          {checked && settlement.updated_at ? formatTimestamp(settlement.updated_at) : ''}
        </td>
      </tr>
    );
  };

  const renderTable = (rows, checked) => (
    isMobile ? (
      <ul className="balance-row-list">
        {rows.map(s => renderRow(s, checked))}
      </ul>
    ) : (
      <table className="settlements-table outstanding-table">
        <thead>
          <tr>
            <th>{checked ? 'Paid' : 'Mark paid'}</th>
            <th>Month</th>
            <th>From</th>
            <th>To</th>
            <th className="amount-col">Amount</th>
            <th>{checked ? 'Paid when' : ''}</th>
          </tr>
        </thead>
        <tbody>{rows.map(s => renderRow(s, checked))}</tbody>
      </table>
    )
  );

  return (
    <div className={`balances-view ${isMobile ? 'mobile' : 'desktop'}`}>
      <div className="balances-header">
        <h2>Balances</h2>
        <p className="balances-subtitle">
          Tap a name to filter. Tap the month to open that month's expenses.
        </p>
      </div>

      {outstandingBalances.length === 0 ? (
        <div className="balances-empty">
          <span className="balances-empty-icon" role="img" aria-label="Celebrate">🎉</span>
          <h3>Nothing here yet</h3>
          <p>Complete a month to start tracking who owes whom.</p>
        </div>
      ) : (
        <>
          {personEntries.length > 0 && (
            <div className="balance-summary-cards">
              {personEntries.map(([name, t]) => {
                const isSelected = selectedNames.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={`balance-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleNameFilter(name)}
                    aria-pressed={isSelected}
                  >
                    <div className="balance-card-name">{name}</div>
                    {t.owes > 0.01 && (
                      <div className="balance-card-line owes">
                        Owes <strong>${t.owes.toFixed(2)}</strong>
                      </div>
                    )}
                    {t.owed > 0.01 && (
                      <div className="balance-card-line owed">
                        Is owed <strong>${t.owed.toFixed(2)}</strong>
                      </div>
                    )}
                  </button>
                );
              })}
              {filterActive && (
                <button
                  type="button"
                  className="balance-card-clear"
                  onClick={() => setSelectedNames(new Set())}
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          <div className="balances-detail">
            <div className="balances-detail-header">
              <h3>
                Unpaid
                {unpaid.length > 0 && <span className="section-count">({unpaid.length})</span>}
                {filterActive && <span className="section-filter"> · filtered</span>}
              </h3>
              <div className="balances-total">
                Outstanding: <strong>${totalOutstanding.toFixed(2)}</strong>
              </div>
            </div>

            {unpaid.length === 0 ? (
              <p className="section-empty">
                {filterActive ? 'No unpaid debts for the selected names.' : 'All caught up. 🎉'}
              </p>
            ) : renderTable(unpaid, false)}
          </div>

          {paid.length > 0 && (
            <div className="balances-detail balances-paid-history">
              <div className="balances-detail-header">
                <h3>
                  Paid history
                  <span className="section-count">({paid.length})</span>
                  {filterActive && <span className="section-filter"> · filtered</span>}
                </h3>
                <div className="balances-paid-note">Uncheck to revert</div>
              </div>

              {paidRecent.length > 0 && renderTable(paidRecent, true)}
              {paidRecent.length === 0 && paidOlder.length > 0 && (
                <p className="section-empty">No payments in the last 30 days.</p>
              )}

              {paidOlder.length > 0 && (
                <div className="paid-older">
                  <button
                    type="button"
                    className="paid-older-toggle"
                    onClick={() => setShowOlderPaid(v => !v)}
                  >
                    {showOlderPaid
                      ? `Hide older (${paidOlder.length})`
                      : `Show older (${paidOlder.length})`}
                  </button>
                  {showOlderPaid && renderTable(paidOlder, true)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BalancesView;
