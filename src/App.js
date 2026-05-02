import './App.scss';
import React, { useEffect, useState, useMemo } from 'react';
import { FaPlus, FaCheck, FaTimes } from 'react-icons/fa';
import API_URL from './config';
import BottomTabBar from './components/BottomTabBar';
import ReportsView from './components/ReportsView';
import BalancesView from './components/BalancesView';
import MonthPicker from './components/MonthPicker';

// App successfully deployed and working!

function App() {
  const [expenses, setExpenses] = useState([]);
  // Remove showSharing state since we're not using the tab anymore
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState({}); // Track payment status by settlement ID
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [outstandingBalances, setOutstandingBalances] = useState([]);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);
  const [monthStatuses, setMonthStatuses] = useState({}); // Track locked status by month_key
  const [newExpense, setNewExpense] = useState({
    cost: '',
    person_id: null,
    date: new Date().toISOString().split('T')[0],
    comment: '',
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
  
  // View toggle state - true for cards, false for table
  
  // Main tab state - 'expenses', 'reports', or 'settings'
  const [activeMainTab, setActiveMainTab] = useState('expenses');
  
  // Mobile responsive states
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [savingExpenses, setSavingExpenses] = useState({});
  // Delete confirmation modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  // Add a new state to store the original percentages before editing
const [originalParticipants, setOriginalParticipants] = useState([]);

  // Mobile breakpoint detection
  useEffect(() => {
    const checkMobile = () => {
      const wasMobile = isMobile;
      const nowMobile = window.innerWidth <= 768;
      setIsMobile(nowMobile);
      
      // Clear expansion state when switching between mobile and desktop
      if (wasMobile !== nowMobile) {
        setExpandedRowId(null);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobile]);

  // Function to format a percentage to one decimal place
  const formatPercentage = (value) => {
    return parseFloat(parseFloat(value).toFixed(1));
  };

  // Mobile row expansion handlers
  const toggleRowExpansion = (expenseId) => {
    // Prevent expansion if any expense is in edit mode
    const anyEditing = expenses.some(expense => expense.isEditing);
    if (anyEditing) return;
    
    setExpandedRowId(expandedRowId === expenseId ? null : expenseId);
  };

  const isRowExpanded = (expenseId) => {
    return expandedRowId === expenseId;
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
      const response = await fetch(`${API_URL}/api/persons`);
      const data = await response.json();
      
      // If server response indicates error, handle it appropriately
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch persons');
      }

      // Set persons state with the data
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
  
  // Load percentage shares for a specific month.
  // If the month has no record, inherit from the most recent month STRICTLY
  // BEFORE this one — never from a later month, otherwise saving shares for a
  // newer month would retroactively change every earlier unsaved month.
  const loadMonthlyShares = async (monthKey, personsData) => {
    try {
      const response = await fetch(`${API_URL}/api/monthly-shares/${monthKey}`);
      if (response.ok) {
        const monthlyShares = await response.json();

        if (Object.keys(monthlyShares).length === 0) {
          const inheritResponse = await fetch(
            `${API_URL}/api/latest-shares?before=${encodeURIComponent(monthKey)}`
          );
          if (inheritResponse.ok) {
            const inherited = await inheritResponse.json();
            return inherited;
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
    
    setParticipants(newParticipants);
    
    // Clear any editing states
    setEditingParticipants({});
  };

  // Update fetchExpenses to handle the new data structure
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
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
        comment: expense.comment,
        created_at: expense.created_at || new Date().toISOString() // Add creation timestamp
      }));

      // Sort by expense date (newest first)
      const sortedExpenses = processedExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

      setExpenses(sortedExpenses);

      // Set default active tab to most recent month if we have expenses
      if (processedExpenses.length > 0) {
        const months = getMonthTabs(processedExpenses);
        if (months.length > 0) {
          setActiveMonthTab(months[0].key);
        }
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setError('Failed to load expenses. Please try again.');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch month statuses
  const fetchMonthStatuses = async () => {
    try {
      const response = await fetch(`${API_URL}/api/month-status`);
      if (!response.ok) {
        console.error('Failed to fetch month statuses');
        return;
      }

      const statuses = await response.json();

      // Convert array to object keyed by month_key for easier lookup
      const statusMap = {};
      statuses.forEach(status => {
        statusMap[status.month_key] = status;
      });

      setMonthStatuses(statusMap);
    } catch (error) {
      console.error('Error fetching month statuses:', error);
    }
  };

  useEffect(() => {
    // Fetch persons first, then expenses and month statuses
    fetchPersons()
      .then(() => Promise.all([fetchExpenses(), fetchMonthStatuses()]))
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
      // Extract year and month from the date string directly to avoid timezone issues
      // expense.date format is typically "YYYY-MM-DD"
      const dateParts = expense.date.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Convert to 0-based month for Date constructor
      
      // Create a key for year-month (e.g., "2025-05")
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      // Get the month name using the extracted year and month
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
    return Object.values(monthsMap).map(month => ({
      ...month,
      expenses: month.expenses.sort((a, b) => new Date(b.date) - new Date(a.date))
    })).sort((a, b) => {
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
          created_at: exp.created_at || new Date().toISOString(),
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
    // Validate required fields before submitting
    if (!newExpense.person_id) {
      alert("Please select a person for this expense.");
      return;
    }

    if (!newExpense.cost || parseFloat(newExpense.cost) <= 0) {
      alert("Please enter a valid cost amount.");
      return;
    }

    // Block adding to a locked month
    if (newExpense.date) {
      const [y, m] = newExpense.date.split('-');
      const targetMonthKey = `${y}-${m}`;
      if (monthStatuses[targetMonthKey]?.locked) {
        alert(`${targetMonthKey} is locked. Pick a date in an unlocked month.`);
        return;
      }
    }

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
        const newExpenses = Array.isArray(result) ? result : [result];
        
        const newExpensesProcessed = newExpenses.map(exp => ({
          id: exp.id,
          cost: exp.cost,
          person_id: exp.person_id,
          purchasedBy: exp.person?.name || 'Unknown',
          date: exp.date,
          comment: exp.comment,
          created_at: exp.created_at || new Date().toISOString()
        }));
        
        setExpenses(prev => [...prev, ...newExpensesProcessed]);
        
        // Reset form for next expense
        setNewExpense({
          cost: '',
          person_id: null,
          date: new Date().toISOString().split('T')[0],
          comment: '',
        });
        
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
    // Check if month is locked when trying to edit
    if (editing) {
      const expenseData = expenses[index];
      const expenseDate = expenseData.date;
      const dateParts = expenseDate.split('-');
      const monthKey = `${dateParts[0]}-${dateParts[1]}`;

      if (monthStatuses[monthKey]?.locked) {
        alert('This month is locked. Cannot edit expenses from a completed month.');
        return;
      }
    }

    setExpenses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isEditing: editing };

      // Clear mobile expansion state when entering edit mode
      if (editing) {
        setExpandedRowId(null);
      }

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
    
    
    // Set loading state for this specific expense
    setSavingExpenses(prev => ({ ...prev, [expenseToUpdate.id]: true }));
    
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
      .catch(error => console.error("Error updating expense:", error))
      .finally(() => {
        // Clear loading state
        setSavingExpenses(prev => {
          const updated = { ...prev };
          delete updated[expenseToUpdate.id];
          return updated;
        });
      });
  };

  const saveExpense = (index) => {
    updateExpense(index);
  };

  const deleteExpense = (index) => {
    const expenseData = expenses[index];

    if (!expenseData.id || isNaN(expenseData.id)) {
      console.error("Invalid expense id. Cannot delete:", expenseData);
      return;
    }

    // Check if month is locked
    const expenseDate = expenseData.date;
    const dateParts = expenseDate.split('-');
    const monthKey = `${dateParts[0]}-${dateParts[1]}`;

    if (monthStatuses[monthKey]?.locked) {
      alert('This month is locked. Cannot delete expenses from a completed month.');
      return;
    }

    // Show custom confirmation modal
    setExpenseToDelete({ ...expenseData, index });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteExpense = () => {
    if (!expenseToDelete) return;
    
    
    const expenseId = expenseToDelete.id;
    
    fetch(`${API_URL}/api/data/${expenseId}`, { method: 'DELETE' })
      .then(response => {
        if (response.ok) {
          setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
          setShowDeleteConfirm(false);
          setExpenseToDelete(null);
        } else {
          console.error('Failed to delete expense on server.');
          alert('Failed to delete expense. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error deleting expense:', error);
        alert('Error deleting expense. Please try again.');
      });
  };

  const cancelDeleteExpense = () => {
    setShowDeleteConfirm(false);
    setExpenseToDelete(null);
  };
  
  // Calculate payment settlements - who owes whom, accounting for existing payments
  const calculatePaymentSettlements = (balances, existingPayments = {}) => {
    if (!balances || balances.length === 0) return [];
    
    // Create working copy of net balances, adjusted for existing payments
    const workingBalances = balances.map(b => ({
      ...b,
      remainingBalance: b.netBalance
    }));
    
    // Adjust balances based on existing payments
    Object.values(existingPayments).forEach(payment => {
      if (payment.paid) {
        // Find the people involved in this payment
        const fromPersonBalance = workingBalances.find(b => b.id === payment.fromPersonId);
        const toPersonBalance = workingBalances.find(b => b.id === payment.toPersonId);
        
        if (fromPersonBalance && toPersonBalance) {
          // Adjust balances: payer's debt decreases, receiver's credit decreases
          fromPersonBalance.remainingBalance += payment.amount;
          toPersonBalance.remainingBalance -= payment.amount;
        }
      }
    });
    
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
    
    const settlements = calculatePaymentSettlements(balances, paymentStatus);
    
    return {
      totalExpenses: totalMonthlyExpenses,
      balances,
      settlements
    };
  };

  // Calculate total cost for all expenses
  const totalCost = expenses.reduce((sum, expense) => sum + Number(expense.cost), 0).toFixed(2);
  
  // Get months tabs from expenses - memoized to prevent excessive re-renders
  const monthTabs = useMemo(() => getMonthTabs(expenses), [expenses]);
  
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
  
  // Calculate balances whenever active month, expenses, or participants change.
  // For locked months, settlements come from the stored `payments` rows so the
  // in-month table matches the Outstanding Balances banner exactly.
  useEffect(() => {
    if (!activeMonthTab || expenses.length === 0) return;
    const currentMonthTabs = getMonthTabs(expenses);
    const activeMonthData = currentMonthTabs.find(month => month.key === activeMonthTab);
    if (!activeMonthData) return;

    const summary = calculateMonthlyBalances(activeMonthData.expenses);
    const isLocked = monthStatuses[activeMonthData.key]?.locked;

    if (isLocked) {
      fetch(`${API_URL}/api/payments/${activeMonthData.key}`)
        .then(r => (r.ok ? r.json() : {}))
        .then(payments => {
          setPaymentStatus(prev => ({ ...prev, ...payments }));
          const storedSettlements = Object.entries(payments)
            .filter(([, p]) => p && p.from_person_id != null && p.to_person_id != null)
            .map(([id, p]) => ({
              id,
              from: persons.find(x => x.id === p.from_person_id)?.name || 'Unknown',
              fromId: p.from_person_id,
              to: persons.find(x => x.id === p.to_person_id)?.name || 'Unknown',
              toId: p.to_person_id,
              amount: p.amount,
            }));
          setMonthlySummary({
            month: activeMonthData.name,
            key: activeMonthData.key,
            ...summary,
            settlements: storedSettlements,
          });
        })
        .catch(error => console.error('Error fetching locked-month payments:', error));
    } else {
      setMonthlySummary({
        month: activeMonthData.name,
        key: activeMonthData.key,
        ...summary
      });
      fetchPaymentStatuses(activeMonthData.key);
    }
  }, [activeMonthTab, expenses, participants, monthStatuses, persons]);

  // Fetch outstanding balances when expenses, participants, active month, or month statuses change
  useEffect(() => {
    if (expenses.length > 0 && participants.length > 0 && monthTabs.length > 0) {
      fetchOutstandingBalances();
    }
  }, [expenses, participants, activeMonthTab, monthStatuses]);

  // Check auto-lock when payment status or settlements change

  // Separate effect for loading participants when month changes
  useEffect(() => {
    if (activeMonthTab && persons.length > 0) {
      const currentMonthTabs = getMonthTabs(expenses);
      const activeMonthData = currentMonthTabs.find(month => month.key === activeMonthTab);
      if (activeMonthData) {
        syncParticipantsWithPersons(persons, activeMonthData.key, true); // Force reload
      }
    }
  }, [activeMonthTab, persons]); // Remove monthTabs dependency

  // Handle dropdown selection
  const handleMonthDropdownChange = (e) => {
    if (e.target.value) {
      setActiveMonthTab(e.target.value);
    }
  };
  
  // Toggle edit mode for all participants
const toggleAllPercentEdit = (editing) => {
  if (editing && monthStatuses[activeMonthTab]?.locked) {
    alert('This month is locked. Cannot edit percentage shares.');
    return;
  }

  const newEditState = participants.reduce((map, p) => ({
    ...map,
    [p.id]: editing
  }), {});
  
  setEditingParticipants(newEditState);
  
  // If entering edit mode, save a deep copy of the current participants state
  if (editing) {
    setOriginalParticipants(JSON.parse(JSON.stringify(participants)));
  }
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
  };
  
  // Cancel editing and revert to previous values
const cancelPercentEdit = () => {
  // Restore from the backup we created when entering edit mode
  setParticipants(originalParticipants);
  
  // Exit edit mode
  toggleAllPercentEdit(false);
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

  // Complete the month - lock it and create settlement records
  const completeMonth = async (monthKey) => {
    const monthData = monthTabs.find(m => m.key === monthKey);
    if (!monthData) {
      alert('Month not found');
      return;
    }

    const confirmMessage = `Complete ${monthData.name}?\n\nThis will:\n• Lock the month (no more expense edits)\n• Create settlement records in the database\n• Mark all current settlements as official\n\nThis action can be undone by unlocking the month.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoadingPayments(true);

      // Calculate monthly summary for this month
      const monthExpenses = monthData.expenses;
      const totalExpenses = monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.cost || 0), 0);

      // Settlements are computed from the month's own saved shares.
      const monthSummary = await calculateMonthlyBalancesForMonth(monthExpenses, monthKey);
      if (!monthSummary || !monthSummary.settlements) {
        alert('Unable to calculate settlements for this month');
        return;
      }

      if (monthSummary.settlements.length === 0) {
        alert('No settlements to record for this month');
        return;
      }

      // Create payment records for all settlements. Use the IDs the calculator
      // already produced — name lookups against `participants` would re-introduce
      // the active-tab dependency we just fixed.
      const settlementPromises = monthSummary.settlements.map(settlement => {
        if (settlement.fromId == null || settlement.toId == null) {
          console.error('Settlement missing person IDs:', settlement);
          return null;
        }

        return fetch(`${API_URL}/api/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey: settlement.id,
            monthKey: monthKey,
            fromPersonId: settlement.fromId,
            toPersonId: settlement.toId,
            amount: settlement.amount,
            paid: false // Default to unpaid when completing month
          })
        });
      }).filter(Boolean);

      if (settlementPromises.length === 0) {
        alert('Unable to create settlement records - participant data may be missing');
        return;
      }

      // Wait for all settlement records to be created
      await Promise.all(settlementPromises);

      // Mark month as locked
      const lockResponse = await fetch(`${API_URL}/api/month-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthKey: monthKey,
          locked: true,
          lockedBy: 'user',
          totalExpenses: totalExpenses,
          expenseCount: monthExpenses.length
        })
      });

      if (!lockResponse.ok) {
        throw new Error('Failed to lock month');
      }

      // Refresh month statuses
      await fetchMonthStatuses();

      // Refresh payment statuses
      await fetchPaymentStatuses(monthKey);

      alert(`${monthData.name} has been completed and locked!`);

    } catch (error) {
      console.error('Error completing month:', error);
      alert('Failed to complete month. Please try again.');
    } finally {
      setLoadingPayments(false);
    }
  };

  // Fetch all unpaid settlements from previous months
  // UPDATED: Only show settlements from completed/locked months
  const fetchOutstandingBalances = async () => {
    try {
      setLoadingOutstanding(true);

      if (monthTabs.length === 0) {
        setOutstandingBalances([]);
        return;
      }

      // All locked months are candidates — outstanding balance is a global
      // view, not relative to which month tab happens to be active.
      const lockedMonths = monthTabs.filter(month => monthStatuses[month.key]?.locked);

      if (lockedMonths.length === 0) {
        setOutstandingBalances([]);
        return;
      }

      const outstandingSettlements = [];

      // For each previous locked month, fetch payment records
      for (const month of lockedMonths) {
        // Fetch payment statuses for this month
        const response = await fetch(`${API_URL}/api/payments/${month.key}`);
        let monthPayments = {};

        if (response.ok) {
          monthPayments = await response.json();
        }

        // Include all settlements from locked months — paid and unpaid.
        // Paid rows act as the audit trail and can be un-checked to revert.
        Object.entries(monthPayments).forEach(([paymentKey, paymentData]) => {
          const fromPerson = participants.find(p => p.id === paymentData.from_person_id);
          const toPerson = participants.find(p => p.id === paymentData.to_person_id);

          if (fromPerson && toPerson) {
            outstandingSettlements.push({
              id: paymentKey,
              from: fromPerson.name,
              fromId: paymentData.from_person_id,
              to: toPerson.name,
              toId: paymentData.to_person_id,
              amount: paymentData.amount,
              paid: !!paymentData.paid,
              monthKey: month.key,
              monthName: month.name,
              updated_at: paymentData.updated_at,
              created_at: paymentData.created_at
            });
          } else {
            console.warn(`Outstanding balance skipped: Could not find participant for payment ${paymentKey} in ${month.key}`, {
              from_person_id: paymentData.from_person_id,
              to_person_id: paymentData.to_person_id,
              fromPerson,
              toPerson
            });
          }
        });
      }

      setOutstandingBalances(outstandingSettlements);
    } catch (error) {
      console.error('Error fetching outstanding balances:', error);
    } finally {
      setLoadingOutstanding(false);
    }
  };

  // Helper function to calculate balances for a specific month (similar to calculateMonthlyBalances but doesn't use current participants)
  const calculateMonthlyBalancesForMonth = async (monthExpenses, monthKey) => {
    if (!monthExpenses || monthExpenses.length === 0) return null;

    // Load per-month shares so locking always uses that month's actual shares,
    // not whatever the global `participants` state happens to hold.
    const shares = await loadMonthlyShares(monthKey, persons);
    const monthParticipants = persons.map(p => ({
      id: p.id,
      name: p.name,
      percentShare: shares[p.id] != null ? parseFloat(shares[p.id]) : (100 / persons.length),
    }));

    if (monthParticipants.length === 0) return null;

    const totalMonthlyExpenses = monthExpenses.reduce((sum, expense) => sum + parseFloat(expense.cost || 0), 0);

    const paid = {};
    const owes = {};
    monthParticipants.forEach(person => {
      paid[person.id] = 0;
      owes[person.id] = (person.percentShare / 100) * totalMonthlyExpenses;
    });

    monthExpenses.forEach(expense => {
      let paidByParticipant = monthParticipants.find(p => p.id === expense.person_id);

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

    const settlements = calculatePaymentSettlements(balances, {});

    return {
      totalExpenses: totalMonthlyExpenses,
      balances,
      settlements
    };
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

  // Handle navigation from reports to specific month
  const handleNavigateToMonth = (monthKey) => {
    setActiveMonthTab(monthKey);
    setActiveMainTab('expenses'); // Switch back to expenses tab
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <img src="https://i.imgur.com/IHOQAqS.jpg" alt="Siblings" className="header-photo-large" />
          <h1 className="expenses-title">Mother's Expenses</h1>
          
        </div>
      </header>
      
      <div className="main-layout">
        {/* Main Content Area */}
        <div className="content-area">
          {activeMainTab === 'expenses' ? (
            <div className={monthStatuses[activeMonthTab]?.locked ? 'activity-locked-mode' : ''}>
              <MonthPicker
                monthTabs={monthTabs}
                activeMonthTab={activeMonthTab}
                onMonthClick={setActiveMonthTab}
                monthLockStatus={monthStatuses}
              />

              {monthStatuses[activeMonthTab]?.locked && (
                <div className="activity-locked-banner">
                  <span className="activity-locked-icon" aria-hidden="true">🔒</span>
                  <span className="activity-locked-text">
                    {monthTabs.find(m => m.key === activeMonthTab)?.name} is locked.
                    Settlements are frozen — no edits, additions, or share changes.
                  </span>
                </div>
              )}

              <div className="costs-summary">
                <div className="month-cost">
                  <span className="costs-label">This month</span>
                  <span className="costs-value">${monthTotalCost}</span>
                </div>
                <div className="total-cost">
                  <span className="costs-label">All time</span>
                  <span className="costs-value">${totalCost}</span>
                </div>
              </div>

              <details className="shares-panel">
                <summary>
                  <span className="shares-panel-title">Sharing percentages</span>
                  <span className="shares-panel-summary">
                    {participants.map(p => `${p.name} ${p.percentShare}%`).join(' • ')}
                  </span>
                </summary>
                <div className="shares-panel-body">
                  <div className="participants-header">
                    {isAnyParticipantEditing ? (
                      <div className="edit-actions">
                        <button onClick={savePercentages} className="save-button" title="Save changes">
                          ✓ Save
                        </button>
                        <button onClick={cancelPercentEdit} className="cancel-button" title="Cancel changes">
                          ✕ Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleAllPercentEdit(true)}
                        className="edit-button"
                        title={monthStatuses[activeMonthTab]?.locked ? 'Month is locked' : 'Edit percentages'}
                        disabled={monthStatuses[activeMonthTab]?.locked}
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>

                  <div className="participants-grid">
                    {participants.map(person => (
                      <div key={person.id} className="participant-card">
                        <div className="participant-info">
                          <span className="participant-name">{person.name}</span>
                          <div className="participant-percentage">
                            {editingParticipants[person.id] ? (
                              <input
                                type="number"
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {isAnyParticipantEditing && (
                    <div className={
                      Math.abs(participants.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0) - 100) <= 0.1
                        ? "total-percentage valid-total"
                        : "total-percentage invalid-total"
                    }>
                      <strong>Total: {participants.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0).toFixed(1)}%</strong>
                      {Math.abs(participants.reduce((sum, p) => sum + parseFloat(p.percentShare || 0), 0) - 100) > 0.1 && (
                        <span className="warning"> ⚠️ Must equal 100%</span>
                      )}
                    </div>
                  )}
                </div>
              </details>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => { setError(null); fetchExpenses(); }} style={{marginLeft: '10px', fontSize: '0.8rem'}}>
              Retry
            </button>
          </div>
        )}
        
        {loading ? (
          <div className="loading-state" style={{textAlign: 'center', padding: '40px'}}>
            <div className="loading-spinner" style={{margin: '0 auto 20px'}}></div>
            <p>Loading expenses...</p>
          </div>
        ) : isMobile ? (
          // Mobile Progressive Disclosure Layout
          <div className="expenses-mobile-view">
            {activeMonthExpenses.length === 0 ? (
              <div className="mobile-empty-state">
                <span className="empty-icon">💳</span>
                <span>No expenses yet</span>
              </div>
            ) : (
              activeMonthExpenses.map((expense, cardIndex) => {
                // Find the index in the original expenses array
                const index = expenses.findIndex(e => e.id === expense.id);
                const isExpanded = isRowExpanded(expense.id);
                
                
                return (
                  <div 
                    key={expense.id || index} 
                    className={`mobile-expense-row ${expense.isEditing ? 'editing' : ''} ${isExpanded ? 'expanded' : ''}`}
                  >
                    {/* Primary Row - Always Visible */}
                    <div 
                      className="mobile-expense-primary"
                      onClick={() => !expense.isEditing && toggleRowExpansion(expense.id)}
                    >
                      <div className="mobile-expense-main">
                        <div className="mobile-expense-left">
                          <div className="mobile-expense-cost">
                            {expense.isEditing ? (
                              <input
                                type="number"
                                value={expense.cost}
                                onChange={(e) => handleEditChange(index, 'cost', e.target.value)}
                                className="mobile-input cost-input"
                              />
                            ) : (
                              <span className="cost-display">${expense.cost}</span>
                            )}
                          </div>
                          <div className="mobile-expense-date">
                            {expense.isEditing ? (
                              <input
                                type="date"
                                value={expense.date}
                                onChange={(e) => handleEditChange(index, 'date', e.target.value)}
                                className="mobile-input date-input"
                              />
                            ) : (
                              <span className="date-display">{expense.date}</span>
                            )}
                          </div>
                        </div>
                        <div className="mobile-expense-comment">
                          {expense.isEditing ? (
                            <input
                              type="text"
                              value={expense.comment}
                              onChange={(e) => handleEditChange(index, 'comment', e.target.value)}
                              className="mobile-input comment-input"
                              placeholder="Add a note…"
                            />
                          ) : (
                            <span className="comment-text">
                              {expense.comment || <em className="comment-empty">No comment</em>}
                            </span>
                          )}
                        </div>
                      </div>
                      {!expense.isEditing && (
                        <div className="mobile-expand-indicator">
                          <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>▼</span>
                        </div>
                      )}
                    </div>

                    {/* Expanded Details - Only Visible When Expanded */}
                    {(isExpanded || expense.isEditing) && (
                      <div className="mobile-expense-details">
                        <div className="mobile-detail-row">
                          <span className="detail-label">Purchased by:</span>
                          {expense.isEditing ? (
                            <select
                              value={expense.person_id}
                              onChange={(e) => handleEditChange(index, 'person_id', e.target.value)}
                              className="mobile-select"
                            >
                              {persons.map((person) => (
                                <option key={person.id} value={person.id}>
                                  {person.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="detail-value">{expense.purchasedBy}</span>
                          )}
                        </div>

                        {expense.created_at && (
                          <div className="mobile-detail-row">
                            <span className="detail-label">Added:</span>
                            <span className="detail-value">{formatTimestamp(expense.created_at)}</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mobile-actions">
                          {expense.isEditing ? (
                            <>
                              <button 
                                onClick={() => saveExpense(index)} 
                                className="save-btn"
                                disabled={savingExpenses[expense.id]}
                              >
                                {savingExpenses[expense.id] ? '⏳' : <FaCheck />}
                              </button>
                              <button 
                                onClick={() => toggleEdit(index, false)} 
                                className="cancel-btn"
                                disabled={savingExpenses[expense.id]}
                              >
                                <FaTimes />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => toggleEdit(index, true)} className="edit-btn">
                                Edit
                              </button>
                              <button onClick={() => deleteExpense(index)} className="delete-btn">
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // Desktop Table Layout
          <div className="expenses-table-view">
            <table className="expenses-table modern">
              <thead>
                <tr>
                  <th>Cost</th>
                  <th>Purchased By</th>
                  <th>Date</th>
                  <th>Comment</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeMonthExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-cell">
                      <div className="table-empty-state">
                        <span className="empty-icon">💳</span>
                        <span>No expenses yet</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  activeMonthExpenses.map((expense, cardIndex) => {
                    // Find the index in the original expenses array
                    const index = expenses.findIndex(e => e.id === expense.id);
                    
                    
                    return (
                      <tr key={expense.id || index} className={`${expense.isEditing ? 'editing-row' : ''}`}>
                        <td className="cost-cell">
                          {expense.isEditing ? (
                            <input
                              type="number"
                              value={expense.cost}
                              onChange={(e) => handleEditChange(index, 'cost', e.target.value)}
                              className="table-input cost-input-table"
                            />
                          ) : (
                            <span className="cost-display-table">${expense.cost}</span>
                          )}
                        </td>
                        <td>
                          {expense.isEditing ? (
                            <select
                              value={expense.person_id}
                              onChange={(e) => handleEditChange(index, 'person_id', e.target.value)}
                              className="table-select"
                            >
                              {persons.map((person) => (
                                <option key={person.id} value={person.id}>
                                  {person.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="person-name-table">{expense.purchasedBy}</span>
                          )}
                        </td>
                        <td>
                          {expense.isEditing ? (
                            <input
                              type="date"
                              value={expense.date}
                              onChange={(e) => handleEditChange(index, 'date', e.target.value)}
                              className="table-input date-input-table"
                            />
                          ) : (
                            <span className="date-display-table">{expense.date}</span>
                          )}
                        </td>
                        <td>
                          {expense.isEditing ? (
                            <input
                              type="text"
                              value={expense.comment}
                              onChange={(e) => handleEditChange(index, 'comment', e.target.value)}
                              className="table-input comment-input-table"
                              placeholder="Add a note..."
                            />
                          ) : (
                            <span className="comment-text-table">{expense.comment}</span>
                          )}
                        </td>
                        <td className="timestamp-cell">
                          {expense.created_at && (
                            <span className="timestamp-display-table">
                              {formatTimestamp(expense.created_at)}
                            </span>
                          )}
                        </td>
                        <td className="actions-cell">
                          {expense.isEditing ? (
                            <div className="table-actions">
                              <button 
                                onClick={() => saveExpense(index)} 
                                className="save-btn-table"
                                disabled={savingExpenses[expense.id]}
                              >
                                {savingExpenses[expense.id] ? '⏳' : <FaCheck />}
                              </button>
                              <button 
                                onClick={() => toggleEdit(index, false)} 
                                className="cancel-btn-table"
                                disabled={savingExpenses[expense.id]}
                              >
                                <FaTimes />
                              </button>
                            </div>
                          ) : (
                            <div className="table-actions">
                              <button onClick={() => toggleEdit(index, true)} className="edit-btn-table">
                                Edit
                              </button>
                              <button onClick={() => deleteExpense(index)} className="delete-btn-table">
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        
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
              
              {monthlySummary.settlements && monthlySummary.settlements.length > 0
                && !monthStatuses[monthlySummary.key]?.locked && (
                <div className="complete-month-section">
                  <button
                    className="complete-month-btn"
                    onClick={() => completeMonth(monthlySummary.key)}
                    disabled={loadingPayments}
                  >
                    {loadingPayments ? 'Processing…' : 'Complete month'}
                  </button>
                  <p className="complete-month-info">
                    Locks the month and writes settlement records. Manage who has paid in <strong>Balances</strong>.
                  </p>
                </div>
              )}
            </div>
          )}
          
            </div>
          ) : activeMainTab === 'balances' ? (
            <BalancesView
              outstandingBalances={outstandingBalances}
              loadingPayments={loadingPayments}
              isMobile={isMobile}
              onTogglePayment={async (settlement) => {
                await togglePaymentStatus(settlement, settlement.monthKey);
                fetchOutstandingBalances();
              }}
              onNavigateToMonth={(monthKey) => {
                setActiveMonthTab(monthKey);
                setActiveMainTab('expenses');
              }}
            />
          ) : activeMainTab === 'reports' ? (
            /* Reports Content */
            <ReportsView
              expenses={expenses}
              persons={persons}
              monthTabs={monthTabs}
              isMobile={isMobile}
              onNavigateToMonth={handleNavigateToMonth}
              currentMonthParticipants={participants}
            />
          ) : activeMainTab === 'settings' ? (
            /* Settings Content */
            <div className="settings-view">
              <div className="settings-header">
                <h2>Settings & Configuration</h2>
                <p className="settings-subtitle">Manage your expense tracking preferences</p>
              </div>
              
              <div className="settings-content">
                {/* CSV Import Section - will be moved from sidebar */}
                <div className="settings-section">
                  <div className="section-title">
                    <h3>Import Data</h3>
                    <p>Import expenses from CSV files</p>
                  </div>
                  <button 
                    className="settings-button import-btn" 
                    onClick={() => setShowImportDialog(true)}
                  >
                    Import CSV File
                  </button>
                </div>
                
              </div>
            </div>
          ) : null}
        </div>
      </div>
      
      {/* Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeMainTab}
        onTabChange={setActiveMainTab}
        isMobile={isMobile}
        tabBadges={{ balances: outstandingBalances.some(b => !b.paid) }}
      />
      
      {/* Floating plus button — adds to today's month, regardless of which tab is active */}
      {activeMainTab === 'expenses' && (() => {
        const today = new Date();
        const todayMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const todayLocked = monthStatuses[todayMonthKey]?.locked;
        return (
          <button
            className="PlusButton"
            onClick={() => {
              if (todayLocked) {
                alert(`${todayMonthKey} is locked. Cannot add expenses for today.`);
                return;
              }
              setShowAddDialog(true);
            }}
            disabled={todayLocked}
            aria-label="Add Expense"
            title={todayLocked ? `${todayMonthKey} is locked` : 'Add Expense'}
          >
            <FaPlus />
          </button>
        );
      })()}

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
                placeholder="Enter amount"
                step="0.01"
                min="0"
                autoFocus
                inputMode="decimal"
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
                placeholder="What was this for? (optional)"
              />
            </label>
            <div className="dialog-actions">
              <button 
                onClick={handleAddExpense}
                disabled={!newExpense.person_id || !newExpense.cost || parseFloat(newExpense.cost) <= 0 || persons.length === 0}
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
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && expenseToDelete && (
        <div className="dialog-overlay">
          <div className="dialog delete-confirm-dialog">
            <h2>Delete Expense</h2>
            <p>Are you sure you want to delete this expense?</p>
            
            <div className="expense-preview">
              <div className="preview-row">
                <span className="label">Amount:</span>
                <span className="value">${expenseToDelete.cost}</span>
              </div>
              <div className="preview-row">
                <span className="label">Purchased by:</span>
                <span className="value">{expenseToDelete.purchasedBy}</span>
              </div>
              <div className="preview-row">
                <span className="label">Date:</span>
                <span className="value">{expenseToDelete.date}</span>
              </div>
              <div className="preview-row">
                <span className="label">Comment:</span>
                <span className="value">{expenseToDelete.comment || 'No comment'}</span>
              </div>
            </div>
            
            <p className="warning-text">This action cannot be undone.</p>
            
            <div className="dialog-actions">
              <button 
                onClick={confirmDeleteExpense}
                className="delete-confirm-btn"
              >
                Delete
              </button>
              <button 
                onClick={cancelDeleteExpense}
                className="cancel-btn"
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
                      