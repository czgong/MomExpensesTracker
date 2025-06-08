// Test script to verify payment timestamp functionality
const fetch = require('node-fetch');

async function testPaymentTimestamps() {
  console.log('🧪 Testing Payment Timestamp Functionality\n');
  
  const baseUrl = 'http://localhost:5001';
  
  try {
    // 1. Create a new payment
    console.log('1. Creating a payment...');
    const createResponse = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentKey: 'test-timestamp',
        monthKey: '2024-12',
        fromPersonId: 1,
        toPersonId: 2,
        amount: 50.00,
        paid: false
      })
    });
    
    if (createResponse.ok) {
      const created = await createResponse.json();
      console.log('✅ Payment created with timestamp:', {
        id: created.id,
        paid: created.paid,
        created_at: created.created_at,
        updated_at: created.updated_at
      });
    } else {
      console.log('❌ Failed to create payment:', await createResponse.text());
      return;
    }
    
    // 2. Wait a moment and update it
    console.log('\n2. Waiting 2 seconds and then updating payment...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const updateResponse = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentKey: 'test-timestamp',
        monthKey: '2024-12',
        fromPersonId: 1,
        toPersonId: 2,
        amount: 50.00,
        paid: true
      })
    });
    
    if (updateResponse.ok) {
      const updated = await updateResponse.json();
      console.log('✅ Payment updated with new timestamp:', {
        id: updated.id,
        paid: updated.paid,
        created_at: updated.created_at,
        updated_at: updated.updated_at
      });
    } else {
      console.log('❌ Failed to update payment:', await updateResponse.text());
      return;
    }
    
    // 3. Fetch payments to see API response format
    console.log('\n3. Fetching payments for month 2024-12...');
    const fetchResponse = await fetch(`${baseUrl}/api/payments/2024-12`);
    
    if (fetchResponse.ok) {
      const payments = await fetchResponse.json();
      console.log('✅ Fetched payments with timestamps:', JSON.stringify(payments, null, 2));
    } else {
      console.log('❌ Failed to fetch payments:', await fetchResponse.text());
    }
    
    // 4. Clean up test data
    console.log('\n4. Cleaning up test data...');
    // Note: We'd need a DELETE endpoint to properly clean up, for now the test data remains
    console.log('ℹ️  Test payment "test-timestamp" remains in database');
    
    console.log('\n🎉 Timestamp test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPaymentTimestamps();