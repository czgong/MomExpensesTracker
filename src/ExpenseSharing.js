import React, { useState, useEffect } from 'react';
import './ExpenseSharing.scss';
import { formatPercentage, fixRoundingIssues } from './percentageUtils';

const ExpenseSharing = ({ expenses, participants, setParticipants, persons, onRefreshParticipants }) => {
  // State for monthly summary
  const [monthlySummaries, setMonthlySummaries] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState({}); // Track payment status by settlement ID
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [monthlyParticipants, setMonthlyParticipants] = useState({}); // Store participants per month
  
  // Calculate payment settlements - who owes whom
  const calculatePaymentSettlements = (balances) => {
    if (!balances || balances.length === 0) return [];
    
    // Create working copy of net balances
    const workingBalances = balances.map(b => ({
      ...b,
      remainingBalance: b.netBalance
    }));
    
    const settlements = [];
    
    // Find who owes money (negative balance) and who should receive money (positive balance)
    for (let i = 0; i < workingBalances.length; i++) {
      for (let j = 0; j < workingBalances.length; j++) {
        if (i !== j) {
          const creditor = workingBalances[i]; // Person who should receive money
          const debtor = workingBalances[j];   // Person who owes money
          
          if (creditor.remainingBalance > 0.01 && debtor.remainingBalance < -0.01) {
            const settlementAmount = Math.min(
              creditor.remainingBalance, 
              Math.abs(debtor.remainingBalance)
            );
            
            if (settlementAmount > 0.01) { // Only create settlement if amount is significant
              settlements.push({
                from: debtor.name,
                fromId: debtor.id,
                to: creditor.name,
                toId: creditor.id,
                amount: Math.round(settlementAmount * 100) / 100,
                id: `${debtor.id}-${creditor.id}`, // Unique identifier
                paid: false // Default to unpaid
              });
              
              // Update remaining balances
              creditor.remainingBalance -= settlementAmount;
              debtor.remainingBalance += settlementAmount;
            }
          }
        }
      }
    }
    
    return settlements;
  };

  // Get months from expenses
  const getMonths = () => {
    const monthsMap = {};
    
    expenses.forEach(expense => {
      const dateObj = new Date(expense.date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
      const displayName = `${monthName} ${year}`;
      
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = {
          key: monthKey,
          name: displayName,
          expenses: []
        };
      }
      
      monthsMap[monthKey].expenses.push(expense);
    });
    
    return Object.values(monthsMap).sort((a, b) => b.key.localeCompare(a.key));
  };

  // Load percentage shares for a specific month
  const loadMonthlyShares = async (monthKey, personsData) => {
    try {
      const response = await fetch(`/api/monthly-shares/${monthKey}`);
      if (response.ok) {
        const monthlyShares = await response.json();
        
        // If no shares exist for this month, try to inherit from latest month
        if (Object.keys(monthlyShares).length === 0) {
          const latestResponse = await fetch('/api/latest-shares');
          if (latestResponse.ok) {
            const latestShares = await latestResponse.json();
            return latestShares;
          }
        }
        
        return monthlyShares;
      }
    } catch (error) {
      console.error('Error loading monthly shares:', error);
    }
    
    // Fallback to equal distribution
    const equalShare = personsData.length > 0 ? 100 / personsData.length : 0;
    const defaultShares = {};
    personsData.forEach(person => {
      defaultShares[person.id] = parseFloat(equalShare.toFixed(2));
    });
    
    return defaultShares;
  };
  
  // Calculate balances for all months and overall
  useEffect(() => {
    const calculateMonthSummaries = async () => {
      const months = getMonths();
      const summaries = await Promise.all(months.map(async (month) => {
        const monthlyExpenses = month.expenses;
        const totalMonthlyExpenses = monthlyExpenses.reduce((sum, expense) => sum + parseFloat(expense.cost || 0), 0);
        
        // Load month-specific shares
        const monthlyShares = await loadMonthlyShares(month.key, persons);
        
        // Create participants for this month
        const monthParticipants = persons.map(person => ({
          id: person.id,
          name: person.name,
          percentShare: monthlyShares[person.id] || (100 / persons.length)
        }));
        
        // Store monthly participants
        setMonthlyParticipants(prev => ({
          ...prev,
          [month.key]: monthParticipants
        }));
        
        const paid = {};
        const owes = {};
        monthParticipants.forEach(person => {
          paid[person.id] = 0;
          owes[person.id] = (person.percentShare / 100) * totalMonthlyExpenses;
        });
        
        monthlyExpenses.forEach(expense => {
          // First try to match by person_id directly
          let paidByParticipant = monthParticipants.find(p => p.id === expense.person_id);
          
          // If no match by ID, try to match by name (backward compatibility)
          if (!paidByParticipant && expense.purchasedBy) {
            paidByParticipant = monthParticipants.find(p => 
              p.name.toLowerCase() === expense.purchasedBy.toLowerCase()
            );
          }
          
          if (paidByParticipant) {
            paid[paidByParticipant.id] = (paid[paidByParticipant.id] || 0) + parseFloat(expense.cost || 0);
          }
        });
        
        const balances = monthParticipants.map(person => {
          return {
            id: person.id,
            name: person.name,
            paid: paid[person.id] || 0,
            owes: owes[person.id] || 0,
            netBalance: (paid[person.id] || 0) - (owes[person.id] || 0)
          };
        });
        
        const settlements = calculatePaymentSettlements(balances);
        
        return {
          month: month.name,
          key: month.key,
          totalExpenses: totalMonthlyExpenses,
          balances,
          settlements
        };
      }));
      
      // Add overall summary (using average percentages across all months)
      const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.cost || 0), 0);
      
      // For overall, we'll use current participants or equal distribution
      const overallParticipants = participants.length > 0 ? participants : persons.map(person => ({
        id: person.id,
        name: person.name,
        percentShare: 100 / persons.length
      }));
      
      const overallPaid = {};
      const overallOwes = {};
      overallParticipants.forEach(person => {
        overallPaid[person.id] = 0;
        overallOwes[person.id] = (person.percentShare / 100) * totalExpenses;
      });
      
      expenses.forEach(expense => {
        // First try to match by person_id directly
        let paidByParticipant = overallParticipants.find(p => p.id === expense.person_id);
        
        // If no match by ID, try to match by name (backward compatibility)
        if (!paidByParticipant && expense.purchasedBy) {
          paidByParticipant = overallParticipants.find(p => 
            p.name.toLowerCase() === expense.purchasedBy.toLowerCase()
          );
        }
        
        if (paidByParticipant) {
          overallPaid[paidByParticipant.id] = (overallPaid[paidByParticipant.id] || 0) + parseFloat(expense.cost || 0);
        }
      });
      
      const overallBalances = overallParticipants.map(person => {
        return {
          id: person.id,
          name: person.name,
          paid: overallPaid[person.id] || 0,
          owes: overallOwes[person.id] || 0,
          netBalance: (overallPaid[person.id] || 0) - (overallOwes[person.id] || 0)
        };
      });
      
      const overallSettlements = calculatePaymentSettlements(overallBalances);
      
      const overallSummary = {
        month: 'Overall',
        key: 'overall',
        totalExpenses,
        balances: overallBalances,
        settlements: overallSettlements
      };
      
      setMonthlySummaries([overallSummary, ...summaries]);
      
      // Fetch payment statuses for all months
      [overallSummary, ...summaries].forEach(summary => {
        fetchPaymentStatuses(summary.key);
      });
    };
    
    if (persons.length > 0) {
      calculateMonthSummaries();
    }
  }, [expenses, persons]); // Removed participants to avoid dependency issues
  
  // Update participant percentage
  const handlePercentChange = (id, newPercent) => {
    // Limit input to one decimal place
    const formattedPercent = formatPercentage(newPercent);
    
    const updatedParticipants = participants.map(p => 
      p.id === id ? { ...p, percentShare: formattedPercent } : p
    );
    setParticipants(updatedParticipants);
    
    // After changing a percentage, adjust all percentages to ensure they sum to 100
    adjustPercentages(updatedParticipants);
  };
  
  // Ensure percentages add up to 100%
  const adjustPercentages = (people) => {
    const total = people.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0);
    
    if (Math.abs(total - 100) > 0.1) { // Only adjust if difference is significant
      // Proportionally adjust all percentages
      const adjustedPeople = people.map(p => ({
        ...p,
        percentShare: formatPercentage((p.percentShare / total) * 100)
      }));
      
      // Fix any rounding issues to ensure sum is exactly 100
      fixRoundingIssues(adjustedPeople);
      
      setParticipants(adjustedPeople);
    }
  };
  
  // Reset all percentages to equal distribution
  const resetPercentages = () => {
    if (!participants.length) return;
    
    const equalShare = formatPercentage(100 / participants.length);
    const updatedParticipants = participants.map(p => ({
      ...p,
      percentShare: equalShare
    }));
    
    // Fix any rounding issues
    fixRoundingIssues(updatedParticipants);
    
    setParticipants(updatedParticipants);
  };

  // Fetch payment statuses for a specific month
  const fetchPaymentStatuses = async (monthKey) => {
    try {
      setLoadingPayments(true);
      const response = await fetch(`/api/payments/${monthKey}`);
      if (response.ok) {
        const payments = await response.json();
        setPaymentStatus(prev => ({
          ...prev,
          ...payments
        }));
      }
    } catch (error) {
      console.error('Error fetching payment statuses:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Toggle payment status for a settlement and persist to backend
  const togglePaymentStatus = async (settlement, monthKey) => {
    const currentStatus = paymentStatus[settlement.id];
    const newPaidStatus = !(currentStatus?.paid || false);
    
    // Optimistic update with timestamp
    const now = new Date().toISOString();
    setPaymentStatus(prev => ({
      ...prev,
      [settlement.id]: {
        paid: newPaidStatus,
        updated_at: now,
        created_at: currentStatus?.created_at || now
      }
    }));

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentKey: settlement.id,
          monthKey: monthKey,
          fromPersonId: settlement.fromId,
          toPersonId: settlement.toId,
          amount: settlement.amount,
          paid: newPaidStatus
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update payment status');
      }
      
      // Refresh payment status to get accurate server timestamp
      fetchPaymentStatuses(monthKey);
    } catch (error) {
      console.error('Error updating payment status:', error);
      // Revert optimistic update on error
      setPaymentStatus(prev => ({
        ...prev,
        [settlement.id]: currentStatus || { paid: false }
      }));
      alert('Failed to update payment status. Please try again.');
    }
  };

  // Helper function to format timestamps
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older dates, show the actual date
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="expense-sharing">
      <h2 className="sharing-title">Expense Sharing</h2>
      
      {/* Participants Section */}
      <div className="sharing-section">
        <h3>Participants & Percentages</h3>
        <p className="info-text">These percentages determine how expenses are shared among participants.</p>
        
        <table className="participants-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Percentage Share</th>
            </tr>
          </thead>
          <tbody>
            {participants.map(person => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td className="percentage-cell">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={person.percentShare}
                    onChange={(e) => handlePercentChange(person.id, e.target.value)}
                    onBlur={() => adjustPercentages(participants)}
                    className="percent-input"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="actions-row">
          <button 
            onClick={resetPercentages} 
            className="reset-button"
          >
            Reset to Equal Shares
          </button>
          <button 
            onClick={onRefreshParticipants} 
            className="refresh-button"
          >
            Refresh Participants
          </button>
        </div>
        <p className="note">Note: Participants are synchronized with the people in your database.</p>
      </div>
      
      {/* Monthly Summaries & Balances */}
      <div className="monthly-summaries">
        {monthlySummaries.map((summary) => (
          <div key={summary.key} className="sharing-section">
            <h3>{summary.month} Summary</h3>
            
            <div className="total-summary">
              <p>Total Expenses: ${summary.totalExpenses.toFixed(2)}</p>
            </div>
            
            <h4>Who Owes What</h4>
            
            <table className="balances-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Paid</th>
                  <th>Owes</th>
                  <th>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {summary.balances.map(balance => (
                  <tr key={balance.id}>
                    <td>{balance.name}</td>
                    <td>${balance.paid.toFixed(2)}</td>
                    <td>${balance.owes.toFixed(2)}</td>
                    <td className={balance.netBalance >= 0 ? 'positive-balance' : 'negative-balance'}>
                      {balance.netBalance >= 0 ? 
                        `Gets ${balance.netBalance.toFixed(2)}` : 
                        `Owes ${Math.abs(balance.netBalance).toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Payment Settlements Section */}
            {summary.settlements && summary.settlements.length > 0 && (
              <>
                <h4>Payment Settlements</h4>
                <p className="settlement-info">Who needs to pay whom to settle all balances:</p>
                
                <table className="settlements-table">
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>To</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.settlements.map(settlement => (
                      <tr key={settlement.id} className={paymentStatus[settlement.id]?.paid ? 'paid-settlement' : 'unpaid-settlement'}>
                        <td>{settlement.from}</td>
                        <td>{settlement.to}</td>
                        <td>${settlement.amount.toFixed(2)}</td>
                        <td className="settlement-status">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={paymentStatus[settlement.id]?.paid || false}
                              onChange={() => togglePaymentStatus(settlement, summary.key)}
                              disabled={loadingPayments}
                            />
                            <span className="checkmark"></span>
                            <div className="status-info">
                              <span className="status-text">
                                {paymentStatus[settlement.id]?.paid ? 'Paid' : 'Unpaid'}
                              </span>
                              {paymentStatus[settlement.id]?.updated_at && (
                                <span className="timestamp">
                                  {formatTimestamp(paymentStatus[settlement.id].updated_at)}
                                </span>
                              )}
                            </div>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Settlement Summary */}
                <div className="settlement-summary">
                  <p>
                    <strong>
                      {summary.settlements.filter(s => paymentStatus[s.id]?.paid).length} of {summary.settlements.length} payments completed
                    </strong>
                  </p>
                  {summary.settlements.every(s => paymentStatus[s.id]?.paid) && (
                    <p className="all-settled">🎉 All payments settled!</p>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExpenseSharing;