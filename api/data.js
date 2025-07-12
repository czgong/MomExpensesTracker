const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
};

export default async function handler(req, res) {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Set CORS headers
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Extract ID from URL for DELETE/PATCH operations
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/');
  const expenseId = pathParts[pathParts.length - 1]; // Get last part as ID

  try {
    if (req.method === 'GET') {
      // GET endpoint to fetch all expenses with person data
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id, cost, person_id, date, comment, created_at,
          person:people(name)
        `)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching expenses:', error);
        return res.status(500).json({ error: error.message });
      }

      // Transform data to match expected format
      const transformedData = data.map(expense => ({
        ...expense,
        purchasedBy: expense.person?.name || 'Unknown'
      }));

      return res.status(200).json(transformedData);

    } else if (req.method === 'POST') {
      // POST endpoint to create a new expense
      const { cost, person_id, date, comment } = req.body;

      if (!cost || !person_id || !date) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert([{ cost: parseFloat(cost), person_id: parseInt(person_id), date, comment }])
        .select(`
          id, cost, person_id, date, comment, created_at,
          person:people(name)
        `);

      if (error) {
        console.error('Error creating expense:', error);
        return res.status(500).json({ error: error.message });
      }

      // Transform data to match expected format
      const transformedData = data.map(expense => ({
        ...expense,
        purchasedBy: expense.person?.name || 'Unknown'
      }));

      return res.status(201).json(transformedData[0]);

    } else if (req.method === 'DELETE') {
      // DELETE endpoint to remove an expense
      const parsedId = parseInt(expenseId, 10);
      
      if (isNaN(parsedId)) {
        return res.status(400).json({ error: 'Invalid expense ID' });
      }
      
      const { data, error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', parsedId)
        .select();

      if (error) {
        console.error('Error deleting expense:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data);

    } else if (req.method === 'PATCH') {
      // PATCH endpoint to update an expense
      const parsedId = parseInt(expenseId, 10);
      
      if (isNaN(parsedId)) {
        return res.status(400).json({ error: 'Invalid expense ID' });
      }

      const { cost, person_id, date, comment } = req.body;

      const { data, error } = await supabase
        .from('expenses')
        .update({ cost: parseFloat(cost), person_id: parseInt(person_id), date, comment })
        .eq('id', parsedId)
        .select(`
          id, cost, person_id, date, comment, created_at,
          person:people(name)
        `);

      if (error) {
        console.error('Error updating expense:', error);
        return res.status(500).json({ error: error.message });
      }

      // Transform data to match expected format
      const transformedData = data.map(expense => ({
        ...expense,
        purchasedBy: expense.person?.name || 'Unknown'
      }));

      return res.status(200).json(transformedData[0]);

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}