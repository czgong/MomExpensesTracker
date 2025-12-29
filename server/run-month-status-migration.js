// Migration script to create month_status table
// This is Phase 1 of the month completion feature implementation
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('🔄 Running migration to create month_status table...');

    try {
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'create-month-status-table.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📝 Executing migration SQL...');
        console.log(migrationSQL);

        console.log('\n⚠️  NOTE: This migration requires manual execution in Supabase dashboard.');
        console.log('Please copy the SQL above and run it in your Supabase SQL editor.');
        console.log('After running the SQL, this script will verify the table was created.\n');

        // Wait for user to run the migration
        console.log('Checking if table exists...');

        // Verify the migration by checking if the table exists
        const { data: testData, error: testError } = await supabase
            .from('month_status')
            .select('*')
            .limit(1);

        if (testError) {
            if (testError.message.includes('relation "public.month_status" does not exist')) {
                console.error('\n❌ Table does not exist yet. Please run the SQL in Supabase dashboard:');
                console.log('\n1. Go to your Supabase project dashboard');
                console.log('2. Navigate to SQL Editor');
                console.log('3. Copy and paste the SQL from create-month-status-table.sql');
                console.log('4. Run the query');
                console.log('5. Run this script again to verify\n');
                return;
            } else {
                console.error('❌ Verification failed:', testError);
                return;
            }
        } else {
            console.log('✅ Table exists! Sample data:', testData);
            console.log('✅ Migration verified successfully!');

            // Show table structure
            console.log('\n📊 Table structure:');
            console.log('- id: SERIAL PRIMARY KEY');
            console.log('- month_key: TEXT NOT NULL UNIQUE');
            console.log('- is_completed: BOOLEAN DEFAULT FALSE');
            console.log('- completed_at: TIMESTAMP WITH TIME ZONE');
            console.log('- completed_by: TEXT');
            console.log('- created_at: TIMESTAMP WITH TIME ZONE');
            console.log('- updated_at: TIMESTAMP WITH TIME ZONE');
        }

    } catch (error) {
        console.error('💥 Unexpected error during migration:', error);
    }
}

runMigration();
