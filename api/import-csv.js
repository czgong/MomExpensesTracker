const { createClient } = require('@supabase/supabase-js');

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

// Initialize Supabase client
const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Expect CSV content to be sent as JSON in the request body
    const { csvContent } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({ error: 'No CSV content provided' });
    }
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
      .select(`
        id, cost, person_id, date, comment, created_at,
        person:people(name)
      `);

    if (insertError) {
      console.error('Error inserting expenses:', insertError);
      return res.status(500).json({ error: 'Failed to import expenses to database' });
    }

    // Transform data to match expected format
    const transformedData = insertedExpenses.map(expense => ({
      ...expense,
      purchasedBy: expense.person?.name || 'Unknown'
    }));

    return res.status(200).json({
      message: `Successfully imported ${insertedExpenses.length} expenses`,
      imported: insertedExpenses.length,
      data: transformedData
    });

  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ error: 'Failed to process CSV import' });
  }
}