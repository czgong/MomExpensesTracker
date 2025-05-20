import logo from './logo.svg';
import './App.scss';
import React, { useEffect, useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import ExpenseSharing from './ExpenseSharing'; // Import the new component

function App() {
  const [expenses, setExpenses] = useState([]);
  const [showSharing, setShowSharing] = useState(false); // Toggle for showing/hiding the sharing section

  const fetchExpenses = () => {
    fetch('/api/data')
      .then((response) => response.json())
      .then((jsonData) => setExpenses(jsonData || []))
      .catch((error) => {
        console.error('Error fetching expenses:', error);
        setExpenses([]);
      });
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const addExpense = () => {
    const newExpense = {
      cost: 0,
      purchasedBy: "New User",
      date: new Date().toISOString().split('T')[0],
      comment: "New expense",
      isEditing: true,
    };

    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExpense)
    })
      .then((response) => response.json())
      .then((result) => {
        const newExpenses = Array.isArray(result) ? result : [result];
        const newExpensesWithEdit = newExpenses.map(exp => ({
          ...exp,
          isEditing: true
        }));
        setExpenses(prev => [...prev, ...newExpensesWithEdit]);
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

  // Calculate total cost by summing the cost of each expense
  const totalCost = expenses.reduce((sum, expense) => sum + Number(expense.cost), 0).toFixed(2);

  // Toggle the expense sharing view
  const toggleSharingView = () => {
    setShowSharing(prev => !prev);
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
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
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Cost</th>
                  <th>Purchased By</th>
                  <th>Date</th>
                  <th>Comment</th>
                  <th className="edit-col-header"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="5">No expenses available yet.</td>
                  </tr>
                ) : (
                  expenses.map((expense, index) => (
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
                          <input
                            type="text"
                            value={expense.purchasedBy || expense.purchased_by}
                            onChange={(e) => handleEditChange(index, 'purchasedBy', e.target.value)}
                          />
                        ) : (
                          expense.purchasedBy || expense.purchased_by
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
                      <td className="edit-col">
                        {expense.isEditing ? (
                          <button onClick={() => saveExpense(index)}>Save</button>
                        ) : (
                          <>
                            <button onClick={() => toggleEdit(index, true)}>Edit</button>
                            <button onClick={() => deleteExpense(index)}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="total-cost">Total Cost: ${totalCost}</div>
    
          </>
        )}
        
        {/* Expense Sharing View */}
        {showSharing && (
          <ExpenseSharing expenses={expenses} />
        )}
      </header>
      
      {/* Only show add button in the expenses view */}
      {!showSharing && (
        <button className="PlusButton" onClick={addExpense} aria-label="Add Expense">
          <FaPlus />
        </button>
      )}
    </div>
  );
}

export default App;