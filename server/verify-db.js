const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPeopleTable() {
    try {
        // Try to select everything from the people table
        console.log('Querying people table...');
        const { data: people, error } = await supabase
            .from('people')
            .select('*');

        if (error) {
            console.error('Error:', error);
            return;
        }

        console.log('People found:', people?.length || 0);
        console.log('Data:', people);

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verifyPeopleTable();

async function verifyDatabase() {
    try {
        console.log('Verifying database structure...');

        // List all tables
        const { data: tables, error: tablesError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public');

        if (tablesError) {
            console.error('Error listing tables:', tablesError);
            return;
        }

        console.log('\nAvailable tables:', tables.map(t => t.table_name));

        // Check people table structure
        console.log('\nChecking people table structure...');
        const { data: peopleColumns, error: peopleError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable')
            .eq('table_name', 'people')
            .eq('table_schema', 'public');

        if (peopleError) {
            console.error('Error getting people table structure:', peopleError);
        } else {
            console.log('People table columns:', peopleColumns);
        }

        // Query people table contents
        console.log('\nQuerying people table contents...');
        const { data: people, error: peopleDataError } = await supabase
            .from('people')
            .select('*');

        if (peopleDataError) {
            console.error('Error querying people:', peopleDataError);
        } else {
            console.log('People table contents:', people);
        }

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verifyDatabase();
