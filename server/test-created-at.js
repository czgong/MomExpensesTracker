// Test script to verify created_at column functionality
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uswswsiarylffxqdwiot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3N3c2lhcnlsZmZ4cWR3aW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNTkzNjIsImV4cCI6MjA1NTgzNTM2Mn0.zocHcEHF5SBpAqknlPp-dsnbcfmn2lGfmNTyHRWhWuw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreatedAt() {
    console.log('🧪 Testing created_at column functionality...');
    
    try {
        // First, check if expenses table has created_at column
        console.log('\n1. Checking current expenses table structure...');
        const { data: expenses, error: fetchError } = await supabase
            .from('expenses')
            .select('*')
            .limit(3);
        
        if (fetchError) {
            console.error('❌ Error fetching expenses:', fetchError);
            return;
        }
        
        console.log('📊 Sample expenses data:');
        expenses.forEach(expense => {
            console.log(`   ID: ${expense.id}, Cost: $${expense.cost}, Date: ${expense.date}, Created: ${expense.created_at || 'NO TIMESTAMP'}`);
        });
        
        // Test creating a new expense with timestamp
        console.log('\n2. Testing creation of new expense with timestamp...');
        const testExpense = {
            cost: 9.99,
            person_id: 1,
            date: new Date().toISOString().split('T')[0],
            comment: 'Test expense for created_at functionality',
            created_at: new Date().toISOString()
        };
        
        const { data: newExpense, error: insertError } = await supabase
            .from('expenses')
            .insert([testExpense])
            .select('*');
        
        if (insertError) {
            console.error('❌ Error creating test expense:', insertError);
            
            if (insertError.message.includes('column "created_at" does not exist')) {
                console.log('\n⚠️  The created_at column does not exist in the expenses table!');
                console.log('🔧 You need to run the migration first. Execute this in your Supabase SQL editor:');
                console.log('\nALTER TABLE public.expenses ADD COLUMN created_at timestamp with time zone DEFAULT timezone(\'utc\'::text, now()) NOT NULL;\n');
                return;
            }
            return;
        }
        
        console.log('✅ Test expense created successfully:', newExpense[0]);
        
        // Clean up test expense
        console.log('\n3. Cleaning up test expense...');
        const { error: deleteError } = await supabase
            .from('expenses')
            .delete()
            .eq('id', newExpense[0].id);
        
        if (deleteError) {
            console.error('⚠️  Error cleaning up test expense:', deleteError);
        } else {
            console.log('✅ Test expense cleaned up successfully');
        }
        
        console.log('\n🎉 created_at column test completed successfully!');
        
    } catch (error) {
        console.error('💥 Unexpected error during test:', error);
    }
}

testCreatedAt();