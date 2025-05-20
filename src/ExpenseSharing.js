import React, { useState, useEffect } from 'react';
import './ExpenseSharing.scss';

const ExpenseSharing = ({ expenses, participants, setParticipants }) => {
  // State for new participant
  const [newParticipant, setNewParticipant] = useState({ name: '', percentShare: '' });
  
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
        const paidByPersonId = expense.person_id;
        const paidByName = expense.purchasedBy || expense.purchased_by;
        
        // Try to match by id first, then by name
        let paidByParticipant = participants.find(p => p.id === paidByPersonId);
        
        if (!paidByParticipant && paidByName) {
          paidByParticipant = participants.find(p => 
            p.name.toLowerCase() === paidByName.toLowerCase()
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
      const paidByPersonId = expense.person_id;
      const paidByName = expense.purchasedBy || expense.purchased_by;
      
      let paidByParticipant = participants.find(p => p.id === paidByPersonId);
      
      if (!paidByParticipant && paidByName) {
        paidByParticipant = participants.find(p => 
          p.name.toLowerCase() === paidByName.toLowerCase()
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
  
  // Handle adding a new participant
  const handleAddParticipant = (e) => {
    e.preventDefault();
    if (!newParticipant.name || !newParticipant.percentShare) return;
    
    const newPerson = {
      id: Date.now(),
      name: newParticipant.name,
      percentShare: parseFloat(newParticipant.percentShare)
    };
    
    setParticipants([...participants, newPerson]);
    setNewParticipant({ name: '', percentShare: '' });
    
    // Recalculate percentages to ensure they add up to 100%
    adjustPercentages([...participants, newPerson]);
  };

  // Ensure percentages add up to 100%
  const adjustPercentages = (people) => {
    const total = people.reduce((sum, p) => sum + parseFloat(p.percentShare), 0);
    if (total !== 100) {
      // Proportionally adjust all percentages
      const adjustedPeople = people.map(p => ({
        ...p,
        percentShare: (p.percentShare / total) * 100
      }));
      setParticipants(adjustedPeople);
    }
  };
  
  // Update participant percentage
  const handlePercentChange = (id, newPercent) => {
    const updatedParticipants = participants.map(p => 
      p.id === id ? { ...p, percentShare: parseFloat(newPercent) } : p
    );
    setParticipants(updatedParticipants);
  };
  
  // Handle input field changes for new participant
  const handleParticipantChange = (e) => {
    const { name, value } = e.target;
    setNewParticipant({ ...newParticipant, [name]: value });
  };
  
  // Handle delete participant
  const handleDeleteParticipant = (id) => {
    if (participants.length <= 2) {
      alert("You need at least two participants!");
      return;
    }
    
    setParticipants(participants.filter(p => p.id !== id));
  };
  
  return (
    <div className="expense-sharing">
      <h2 className="sharing-title">Expense Sharing</h2>
      
      {/* Participants Section */}
      <div className="sharing-section">
        <h3>Participants & Percentages</h3>
        
        <table className="participants-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Percentage Share</th>
              <th>Actions</th>
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
                    value={person.percentShare}
                    onChange={(e) => handlePercentChange(person.id, e.target.value)}
                    onBlur={() => adjustPercentages(participants)}
                    className="percent-input"
                  />
                </td>
                <td>
                  <button 
                    onClick={() => handleDeleteParticipant(person.id)}
                    className="delete-button"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <form onSubmit={handleAddParticipant} className="add-participant-form">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              value={newParticipant.name}
              onChange={handleParticipantChange}
              required
            />
          </div>
          <div className="form-group percentage-group">
            <label>Percentage Share</label>
            <input
              type="number"
              name="percentShare"
              min="0"
              max="100"
              value={newParticipant.percentShare}
              onChange={handleParticipantChange}
              required
            />
          </div>
          <button type="submit" className="add-button">Add Person</button>
        </form>
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
                        `Gets $${balance.netBalance.toFixed(2)}` : 
                        `Owes $${Math.abs(balance.netBalance).toFixed(2)}`}
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