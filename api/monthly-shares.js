const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  try {
    if (req.method === 'GET') {
      // Extract monthKey from URL path
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/');
      const monthKey = pathParts[pathParts.length - 1];

      if (!monthKey || monthKey === 'monthly-shares') {
        return res.status(400).json({ error: 'Month key is required' });
      }

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
        return res.status(200).json({});
      }

      // Convert to a map for easy lookup
      const sharesMap = {};
      shares.forEach(share => {
        sharesMap[share.person_id] = share.percentage_share;
      });

      return res.status(200).json(sharesMap);

    } else if (req.method === 'POST') {
      // POST endpoint to save percentage shares for a specific month
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

      return res.status(200).json({ 
        message: `Successfully saved shares for ${monthKey}`,
        shares: data 
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}