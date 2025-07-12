const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

        return res.status(200).json(defaultShares);
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

      return res.status(200).json(sharesMap);

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}