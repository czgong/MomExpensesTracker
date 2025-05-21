// Test Supabase connection and queries
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing Supabase connection...');
    
    try {
        // Test people table
        console.log('\nTesting people table...');
        const { data: persons, error: personsError } = await supabase
            .from('people')
            .select('*');
        
        if (personsError) {
            console.error('Error querying persons:', personsError);
        } else {
            console.log('Persons data:', persons);
            console.log('Number of persons:', persons?.length || 0);
        }

        // Test expenses table
        console.log('\nTesting expenses table...');
        const { data: expenses, error: expensesError } = await supabase
            .from('expenses')
            .select('*');
        
        if (expensesError) {
            console.error('Error querying expenses:', expensesError);
        } else {
            console.log('Expenses data:', expenses);
            console.log('Number of expenses:', expenses?.length || 0);
        }

    } catch (error) {
        console.error('Connection test failed:', error);
    }
}

testConnection();
