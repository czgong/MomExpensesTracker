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
      // Extract monthKey from query params or URL path
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/');
      const monthKey = req.query.monthKey || pathParts[pathParts.length - 1];

      if (!monthKey || monthKey === 'payments') {
        return res.status(400).json({ error: 'Month key is required' });
      }

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

      return res.status(200).json(paymentMap);

    } else if (req.method === 'POST') {
      // POST endpoint to update payment status
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

      return res.status(200).json(result[0]);

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}