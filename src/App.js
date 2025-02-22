import logo from './logo.svg';
import './App.scss';
import React, { useEffect, useState } from 'react';
import { FaPlus } from 'react-icons/fa';

function App() {
  const [expenses, setExpenses] = useState([]); 

   // Helper function to fetch expenses from your backend (Supabase table)
  const fetchExpenses = () => {
    fetch('/api/data') // Ensure your Express backend returns expenses from Supabase
      .then((response) => response.json())
      .then((jsonData) => {
        setExpenses(jsonData);
      })
      .catch((error) => console.error('Error fetching expenses:', error));
  };

  // Fetch data from the backend when the component mounts
  useEffect(() => {
    fetchExpenses();
  }, []);

  // Function to add a new expense via a POST request
  const addExpense = () => {
    // Create a new expense with default values; modify as needed or prompt the user
    const newExpense = {
      cost: "$0.00", // Default cost
      purchasedBy: "New Buyer", // Default purchasedBy; adjust as necessary
      date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      comment: "New expense",
    };

    fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newExpense)
    })
      .then((response) => response.json())
      .then((result) => {
        // After successfully adding the expense, refresh the list
        fetchExpenses();
      })
      .catch((error) => console.error('Error adding expense:', error));
  };

  return (
    <div className="App">
      <header className="App-header">
      <img src={logo} className="App-logo" alt="logo" />
      <h1 className="expenses-title">Mother's Expenses</h1>
      <table className="expenses-table">
        <thead>
          <tr>
            <th>Cost</th>
            <th>Purchased By</th>
            <th>Date</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
              <tr>
                <td colSpan="4">No expenses available yet.</td>
              </tr>
            ) : (
              expenses.map((expense, index) => (
                <tr key={index}>
                  <td>{expense.cost}</td>
                  <td>{expense.purchasedBy || expense.purchased_by}</td>
                  <td>{expense.date}</td>
                  <td>{expense.comment}</td>
                </tr>
              ))
            )}
        </tbody>
      </table>
      <a
        className="App-link"
        href="https://reactjs.org"
        target="_blank"
        rel="noopener noreferrer"
      >
        Link to React Docs
      </a>

      </header>

      {/*Plus Button*/}
      <button
        className="PlusButton"
        onClick={addExpense}
        aria-label="Add Expense"
      >
        <FaPlus />
      </button>
  
    </div>
  );
}


export default App;