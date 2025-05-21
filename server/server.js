// server/server.js
const { createClient } = require('@supabase/supabase-js');
const express = require('express');

const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express(); // Initialize Express app
const PORT = process.env.PORT || 5001; // Define PORT

// Middleware to parse JSON bodies
app.use(express.json());

// GET endpoint to retrieve data with person names
app.get('/api/data', async (req, res) => {
  try {
    // First get all people
    const { data: people } = await supabase
      .from('people')
      .select('id, name');

    // Then get all expenses
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*');

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
    .insert([{ cost, person_id, date, comment }])
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});