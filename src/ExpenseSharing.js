import React, { useState, useEffect } from 'react';
import './ExpenseSharing.scss'; // You'll need to create this file for styling

const ExpenseSharing = ({ expenses }) => {
  // State for managing participants
  const [participants, setParticipants] = useState([
    { id: 1, name: 'Person 1', percentShare: 50 },
    { id: 2, name: 'Person 2', percentShare: 50 }
  ]);

  // State for new participant
  const [newParticipant, setNewParticipant] = useState({ name: '', percentShare: '' });
  
  // Calculate totals and balances
  const [summary, setSummary] = useState({
    totalExpenses: 0,
    balances: []
  });
  
  // Recalculate balances when expenses or participants change
  useEffect(() => {
    calculateBalances();
  }, [expenses, participants]);
  
  // Calculate who owes what
  const calculateBalances = () => {
    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.cost || 0), 0);
    
    // Initialize amounts paid and owed
    const paid = {};
    const owes = {};
    participants.forEach(person => {
      paid[person.id] = 0;
      owes[person.id] = (person.percentShare / 100) * totalExpenses;
    });
    
    // Calculate what each person has paid
    expenses.forEach(expense => {
      // Find participant that matches the purchasedBy field
      const paidByParticipant = participants.find(
        p => p.name.toLowerCase() === (expense.purchasedBy || expense.purchased_by || '').toLowerCase()
      );
      
      if (paidByParticipant) {
        paid[paidByParticipant.id] = (paid[paidByParticipant.id] || 0) + parseFloat(expense.cost || 0);
      }
    });
    
    // Calculate net balances
    const balances = participants.map(person => {
      return {
        id: person.id,
        name: person.name,
        paid: paid[person.id] || 0,
        owes: owes[person.id] || 0,
        netBalance: (paid[person.id] || 0) - (owes[person.id] || 0)
      };
    });
    
    setSummary({
      totalExpenses,
      balances
    });
  };
  
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

  // Save participants to localStorage
  useEffect(() => {
    localStorage.setItem('participants', JSON.stringify(participants));
  }, [participants]);

  // Load participants from localStorage on mount
  useEffect(() => {
    const savedParticipants = localStorage.getItem('participants');
    if (savedParticipants) {
      try {
        setParticipants(JSON.parse(savedParticipants));
      } catch (e) {
        console.error("Error parsing saved participants:", e);
      }
    }
  }, []);
  
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
                <td>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={person.percentShare}
                    onChange={(e) => handlePercentChange(person.id, e.target.value)}
                    onBlur={() => adjustPercentages(participants)}
                    className="percent-input"
                  />%
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
          <div className="form-group">
            <label>Percentage Share</label>
            <input
              type="number"
              name="percentShare"
              min="0"
              max="100"
              value={newParticipant.percentShare}
              onChange={handleParticipantChange}
              required
            />%
          </div>
          <button type="submit" className="add-button">Add Person</button>
        </form>
      </div>
      
      {/* Summary & Balances */}
      <div className="sharing-section">
        <h3>Sharing Summary</h3>
        
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
    </div>
  );
};

export default ExpenseSharing;