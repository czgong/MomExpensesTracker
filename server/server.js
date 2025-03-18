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

// GET endpoint to retrieve data
app.get('/api/data', async (req, res) => {
  const { data, error } = await supabase
    .from('expenses')
    .select('*');

  if (error) {
    console.error('Supabase GET error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// POST endpoint to add data
app.post('/api/data', async (req, res) => {
  const { cost, purchasedBy, date, comment } = req.body;

  // Add .select() so that Supabase returns the inserted rows with their generated id
  const { data, error } = await supabase
    .from('expenses')
    .insert([{ cost, purchased_by: purchasedBy, date, comment }])
    .select();

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
  const parsedId = parseInt(id, 10); // Ensure the id is numeric
  const { cost, purchasedBy, date, comment } = req.body;

  const { data, error } = await supabase
    .from('expenses')
    .update({
      cost, 
      purchased_by: purchasedBy, // Adjust if your column is named differently
      date,
      comment,
    })
    .eq('id', parsedId)
    .select(); // Return the updated row(s)

  if (error) {
    console.error('Error updating expense:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});