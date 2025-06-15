// Migration script to add created_at column to expenses table
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('🔄 Running migration to add created_at column to expenses table...');
    
    try {
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'add-created-at-migration.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📝 Executing migration SQL...');
        console.log(migrationSQL);
        
        // Execute the migration
        const { data, error } = await supabase.rpc('exec_sql', { 
            sql: migrationSQL 
        });
        
        if (error) {
            console.error('❌ Migration failed:', error);
            
            // Try alternative approach using individual queries
            console.log('🔄 Trying alternative approach...');
            
            // First, try to add the column
            const { error: alterError } = await supabase
                .from('expenses')
                .select('created_at')
                .limit(1);
            
            if (alterError && alterError.message.includes('column "created_at" does not exist')) {
                console.log('⚠️  Column does not exist. You need to manually run this SQL in your Supabase dashboard:');
                console.log('');
                console.log('ALTER TABLE public.expenses ADD COLUMN created_at timestamp with time zone DEFAULT timezone(\'utc\'::text, now()) NOT NULL;');
                console.log('');
                console.log('Then run this script again.');
                return;
            }
            
        } else {
            console.log('✅ Migration completed successfully!');
        }
        
        // Verify the migration by checking if the column exists
        console.log('🔍 Verifying migration...');
        const { data: testData, error: testError } = await supabase
            .from('expenses')
            .select('id, created_at')
            .limit(1);
        
        if (testError) {
            console.error('❌ Verification failed:', testError);
        } else {
            console.log('✅ Migration verified! Sample data:', testData);
        }
        
    } catch (error) {
        console.error('💥 Unexpected error during migration:', error);
    }
}

runMigration();