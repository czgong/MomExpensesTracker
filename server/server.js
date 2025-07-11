// server/server.js
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add final field
  result.push(current);
  return result;
}

const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express(); // Initialize Express app
const PORT = process.env.PORT || 5001; // Define PORT

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://mom-expenses-tracker.vercel.app',
    'https://mom-expenses-tracker-czgongs-projects.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept'],
  credentials: false
};

app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET endpoint to retrieve data with person names
app.get('/api/data', async (req, res) => {
  try {
    // First get all people
    const { data: people } = await supabase
      .from('people')
      .select('id, name');

    // Then get all expenses with created_at timestamp
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false }); // Order by creation time, newest first

    if (error) {
      console.error('Supabase GET error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Map person data to each expense
    const expensesWithPerson = expenses.map(expense => ({
      ...expense,
      person: people?.find(p => p.id === expense.person_id) || null
    }));

    res.json(expensesWithPerson);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to add data
app.post('/api/data', async (req, res) => {
  const { cost, person_id, date, comment } = req.body;

  const { data, error } = await supabase
    .from('expenses')
    .insert([{ 
      cost, 
      person_id, 
      date, 
      comment,
      created_at: new Date().toISOString() // Explicitly set creation timestamp
    }])
    .select('*, person:person_id(name)');  // Added person data to response

  if (error) {
    console.error('Supabase POST error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

app.delete('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);
  
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', parsedId)
    .select(); // This requests the deleted row(s)

  if (error) {
    console.error('Error deleting expense:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// PATCH endpoint to update an expense
app.patch('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  const { cost, person_id, date, comment } = req.body;

  const { data, error } = await supabase
    .from('expenses')
    .update({ cost, person_id, date, comment })
    .eq('id', id)
    .select('*, person:person_id(name)');  // Added person data to response

  if (error) {
    console.error('Error updating expense:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// GET endpoint to retrieve all persons
app.get('/api/persons', async (req, res) => {
  try {
    console.log('Fetching people from Supabase...');
    let { data, error } = await supabase
      .from('people')
      .select('id, name')
      .order('id', { ascending: true });

    if (error) {
      console.error('Supabase GET people error:', error);
      return res.status(500).json({ error: error.message });
    }

    // If no people exist, insert initial records
    if (!data || data.length === 0) {
      console.log('No people found. Creating initial records...');
      const initialPeople = [
        { name: 'Person 1' },
        { name: 'Person 2' },
        { name: 'Person 3' },
        { name: 'Person 4' },
        { name: 'Person 5' }
      ];

      const { data: insertedData, error: insertError } = await supabase
        .from('people')
        .insert(initialPeople)
        .select();

      if (insertError) {
        console.error('Error creating initial people:', insertError);
        return res.status(500).json({ error: insertError.message });
      }

      data = insertedData;
    }

    console.log('People data:', data);
    res.json(data);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to import CSV data
app.post('/api/import-csv', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file must have at least a header and one data row' });
    }

    // Parse header with better CSV parsing
    const header = parseCSVLine(lines[0]).map(col => col.trim().toLowerCase());
    
    // Get all people to create name-to-id mapping
    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, name');
    
    if (peopleError) {
      console.error('Error fetching people:', peopleError);
      return res.status(500).json({ error: 'Failed to fetch people data' });
    }

    const nameToIdMap = {};
    people.forEach(person => {
      nameToIdMap[person.name.toLowerCase()] = person.id;
    });

    // Parse and validate data rows
    const expenses = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]).map(col => col.trim());
      
      if (row.length !== header.length) {
        errors.push(`Row ${i + 1}: Column count mismatch`);
        continue;
      }

      const expense = {};
      
      for (let j = 0; j < header.length; j++) {
        const columnName = header[j];
        const value = row[j];
        
        switch (columnName) {
          case 'cost':
          case 'amount':
            // Remove $ symbol and parse as float
            const cleanValue = value.replace(/[$,]/g, '');
            const cost = parseFloat(cleanValue);
            if (isNaN(cost)) {
              errors.push(`Row ${i + 1}: Invalid cost value "${value}"`);
              continue;
            }
            expense.cost = cost;
            break;
            
          case 'person':
          case 'purchased_by':
          case 'purchasedby':
          case 'purchased by':
          case 'name':
            const personName = value.toLowerCase();
            const personId = nameToIdMap[personName];
            if (!personId) {
              errors.push(`Row ${i + 1}: Person "${value}" not found. Available: ${people.map(p => p.name).join(', ')}`);
              continue;
            }
            expense.person_id = personId;
            break;
            
          case 'date':
            // Parse flexible date formats
            let parsedDate;
            let dateValue = value;
            
            try {
              // Handle dates without year (like "5/3") by adding current year
              if (/^\d{1,2}\/\d{1,2}$/.test(dateValue)) {
                const currentYear = new Date().getFullYear();
                dateValue = `${dateValue}/${currentYear}`;
              }
              
              // Try to parse the date - this handles many formats
              parsedDate = new Date(dateValue);
              
              // Check if the date is valid
              if (isNaN(parsedDate.getTime())) {
                errors.push(`Row ${i + 1}: Invalid date "${value}". Please use a recognizable date format (e.g., 2024-12-15, 12/15/2024, Dec 15 2024)`);
                continue;
              }
              
              // Convert to YYYY-MM-DD format for database storage
              const year = parsedDate.getFullYear();
              const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
              const day = String(parsedDate.getDate()).padStart(2, '0');
              expense.date = `${year}-${month}-${day}`;
            } catch (error) {
              errors.push(`Row ${i + 1}: Could not parse date "${value}". Please use a recognizable date format`);
              continue;
            }
            break;
            
          case 'comment':
          case 'description':
            expense.comment = value || 'Imported expense';
            break;
        }
      }
      
      // Validate required fields
      if (!expense.cost) {
        errors.push(`Row ${i + 1}: Missing cost`);
      }
      if (!expense.person_id) {
        errors.push(`Row ${i + 1}: Missing or invalid person`);
      }
      if (!expense.date) {
        errors.push(`Row ${i + 1}: Missing date`);
      }
      
      if (expense.cost && expense.person_id && expense.date) {
        expenses.push({
          cost: expense.cost,
          person_id: expense.person_id,
          date: expense.date,
          comment: expense.comment || 'Imported expense'
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'CSV parsing errors', 
        details: errors,
        sample_format: 'Expected columns: cost, person, date, comment (or variations like amount, purchased_by, description). Date formats supported: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, Month Day Year, etc.'
      });
    }

    if (expenses.length === 0) {
      return res.status(400).json({ error: 'No valid expenses found in CSV' });
    }

    // Insert expenses into database
    const { data: insertedExpenses, error: insertError } = await supabase
      .from('expenses')
      .insert(expenses)
      .select('*, person:person_id(name)');

    if (insertError) {
      console.error('Error inserting expenses:', insertError);
      return res.status(500).json({ error: 'Failed to import expenses to database' });
    }

    res.json({
      message: `Successfully imported ${insertedExpenses.length} expenses`,
      imported: insertedExpenses.length,
      data: insertedExpenses
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to process CSV import' });
  }
});

// GET endpoint to retrieve payment statuses for a specific month
app.get('/api/payments/:monthKey', async (req, res) => {
  try {
    const { monthKey } = req.params;
    
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('month_key', monthKey);

    if (error) {
      console.error('Error fetching payments:', error);
      return res.status(500).json({ error: error.message });
    }

    // Convert to a map for easy lookup, including timestamp info
    const paymentMap = {};
    payments?.forEach(payment => {
      paymentMap[payment.payment_key] = {
        paid: payment.paid,
        updated_at: payment.updated_at,
        created_at: payment.created_at
      };
    });

    res.json(paymentMap);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to update payment status
app.post('/api/payments', async (req, res) => {
  try {
    const { 
      paymentKey, 
      monthKey, 
      fromPersonId, 
      toPersonId, 
      amount, 
      paid 
    } = req.body;

    // Validate required fields
    if (!paymentKey || !monthKey || !fromPersonId || !toPersonId || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if payment record already exists
    const { data: existingPayment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_key', paymentKey)
      .eq('month_key', monthKey)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing payment:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    let result;
    if (existingPayment) {
      // Update existing payment
      const { data, error } = await supabase
        .from('payments')
        .update({ 
          paid: paid,
          updated_at: new Date().toISOString()
        })
        .eq('payment_key', paymentKey)
        .eq('month_key', monthKey)
        .select();

      if (error) {
        console.error('Error updating payment:', error);
        return res.status(500).json({ error: error.message });
      }
      result = data;
    } else {
      // Create new payment record
      const { data, error } = await supabase
        .from('payments')
        .insert({
          payment_key: paymentKey,
          month_key: monthKey,
          from_person_id: fromPersonId,
          to_person_id: toPersonId,
          amount: amount,
          paid: paid
        })
        .select();

      if (error) {
        console.error('Error creating payment:', error);
        return res.status(500).json({ error: error.message });
      }
      result = data;
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to retrieve percentage shares for a specific month
app.get('/api/monthly-shares/:monthKey', async (req, res) => {
  try {
    const { monthKey } = req.params;
    
    const { data: shares, error } = await supabase
      .from('monthly_shares')
      .select('person_id, percentage_share')
      .eq('month_key', monthKey);

    if (error) {
      console.error('Error fetching monthly shares:', error);
      return res.status(500).json({ error: error.message });
    }

    // If no shares exist for this month, return empty object
    if (!shares || shares.length === 0) {
      return res.json({});
    }

    // Convert to a map for easy lookup
    const sharesMap = {};
    shares.forEach(share => {
      sharesMap[share.person_id] = share.percentage_share;
    });

    res.json(sharesMap);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to save percentage shares for a specific month
app.post('/api/monthly-shares', async (req, res) => {
  try {
    const { monthKey, shares } = req.body;

    // Validate required fields
    if (!monthKey || !shares || typeof shares !== 'object') {
      return res.status(400).json({ error: 'Missing required fields: monthKey and shares object' });
    }

    // Validate that shares is an object with person_id -> percentage mappings
    const shareEntries = Object.entries(shares);
    if (shareEntries.length === 0) {
      return res.status(400).json({ error: 'Shares object cannot be empty' });
    }

    // Validate percentages sum to 100 (within tolerance)
    const totalPercentage = shareEntries.reduce((sum, [personId, percentage]) => sum + parseFloat(percentage), 0);
    if (Math.abs(totalPercentage - 100) > 0.1) {
      return res.status(400).json({ 
        error: `Percentages must sum to 100%, got ${totalPercentage.toFixed(2)}%` 
      });
    }

    // Prepare data for upsert
    const shareRecords = shareEntries.map(([personId, percentage]) => ({
      person_id: parseInt(personId, 10),
      month_key: monthKey,
      percentage_share: parseFloat(percentage),
      updated_at: new Date().toISOString()
    }));

    // Delete existing shares for this month first
    const { error: deleteError } = await supabase
      .from('monthly_shares')
      .delete()
      .eq('month_key', monthKey);

    if (deleteError) {
      console.error('Error deleting existing shares:', deleteError);
      return res.status(500).json({ error: deleteError.message });
    }

    // Insert new shares
    const { data, error: insertError } = await supabase
      .from('monthly_shares')
      .insert(shareRecords)
      .select();

    if (insertError) {
      console.error('Error inserting monthly shares:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    res.json({ 
      message: `Successfully saved shares for ${monthKey}`,
      shares: data 
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to get the most recent percentage shares (for inheritance)
app.get('/api/latest-shares', async (req, res) => {
  try {
    // Get the most recent month with shares data
    const { data: latestMonth, error: monthError } = await supabase
      .from('monthly_shares')
      .select('month_key')
      .order('month_key', { ascending: false })
      .limit(1);

    if (monthError) {
      console.error('Error fetching latest month:', monthError);
      return res.status(500).json({ error: monthError.message });
    }

    if (!latestMonth || latestMonth.length === 0) {
      // No previous shares exist, return equal distribution
      const { data: people, error: peopleError } = await supabase
        .from('people')
        .select('id, name');

      if (peopleError) {
        console.error('Error fetching people:', peopleError);
        return res.status(500).json({ error: peopleError.message });
      }

      const equalShare = people.length > 0 ? 100 / people.length : 0;
      const defaultShares = {};
      people.forEach(person => {
        defaultShares[person.id] = parseFloat(equalShare.toFixed(2));
      });

      return res.json(defaultShares);
    }

    // Get shares for the most recent month
    const { data: shares, error: sharesError } = await supabase
      .from('monthly_shares')
      .select('person_id, percentage_share')
      .eq('month_key', latestMonth[0].month_key);

    if (sharesError) {
      console.error('Error fetching latest shares:', sharesError);
      return res.status(500).json({ error: sharesError.message });
    }

    const sharesMap = {};
    shares.forEach(share => {
      sharesMap[share.person_id] = share.percentage_share;
    });

    res.json(sharesMap);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});