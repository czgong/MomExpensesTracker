import React, { useState, useEffect } from 'react';
import './ExpenseSharing.scss';
import { formatPercentage, fixRoundingIssues } from './percentageUtils';

const ExpenseSharing = ({ expenses, participants, setParticipants, persons, onRefreshParticipants }) => {
  // State for monthly summary
  const [monthlySummaries, setMonthlySummaries] = useState([]);
  
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
  
  // Calculate balances for all months and overall
  useEffect(() => {
    const months = getMonths();
    const summaries = months.map(month => {
      const monthlyExpenses = month.expenses;
      const totalMonthlyExpenses = monthlyExpenses.reduce((sum, expense) => sum + parseFloat(expense.cost || 0), 0);
      
      const paid = {};
      const owes = {};
      participants.forEach(person => {
        paid[person.id] = 0;
        owes[person.id] = (person.percentShare / 100) * totalMonthlyExpenses;
      });
      
      monthlyExpenses.forEach(expense => {
        // First try to match by person_id directly
        let paidByParticipant = participants.find(p => p.id === expense.person_id);
        
        // If no match by ID, try to match by name (backward compatibility)
        if (!paidByParticipant && expense.purchasedBy) {
          paidByParticipant = participants.find(p => 
            p.name.toLowerCase() === expense.purchasedBy.toLowerCase()
          );
        }
        
        if (paidByParticipant) {
          paid[paidByParticipant.id] = (paid[paidByParticipant.id] || 0) + parseFloat(expense.cost || 0);
        }
      });
      
      const balances = participants.map(person => {
        return {
          id: person.id,
          name: person.name,
          paid: paid[person.id] || 0,
          owes: owes[person.id] || 0,
          netBalance: (paid[person.id] || 0) - (owes[person.id] || 0)
        };
      });
      
      return {
        month: month.name,
        key: month.key,
        totalExpenses: totalMonthlyExpenses,
        balances
      };
    });
    
    // Add overall summary
    const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.cost || 0), 0);
    
    const overallPaid = {};
    const overallOwes = {};
    participants.forEach(person => {
      overallPaid[person.id] = 0;
      overallOwes[person.id] = (person.percentShare / 100) * totalExpenses;
    });
    
    expenses.forEach(expense => {
      // First try to match by person_id directly
      let paidByParticipant = participants.find(p => p.id === expense.person_id);
      
      // If no match by ID, try to match by name (backward compatibility)
      if (!paidByParticipant && expense.purchasedBy) {
        paidByParticipant = participants.find(p => 
          p.name.toLowerCase() === expense.purchasedBy.toLowerCase()
        );
      }
      
      if (paidByParticipant) {
        overallPaid[paidByParticipant.id] = (overallPaid[paidByParticipant.id] || 0) + parseFloat(expense.cost || 0);
      }
    });
    
    const overallBalances = participants.map(person => {
      return {
        id: person.id,
        name: person.name,
        paid: overallPaid[person.id] || 0,
        owes: overallOwes[person.id] || 0,
        netBalance: (overallPaid[person.id] || 0) - (overallOwes[person.id] || 0)
      };
    });
    
    const overallSummary = {
      month: 'Overall',
      key: 'overall',
      totalExpenses,
      balances: overallBalances
    };
    
    setMonthlySummaries([overallSummary, ...summaries]);
  }, [expenses, participants]);
  
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
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExpenseSharing;