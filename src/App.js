import './App.scss';
import React, { useEffect, useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import ExpenseSharing from './ExpenseSharing';

function App() {
  const [expenses, setExpenses] = useState([]);
  const [showSharing, setShowSharing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newExpense, setNewExpense] = useState({
    cost: 0,
    purchasedBy: "New User",
    date: new Date().toISOString().split('T')[0],
    comment: "New expense",
  });
  const [activeMonthTab, setActiveMonthTab] = useState(null);
  const [personsMap, setPersonsMap] = useState({});
  
  // New state for participants (moved from ExpenseSharing)
  const [participants, setParticipants] = useState([
    { id: 1, name: 'Person 1', percentShare: 50 },
    { id: 2, name: 'Person 2', percentShare: 50 }
  ]);
  
  // State for monthly summary (moved from ExpenseSharing)
  const [monthlySummary, setMonthlySummary] = useState(null);

  // Update fetchExpenses to directly use person.name from the server response
  const fetchExpenses = () => {
    fetch('/api/data')
      .then((response) => response.json())
      .then((jsonData) => {
        const expensesData = jsonData || [];
        setExpenses(expensesData);

        // Extract persons directly from the server response
        const persons = {};
        expensesData.forEach(expense => {
          if (expense.purchasedBy && !persons[expense.purchasedBy]) {
            persons[expense.purchasedBy] = expense.purchasedBy;
          }
        });
        setPersonsMap(persons);

        // Set default active tab to most recent month if we have expenses
        if (expensesData.length > 0) {
          const months = getMonthTabs(expensesData);
          if (months.length > 0) {
            setActiveMonthTab(months[0].key);
          }
        }
      })
      .catch((error) => {
        console.error('Error fetching expenses:', error);
        setExpenses([]);
      });
  };

  useEffect(() => {
    fetchExpenses();
    
    // Load participants from localStorage on mount
    const savedParticipants = localStorage.getItem('participants');
    if (savedParticipants) {
      try {
        setParticipants(JSON.parse(savedParticipants));
      } catch (e) {
        console.error("Error parsing saved participants:", e);
      }
    }
  }, []);
  
  // Save participants to localStorage when they change
  useEffect(() => {
    localStorage.setItem('participants', JSON.stringify(participants));
  }, [participants]);

  // Function to organize expenses by month
  const getMonthTabs = (expensesArray) => {
    // Create an object to group expenses by month
    const monthsMap = {};
    
    expensesArray.forEach(expense => {
      // Extract year and month from the date
      const dateObj = new Date(expense.date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      
      // Create a key for year-month (e.g., "2025-05")
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      // Get the month name
      const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
      const displayName = `${monthName} ${year}`;
      
      // Initialize array for this month if it doesn't exist
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = {
          key: monthKey,
          name: displayName,
          expenses: []
        };
      }
      
      // Add the expense to this month's array
      monthsMap[monthKey].expenses.push(expense);
    });
    
    // Convert the object into an array and sort by date (most recent first)
    return Object.values(monthsMap).sort((a, b) => {
      return b.key.localeCompare(a.key);
    });
  };

  const addExpense = () => {
    const newExpenseData = {
      cost: 0,
      purchasedBy: "New User",
      date: new Date().toISOString().split('T')[0],
      comment: "New expense",
      isEditing: true,
    };

    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExpenseData)
    })
      .then((response) => response.json())
      .then((result) => {
        const newExpenses = Array.isArray(result) ? result : [result];
        const newExpensesWithEdit = newExpenses.map(exp => ({
          ...exp,
          isEditing: true
        }));
        setExpenses(prev => [...prev, ...newExpensesWithEdit]);
        
        // Update persons map
        const persons = { ...personsMap };
        newExpensesWithEdit.forEach(expense => {
          if (expense.purchasedBy && !persons[expense.purchasedBy]) {
            persons[expense.purchasedBy] = expense.purchasedBy;
          }
        });
        setPersonsMap(persons);

        // Set active tab to the month of the new expense
        if (newExpensesWithEdit.length > 0) {
          const dateObj = new Date(newExpensesWithEdit[0].date);
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth();
          const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          setActiveMonthTab(monthKey);
        }
      })
      .catch((error) => console.error('Error adding expense:', error));
  };

  const handleAddExpense = () => {
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExpense)
    })
      .then((response) => response.json())
      .then((result) => {
        const newExpenses = Array.isArray(result) ? result : [result];
        setExpenses(prev => [...prev, ...newExpenses]);
        setShowAddDialog(false);

        // Update persons map
        const persons = { ...personsMap };
        newExpenses.forEach(expense => {
          if (expense.purchasedBy && !persons[expense.purchasedBy]) {
            persons[expense.purchasedBy] = expense.purchasedBy;
          }
        });
        setPersonsMap(persons);

        // Set active tab to the month of the new expense
        if (newExpenses.length > 0) {
          const dateObj = new Date(newExpenses[0].date);
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth();
          const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          setActiveMonthTab(monthKey);
        }
      })
      .catch((error) => console.error('Error adding expense:', error));
  };

  const handleEditChange = (index, field, value) => {
    setExpenses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleEdit = (index, editing) => {
    setExpenses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isEditing: editing };
      
      // If canceling edit, revert to original data by re-fetching
      if (!editing) {
        fetchExpenses();
      }
      
      return updated;
    });
  };

  const updateExpense = (index) => {
    const expenseToUpdate = expenses[index];
    if (!expenseToUpdate.id) {
      console.error("Expense does not have an id. Cannot update:", expenseToUpdate);
      return;
    }
    fetch(`/api/data/${expenseToUpdate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cost: expenseToUpdate.cost,
        purchasedBy: expenseToUpdate.purchasedBy,
        date: expenseToUpdate.date,
        comment: expenseToUpdate.comment,
      })
    })
      .then(response => response.json())
      .then(result => {
        if (!result.error) {
          setExpenses(prev => {
            const updated = [...prev];
            updated[index].isEditing = false;
            return updated;
          });
        } else {
          console.error("Error updating expense:", result.error);
        }
      })
      .catch(error => console.error("Error updating expense:", error));
  };

  const saveExpense = (index) => {
    updateExpense(index);
  };

  const deleteExpense = (index) => {
    const expenseToDelete = expenses[index];
    const expenseId = expenseToDelete.id;
    if (!expenseId || isNaN(expenseId)) {
      console.error("Invalid expense id. Cannot delete:", expenseToDelete);
      return;
    }
    fetch(`/api/data/${expenseId}`, { method: 'DELETE' })
      .then(response => {
        if (response.ok) {
          setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
        } else {
          console.error('Failed to delete expense on server.');
        }
      })
      .catch(error => console.error('Error deleting expense:', error));
  };
  
  // New function to calculate balances for the active month (moved from ExpenseSharing)
  const calculateMonthlyBalances = (monthExpenses) => {
    if (!monthExpenses || monthExpenses.length === 0) return null;
    
    const totalMonthlyExpenses = monthExpenses.reduce((sum, expense) => sum + parseFloat(expense.cost || 0), 0);
    
    const paid = {};
    const owes = {};
    participants.forEach(person => {
      paid[person.id] = 0;
      owes[person.id] = (person.percentShare / 100) * totalMonthlyExpenses;
    });
    
    monthExpenses.forEach(expense => {
      const paidByName = expense.purchasedBy || expense.purchased_by;
      
      if (paidByName) {
        const paidByParticipant = participants.find(p => 
          p.name.toLowerCase() === paidByName.toLowerCase()
        );
        
        if (paidByParticipant) {
          paid[paidByParticipant.id] = (paid[paidByParticipant.id] || 0) + parseFloat(expense.cost || 0);
        }
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
      totalExpenses: totalMonthlyExpenses,
      balances
    };
  };

  // Calculate total cost for all expenses
  const totalCost = expenses.reduce((sum, expense) => sum + Number(expense.cost), 0).toFixed(2);
  
  // Get months tabs from expenses
  const monthTabs = getMonthTabs(expenses);
  
  // Set first month as active if not set
  useEffect(() => {
    if (!activeMonthTab && monthTabs.length > 0) {
      setActiveMonthTab(monthTabs[0].key);
    }
  }, [activeMonthTab, monthTabs]);
  
  // Get expenses for the active month
  const activeMonthExpenses = monthTabs.find(month => month.key === activeMonthTab)?.expenses || [];
  
  // Calculate total cost for the active month
  const monthTotalCost = activeMonthExpenses.reduce((sum, expense) => sum + Number(expense.cost), 0).toFixed(2);
  
  // Calculate balances whenever active month or participants change
  useEffect(() => {
    if (activeMonthTab && monthTabs.length > 0) {
      const activeMonthData = monthTabs.find(month => month.key === activeMonthTab);
      if (activeMonthData) {
        const summary = calculateMonthlyBalances(activeMonthData.expenses);
        setMonthlySummary({
          month: activeMonthData.name,
          key: activeMonthData.key,
          ...summary
        });
      }
    }
  }, [activeMonthTab, participants, expenses]);

  // Handle dropdown selection
  const handleMonthDropdownChange = (e) => {
    if (e.target.value) {
      setActiveMonthTab(e.target.value);
    }
  };
  
  // Functions for participant management (moved from ExpenseSharing)
  const handleAddParticipant = (newParticipant) => {
    if (!newParticipant.name || !newParticipant.percentShare) return;
    
    const newPerson = {
      id: Date.now(),
      name: newParticipant.name,
      percentShare: parseFloat(newParticipant.percentShare)
    };
    
    const updatedParticipants = [...participants, newPerson];
    setParticipants(updatedParticipants);
    
    // Recalculate percentages to ensure they add up to 100%
    adjustPercentages(updatedParticipants);
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
  
  // Handle delete participant
  const handleDeleteParticipant = (id) => {
    if (participants.length <= 2) {
      alert("You need at least two participants!");
      return;
    }
    
    setParticipants(participants.filter(p => p.id !== id));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="expenses-title">Mother's Expenses</h1>
        
        {/* Toggle button for expense sharing view */}
        <div className="view-toggle">
          <button 
            className={!showSharing ? "active-view" : ""} 
            onClick={() => setShowSharing(false)}
          >
            Expenses
          </button>
          <button 
            className={showSharing ? "active-view" : ""} 
            onClick={() => setShowSharing(true)}
          >
            Sharing Calculator
          </button>
        </div>
        
        {/* Expense List View */}
        {!showSharing && (
          <>
            {/* Month tabs navigation - Dropdown on left, then months ordered with most recent on right */}
            {monthTabs.length > 0 && (
              <div className="month-tabs">
                {/* Dropdown for older months on the left */}
                {monthTabs.length > 3 && (
                  <div className="month-dropdown">
                    <select 
                      value={activeMonthTab}
                      onChange={handleMonthDropdownChange}
                      className={monthTabs.slice(3).some(m => m.key === activeMonthTab) ? "active-month-dropdown" : ""}
                    >
                      <option value="" disabled>Older Months</option>
                      {monthTabs.slice(3).map(month => (
                        <option key={month.key} value={month.key}>
                          {month.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Show buttons for the 3 most recent months in reverse order */}
                {monthTabs.slice(0, 3).reverse().map(month => (
                  <button
                    key={month.key}
                    className={activeMonthTab === month.key ? "active-month" : ""}
                    onClick={() => setActiveMonthTab(month.key)}
                  >
                    {month.name}
                  </button>
                ))}
              </div>
            )}
            
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Cost</th>
                  <th>Purchased By</th>
                  <th>Date</th>
                  <th>Comment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeMonthExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="5">No expenses available for this month.</td>
                  </tr>
                ) : (
                  activeMonthExpenses.map((expense) => {
                    // Find the index in the original expenses array
                    const index = expenses.findIndex(e => e.id === expense.id);
                    
                    return (
                      <tr key={expense.id || index}>
                        <td>
                          {expense.isEditing ? (
                            <input
                              type="text"
                              value={expense.cost}
                              onChange={(e) => handleEditChange(index, 'cost', e.target.value)}
                            />
                          ) : (
                            expense.cost
                          )}
                        </td>
                        <td>
                          {expense.isEditing ? (
                            <select
                              value={expense.purchasedBy}
                              onChange={(e) => handleEditChange(index, 'purchasedBy', e.target.value)}
                            >
                              {Object.values(personsMap).map((personName) => (
                                <option key={personName} value={personName}>
                                  {personName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            expense.purchasedBy
                          )}
                        </td>
                        <td>
                          {expense.isEditing ? (
                            <input
                              type="date"
                              value={expense.date}
                              onChange={(e) => handleEditChange(index, 'date', e.target.value)}
                            />
                          ) : (
                            expense.date
                          )}
                        </td>
                        <td>
                          {expense.isEditing ? (
                            <input
                              type="text"
                              value={expense.comment}
                              onChange={(e) => handleEditChange(index, 'comment', e.target.value)}
                            />
                          ) : (
                            expense.comment
                          )}
                        </td>
                        <td className="edit-actions">
                          {expense.isEditing ? (
                            <>
                              <button onClick={() => saveExpense(index)}>Save</button>
                              <button onClick={() => toggleEdit(index, false)} className="cancel-button">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => toggleEdit(index, true)}>Edit</button>
                              <button onClick={() => deleteExpense(index)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
            {/* Display both monthly and total costs */}
            <div className="costs-summary">
              <div className="month-cost">Current Month Total: ${monthTotalCost}</div>
              <div className="total-cost">Overall Total: ${totalCost}</div>
            </div>
            
            {/* Monthly Balance Breakdown Section (New!) */}
            {monthlySummary && monthlySummary.balances && (
              <div className="sharing-section monthly-balance">
                <h3>{monthlySummary.month} Balance Breakdown</h3>
                
                <div className="total-summary">
                  <p>Total Expenses: ${monthlySummary.totalExpenses.toFixed(2)}</p>
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
                    {monthlySummary.balances.map(balance => (
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
            )}
            
            {/* Participants Section */}
            <div className="sharing-section participants-section">
              <h3>Participants & Sharing Percentages</h3>
              
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
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const newParticipant = {
                    name: e.target.elements.name.value,
                    percentShare: e.target.elements.percentShare.value
                  };
                  handleAddParticipant(newParticipant);
                  e.target.reset();
                }} 
                className="add-participant-form"
              >
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
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
                    required
                  />
                </div>
                <button type="submit" className="add-button">Add Person</button>
              </form>
            </div>
          </>
        )}
        
        {/* Expense Sharing View */}
        {showSharing && (
          <ExpenseSharing 
            expenses={expenses} 
            participants={participants}
            setParticipants={setParticipants}
          />
        )}
      </header>
      
      {/* Only show add button in the expenses view */}
      {!showSharing && (
        <button className="PlusButton" onClick={() => setShowAddDialog(true)} aria-label="Add Expense">
          <FaPlus />
        </button>
      )}

      {showAddDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>Add New Expense</h2>
            <label>
              Cost:
              <input
                type="number"
                value={newExpense.cost}
                onChange={(e) => setNewExpense({ ...newExpense, cost: e.target.value })}
              />
            </label>
            <label>
              Purchased By:
              <select
                value={newExpense.purchasedBy}
                onChange={(e) => setNewExpense({ ...newExpense, purchasedBy: e.target.value })}
              >
                {Object.values(personsMap).map((personName) => (
                  <option key={personName} value={personName}>
                    {personName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date:
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
              />
            </label>
            <label>
              Comment:
              <input
                type="text"
                value={newExpense.comment}
                onChange={(e) => setNewExpense({ ...newExpense, comment: e.target.value })}
              />
            </label>
            <div className="dialog-actions">
              <button onClick={handleAddExpense}>Add</button>
              <button onClick={() => setShowAddDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;