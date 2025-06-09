import './App.scss';
import React, { useEffect, useState } from 'react';
import { FaPlus, FaCheck, FaTimes, FaUndo } from 'react-icons/fa';
import API_URL from './config';

// DEPLOYMENT TEST - if you see this, the new code is deployed
console.log('🚀 NEW CODE DEPLOYED! API_URL from config:', API_URL);
console.log('🚀 Current timestamp:', new Date().toISOString());

function App() {
  const [expenses, setExpenses] = useState([]);
  // Remove showSharing state since we're not using the tab anymore
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState({}); // Track payment status by settlement ID
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [newExpense, setNewExpense] = useState({
    cost: 0,
    person_id: null,
    date: new Date().toISOString().split('T')[0],
    comment: "New expense",
  });
  const [activeMonthTab, setActiveMonthTab] = useState(null);
  
  // Database people from Supabase
  const [persons, setPersons] = useState([]);
  
  // Participants for expense sharing
  const [participants, setParticipants] = useState([]);
  
  // State for monthly summary
  const [monthlySummary, setMonthlySummary] = useState(null);
  
  // Add a state to track which participants are in edit mode
  const [editingParticipants, setEditingParticipants] = useState({});
  
  // State to track if percentages need validation
  const [needsValidation, setNeedsValidation] = useState(false);

  // Add a new state to store the original percentages before editing
const [originalParticipants, setOriginalParticipants] = useState([]);

  // Function to format a percentage to one decimal place
  const formatPercentage = (value) => {
    return parseFloat(parseFloat(value).toFixed(1));
  };

  // Function to fix rounding issues to ensure percentages sum to exactly 100
  const fixRoundingIssues = (people) => {
    const total = people.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0);
    const diff = 100 - total;
    
    if (Math.abs(diff) > 0.01 && people.length > 0) {
      // Add or subtract the tiny difference from the person with the largest share
      const personWithLargestShare = [...people].sort((a, b) => 
        parseFloat(b.percentShare) - parseFloat(a.percentShare)
      )[0];
      
      const index = people.findIndex(p => p.id === personWithLargestShare.id);
      if (index >= 0) {
        people[index].percentShare = formatPercentage(parseFloat(people[index].percentShare) + diff);
      }
    }
  };

  // Fetch persons from the server
  const fetchPersons = async () => {
    try {
      console.log('Fetching persons...');
      const response = await fetch(`${API_URL}/api/persons`);
      const data = await response.json();
      console.log('Persons response:', data);
      
      // If server response indicates error, handle it appropriately
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch persons');
      }

      // Set persons state with the data
      console.log('Setting persons state:', data);
      setPersons(data);
      
      // Sync participants with persons (will be month-specific later when activeMonthTab is set)
      await syncParticipantsWithPersons(data);
      
      // Set default person_id for newExpense if not set and persons exist
      if (newExpense.person_id === null && data.length > 0) {
        setNewExpense(prev => ({
          ...prev,
          person_id: data[0].id
        }));
      }
    } catch (error) {
      console.error('Error fetching persons:', error);
      alert('Failed to load persons data. Please try again later or contact support.');
    }
  };
  
  // Load percentage shares for a specific month
  const loadMonthlyShares = async (monthKey, personsData) => {
    try {
      const response = await fetch(`${API_URL}/api/monthly-shares/${monthKey}`);
      if (response.ok) {
        const monthlyShares = await response.json();
        
        // If no shares exist for this month, try to inherit from latest month
        if (Object.keys(monthlyShares).length === 0) {
          const latestResponse = await fetch(`${API_URL}/api/latest-shares`);
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

  // Save percentage shares for a specific month
  const saveMonthlyShares = async (monthKey, participants) => {
    try {
      const shares = {};
      participants.forEach(participant => {
        shares[participant.id] = participant.percentShare;
      });
      
      const response = await fetch(`${API_URL}/api/monthly-shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          monthKey: monthKey,
          shares: shares
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save monthly shares');
      }
      
      console.log(`Shares saved for month ${monthKey}`);
    } catch (error) {
      console.error('Error saving monthly shares:', error);
      alert('Failed to save percentage shares. Please try again.');
    }
  };

  // Synchronize participants with persons from the database
  const syncParticipantsWithPersons = async (personsData, monthKey = null, force = false) => {
    if (!personsData || personsData.length === 0) return;
    
    // Use current active month if no monthKey provided
    const targetMonthKey = monthKey || activeMonthTab;
    
    // Skip if we already have participants for this month and not forcing
    if (!force && participants.length === personsData.length && targetMonthKey) {
      return;
    }
    
    let monthlyShares = {};
    if (targetMonthKey) {
      monthlyShares = await loadMonthlyShares(targetMonthKey, personsData);
    }
    
    // Create new participants array from persons with shares
    const newParticipants = personsData.map(person => {
      // Use monthly share if available, otherwise equal distribution
      const percentShare = monthlyShares[person.id] || (100 / personsData.length);
      
      return {
        id: person.id,
        name: person.name,
        percentShare: formatPercentage(percentShare)
      };
    });
    
    // Ensure percentages add up to 100%
    const total = newParticipants.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0);
    if (Math.abs(total - 100) > 0.1) { // Allow a small tolerance
      // Proportionally adjust all percentages
      newParticipants.forEach(p => {
        p.percentShare = formatPercentage((p.percentShare / total) * 100);
      });
      
      // Fix any rounding issues to ensure sum is exactly 100
      fixRoundingIssues(newParticipants);
    }
    
    console.log(`Synchronized participants for month ${targetMonthKey}:`, newParticipants);
    setParticipants(newParticipants);
    
    // Clear any editing states
    setEditingParticipants({});
  };

  // Update fetchExpenses to handle the new data structure
  const fetchExpenses = async () => {
    try {
      const response = await fetch(`${API_URL}/api/data`);
      if (!response.ok) {
        throw new Error('Failed to fetch expenses');
      }
      
      const expensesData = await response.json();
      
      // Process data to match our frontend structure
      const processedExpenses = expensesData.map(expense => ({
        id: expense.id,
        cost: expense.cost,
        person_id: expense.person_id,
        purchasedBy: expense.person?.name || 'Unknown', // Add purchasedBy for backward compatibility
        date: expense.date,
        comment: expense.comment
      }));
      
      setExpenses(processedExpenses);

      // Set default active tab to most recent month if we have expenses
      if (processedExpenses.length > 0) {
        const months = getMonthTabs(processedExpenses);
        if (months.length > 0) {
          setActiveMonthTab(months[0].key);
        }
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setExpenses([]);
    }
  };

  useEffect(() => {
    // Fetch persons first, then expenses
    fetchPersons()
      .then(() => fetchExpenses())
      .catch(error => console.error('Error in initial data loading:', error));
  }, []);
  
  // Save participants to localStorage when they change
  useEffect(() => {
    if (participants.length > 0) {
      localStorage.setItem('participants', JSON.stringify(participants));
    }
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
    // Make sure we have at least one person
    if (persons.length === 0) {
      alert("No persons available. Please add persons first.");
      return;
    }

    const newExpenseData = {
      cost: 0,
      person_id: persons[0].id, // Default to first person
      date: new Date().toISOString().split('T')[0],
      comment: "New expense",
      isEditing: true,
    };

    fetch(`${API_URL}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExpenseData)
    })
      .then((response) => response.json())
      .then((result) => {
        // Handle the response which now includes person data
        const newExpenses = Array.isArray(result) ? result : [result];
        
        const newExpensesProcessed = newExpenses.map(exp => ({
          id: exp.id,
          cost: exp.cost,
          person_id: exp.person_id,
          purchasedBy: exp.person?.name || 'Unknown',
          date: exp.date,
          comment: exp.comment,
          isEditing: true
        }));
        
        setExpenses(prev => [...prev, ...newExpensesProcessed]);

        // Set active tab to the month of the new expense
        if (newExpensesProcessed.length > 0) {
          const dateObj = new Date(newExpensesProcessed[0].date);
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth();
          const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          setActiveMonthTab(monthKey);
        }
      })
      .catch((error) => console.error('Error adding expense:', error));
  };

  const handleAddExpense = () => {
    // Validate that we have a person_id before submitting
    if (!newExpense.person_id) {
      alert("Please select a person for this expense.");
      return;
    }
    
    console.log("Adding expense with data:", newExpense);
    
    fetch(`${API_URL}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExpense)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((result) => {
        console.log("Server response:", result);
        const newExpenses = Array.isArray(result) ? result : [result];
        
        const newExpensesProcessed = newExpenses.map(exp => ({
          id: exp.id,
          cost: exp.cost,
          person_id: exp.person_id,
          purchasedBy: exp.person?.name || 'Unknown',
          date: exp.date,
          comment: exp.comment
        }));
        
        setExpenses(prev => [...prev, ...newExpensesProcessed]);
        setShowAddDialog(false);

        // Set active tab to the month of the new expense
        if (newExpensesProcessed.length > 0) {
          const dateObj = new Date(newExpensesProcessed[0].date);
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth();
          const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          setActiveMonthTab(monthKey);
        }
      })
      .catch((error) => {
        console.error('Error adding expense:', error);
        alert(`Failed to add expense: ${error.message}`);
      });
  };

  const handleEditChange = (index, field, value) => {
    setExpenses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // If changing the person_id, also update the purchasedBy field for compatibility
      if (field === 'person_id') {
        const selectedPerson = persons.find(p => p.id === parseInt(value, 10));
        if (selectedPerson) {
          updated[index].purchasedBy = selectedPerson.name;
        }
      }
      
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
    
    // Prepare data for API call
    const updateData = {
      cost: expenseToUpdate.cost,
      person_id: expenseToUpdate.person_id,
      date: expenseToUpdate.date,
      comment: expenseToUpdate.comment,
    };
    
    fetch(`${API_URL}/api/data/${expenseToUpdate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    })
      .then(response => response.json())
      .then(result => {
        if (!result.error) {
          setExpenses(prev => {
            const updated = [...prev];
            updated[index].isEditing = false;
            return updated;
          });
          
          // Refresh data to ensure we have the most up-to-date info
          fetchExpenses();
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
    fetch(`${API_URL}/api/data/${expenseId}`, { method: 'DELETE' })
      .then(response => {
        if (response.ok) {
          setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
        } else {
          console.error('Failed to delete expense on server.');
        }
      })
      .catch(error => console.error('Error deleting expense:', error));
  };
  
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

  // Calculate balances for the active month
  const calculateMonthlyBalances = (monthExpenses) => {
    if (!monthExpenses || monthExpenses.length === 0) return null;
    
    const totalMonthlyExpenses = monthExpenses.reduce((sum, expense) => sum + parseFloat(expense.cost || 0), 0);
    
    console.log('Calculating balances with participants:', participants.map(p => `${p.name}: ${p.percentShare}%`));
    console.log('Total monthly expenses:', totalMonthlyExpenses);
    
    const paid = {};
    const owes = {};
    participants.forEach(person => {
      paid[person.id] = 0;
      owes[person.id] = (person.percentShare / 100) * totalMonthlyExpenses;
    });
    
    monthExpenses.forEach(expense => {
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
    
    const settlements = calculatePaymentSettlements(balances);
    
    return {
      totalExpenses: totalMonthlyExpenses,
      balances,
      settlements
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
  
  // Calculate balances whenever active month, expenses, or participants change
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
        
        // Fetch payment statuses for this month
        fetchPaymentStatuses(activeMonthData.key);
      }
    }
  }, [activeMonthTab, expenses, participants]); // Re-added participants dependency

  // Separate effect for loading participants when month changes
  useEffect(() => {
    if (activeMonthTab && persons.length > 0) {
      const activeMonthData = monthTabs.find(month => month.key === activeMonthTab);
      if (activeMonthData) {
        syncParticipantsWithPersons(persons, activeMonthData.key, true); // Force reload
      }
    }
  }, [activeMonthTab, persons]); // Only when month or persons change

  // Handle dropdown selection
  const handleMonthDropdownChange = (e) => {
    if (e.target.value) {
      setActiveMonthTab(e.target.value);
    }
  };
  
  // Toggle edit mode for all participants
const toggleAllPercentEdit = (editing) => {
  const newEditState = participants.reduce((map, p) => ({ 
    ...map, 
    [p.id]: editing 
  }), {});
  
  setEditingParticipants(newEditState);
  
  // If entering edit mode, save a deep copy of the current participants state
  if (editing) {
    setOriginalParticipants(JSON.parse(JSON.stringify(participants)));
    setNeedsValidation(false);
  }
};
  // Compatibility function for any remaining references to togglePercentEdit
const togglePercentEdit = (id) => {
  console.warn("togglePercentEdit is deprecated. Use toggleAllPercentEdit instead.");
  toggleAllPercentEdit(true);
};

  // Handle percentage change in edit mode
  const handlePercentChange = (id, newPercent) => {
    // Limit input to one decimal place
    const formattedPercent = formatPercentage(newPercent);
    
    setParticipants(prev => {
      const updated = prev.map(p => 
        p.id === id ? { ...p, percentShare: formattedPercent } : p
      );
      
      // Note: The balance recalculation will happen automatically via useEffect
      // when participants state changes
      
      return updated;
    });
    
    // Mark that we need validation when saving
    setNeedsValidation(true);
  };
  
  // Save edited percentages and validate
  const savePercentages = async () => {
    // Create a copy of the current participants
    const updatedParticipants = [...participants];
    
    // Calculate total percentage
    const total = updatedParticipants.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0);
    
    // Check if percentages sum to 100 (within a small tolerance)
    if (Math.abs(total - 100) > 0.1) {
      const proceed = window.confirm(
        `The total percentage (${total.toFixed(1)}%) does not add up to 100%. ` +
        `Would you like to adjust the values proportionally to sum to 100%?`
      );
      
      if (proceed) {
        // Proportionally adjust percentages
        updatedParticipants.forEach(p => {
          p.percentShare = formatPercentage((p.percentShare / total) * 100);
        });
        
        // Fix any rounding issues
        fixRoundingIssues(updatedParticipants);
      } else {
        // User chose not to adjust, keep editing
        return;
      }
    }
    
    // Update participants with validated percentages
    setParticipants(updatedParticipants);
    
    // Save to database for current month
    if (activeMonthTab) {
      await saveMonthlyShares(activeMonthTab, updatedParticipants);
    }
    
    // Force recalculation of balances with new percentages
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
    
    // Exit edit mode
    toggleAllPercentEdit(false);
    
    // Clear validation flag
    setNeedsValidation(false);
  };
  
  // Cancel editing and revert to previous values
const cancelPercentEdit = () => {
  // Restore from the backup we created when entering edit mode
  setParticipants(originalParticipants);
  
  // Exit edit mode
  toggleAllPercentEdit(false);
  
  // Clear validation flag
  setNeedsValidation(false);
};
  
  // Reset all percentages to equal distribution
  const resetPercentages = async () => {
    if (!participants.length) return;
    
    const equalShare = formatPercentage(100 / participants.length);
    const updatedParticipants = participants.map(p => ({
      ...p,
      percentShare: equalShare
    }));
    
    // Fix any rounding issues
    fixRoundingIssues(updatedParticipants);
    
    setParticipants(updatedParticipants);
    
    // Save to database for current month
    if (activeMonthTab) {
      await saveMonthlyShares(activeMonthTab, updatedParticipants);
    }
    
    // Force recalculation of balances with new percentages
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
  };

  // Handle CSV import
  const handleImportCSV = async () => {
    if (!importFile) {
      alert('Please select a CSV file to import');
      return;
    }

    setImporting(true);
    
    const formData = new FormData();
    formData.append('csv', importFile);

    try {
      const response = await fetch(`${API_URL}/api/import-csv`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Successfully imported ${result.imported} expenses!`);
        setShowImportDialog(false);
        setImportFile(null);
        // Refresh the expenses list
        await fetchExpenses();
      } else {
        console.error('Import error:', result);
        let errorMessage = result.error || 'Failed to import CSV';
        
        if (result.details && Array.isArray(result.details)) {
          errorMessage += '\n\nDetailed errors:\n' + result.details.slice(0, 5).join('\n');
          if (result.details.length > 5) {
            errorMessage += `\n... and ${result.details.length - 5} more errors`;
          }
        }
        
        if (result.sample_format) {
          errorMessage += '\n\n' + result.sample_format;
        }
        
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import CSV file. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  // Fetch payment statuses for a specific month
  const fetchPaymentStatuses = async (monthKey) => {
    try {
      setLoadingPayments(true);
      const response = await fetch(`${API_URL}/api/payments/${monthKey}`);
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
      const response = await fetch(`${API_URL}/api/payments`, {
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
  
  // Check if any participant is in edit mode
  const isAnyParticipantEditing = Object.values(editingParticipants).some(Boolean);

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="expenses-title">Mother's Expenses</h1>
            
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
                          type="number"
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
                          value={expense.person_id}
                          onChange={(e) => handleEditChange(index, 'person_id', e.target.value)}
                        >
                          {persons.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
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
        
        {/* Monthly Balance Breakdown Section */}
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
            
            {/* Payment Settlements Section */}
            {monthlySummary.settlements && monthlySummary.settlements.length > 0 && (
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
                    {monthlySummary.settlements.map(settlement => (
                      <tr key={settlement.id} className={paymentStatus[settlement.id]?.paid ? 'paid-settlement' : 'unpaid-settlement'}>
                        <td>{settlement.from}</td>
                        <td>{settlement.to}</td>
                        <td>${settlement.amount.toFixed(2)}</td>
                        <td className="settlement-status">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={paymentStatus[settlement.id]?.paid || false}
                              onChange={() => togglePaymentStatus(settlement, monthlySummary.key)}
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
                      {monthlySummary.settlements.filter(s => paymentStatus[s.id]?.paid).length} of {monthlySummary.settlements.length} payments completed
                    </strong>
                  </p>
                  {monthlySummary.settlements.every(s => paymentStatus[s.id]?.paid) && (
                    <p className="all-settled">🎉 All payments settled!</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
         {/* Display both monthly and total costs */}
        <div className="costs-summary">
          <div className="month-cost">Current Month Total: ${monthTotalCost}</div>
          <div className="total-cost">Overall Total: ${totalCost}</div>
          <button 
            className="import-csv-button" 
            onClick={() => setShowImportDialog(true)}
          >
            Import CSV
          </button>
        </div>
        {/* Participants Section - Now with edit mode */}
        <div className="sharing-section participants-section">
          <div className="section-header">
            <h3>Participants & Sharing Percentages</h3>
            {isAnyParticipantEditing ? (
              <div className="edit-actions">
                <button onClick={savePercentages} className="save-button">
                  <FaCheck /> Save
                </button>
                <button onClick={cancelPercentEdit} className="cancel-button">
                  <FaTimes /> Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => toggleAllPercentEdit(true)} className="edit-all-button">
                Edit Percentages
              </button>
            )}
          </div>
          
          <p className="info-text">
            These percentages determine how expenses are shared among participants for{' '}
            <strong>{monthlySummary?.month || 'the current month'}</strong>.
            {' '}Changes here only affect this month's calculations.
          </p>
          
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
                  <td className={editingParticipants[person.id] ? "percentage-cell editing" : "percentage-cell"}>
                    {editingParticipants[person.id] ? (
                      <input                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={person.percentShare}
                          onChange={(e) => handlePercentChange(person.id, e.target.value)}
                        className="percent-input"
                      />
                    ) : (
                      <span className="percent-value">{person.percentShare}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="actions-row">
            <button 
              onClick={resetPercentages} 
              className="reset-button"
              disabled={isAnyParticipantEditing}
            >
              <FaUndo /> Reset to Equal Shares
            </button>
            <button 
              onClick={fetchPersons} 
              className="refresh-button"
              disabled={isAnyParticipantEditing}
            >
              Refresh Participants
            </button>
          </div>
          
          {/* Show total percentage during editing with conditional styling */}
          {isAnyParticipantEditing && (
            <div className={
              Math.abs(participants.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0) - 100) <= 0.1 
                ? "total-percentage valid-total" 
                : "total-percentage"
            }>
              Total: {participants.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0).toFixed(1)}%
              {Math.abs(participants.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0) - 100) > 0.1 && (
                <span className="warning"> (Should be 100%)</span>
              )}
            </div>
          )}
          
          <p className="note">
            Note: Participants are synchronized with the people in your database. 
            Percentage shares are saved per month - changing shares for one month won't affect other months.
          </p>
        </div>
      </header>
      
      {/* Floating plus button for adding expenses */}
      <button className="PlusButton" onClick={() => setShowAddDialog(true)} aria-label="Add Expense">
        <FaPlus />
      </button>

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
                value={newExpense.person_id || ''}
                onChange={(e) => setNewExpense({ ...newExpense, person_id: parseInt(e.target.value, 10) })}
              >
                <option value="" disabled>Select a person</option>
                {persons.length > 0 ? (
                  persons.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No persons available</option>
                )}
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
              <button 
                onClick={handleAddExpense}
                disabled={!newExpense.person_id || persons.length === 0}
              >
                Add
              </button>
              <button onClick={() => setShowAddDialog(false)}>Cancel</button>
            </div>
            {persons.length === 0 && (
              <div className="error-message" style={{color: 'red', marginTop: '10px'}}>
                No persons available. Please make sure your database has people records.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Dialog */}
      {showImportDialog && (
        <div className="dialog-overlay">
          <div className="dialog import-dialog">
            <h2>Import Expenses from CSV</h2>
            
            <div className="import-instructions">
              <h3>CSV Format Requirements:</h3>
              <ul>
                <li><strong>Required columns:</strong> cost (or amount), person (or purchased_by), date</li>
                <li><strong>Optional:</strong> comment (or description)</li>
                <li><strong>Date formats:</strong> Flexible - supports YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, "Dec 15 2024", etc.</li>
                <li><strong>Person names</strong> must match exactly: {persons.map(p => p.name).join(', ')}</li>
              </ul>
              
              <div className="sample-format">
                <h4>Example CSV:</h4>
                <pre>
{`cost,person,date,comment
25.50,Person 1,2024-12-15,Groceries
12.00,Person 2,12/15/2024,Lunch
45.75,Person 3,Dec 14 2024,Gas`}
                </pre>
              </div>
            </div>

            <div className="file-upload">
              <label>
                Select CSV File:
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files[0])}
                />
              </label>
              {importFile && (
                <p className="file-selected">Selected: {importFile.name}</p>
              )}
            </div>

            <div className="dialog-actions">
              <button 
                onClick={handleImportCSV}
                disabled={!importFile || importing}
                className="import-button"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
              <button 
                onClick={() => {
                  setShowImportDialog(false);
                  setImportFile(null);
                }}
                disabled={importing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
                      