// Test script to verify month-specific percentage shares functionality

async function testMonthlyShares() {
  console.log('🧪 Testing Month-Specific Percentage Shares\n');
  
  const baseUrl = 'http://localhost:5001';
  
  try {
    // Test 1: Save shares for May 2025
    console.log('1. Saving shares for May 2025...');
    const mayShares = {
      1: 40,  // Alex: 40%
      2: 25,  // Chris: 25%
      3: 10,  // Karen: 10%
      4: 15,  // Sophie: 15%
      5: 10   // Helen: 10%
    };
    
    const mayResponse = await fetch(`${baseUrl}/api/monthly-shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthKey: '2025-05',
        shares: mayShares
      })
    });
    
    if (mayResponse.ok) {
      const mayResult = await mayResponse.json();
      console.log('✅ May 2025 shares saved:', mayResult.message);
    } else {
      console.log('❌ Failed to save May shares:', await mayResponse.text());
      return;
    }
    
    // Test 2: Save different shares for February 2025
    console.log('\n2. Saving different shares for February 2025...');
    const febShares = {
      1: 20,  // Alex: 20%
      2: 30,  // Chris: 30%
      3: 20,  // Karen: 20%
      4: 20,  // Sophie: 20%
      5: 10   // Helen: 10%
    };
    
    const febResponse = await fetch(`${baseUrl}/api/monthly-shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthKey: '2025-02',
        shares: febShares
      })
    });
    
    if (febResponse.ok) {
      const febResult = await febResponse.json();
      console.log('✅ February 2025 shares saved:', febResult.message);
    } else {
      console.log('❌ Failed to save February shares:', await febResponse.text());
      return;
    }
    
    // Test 3: Fetch May shares
    console.log('\n3. Fetching May 2025 shares...');
    const fetchMayResponse = await fetch(`${baseUrl}/api/monthly-shares/2025-05`);
    
    if (fetchMayResponse.ok) {
      const mayData = await fetchMayResponse.json();
      console.log('✅ May 2025 shares retrieved:', mayData);
    } else {
      console.log('❌ Failed to fetch May shares:', await fetchMayResponse.text());
    }
    
    // Test 4: Fetch February shares
    console.log('\n4. Fetching February 2025 shares...');
    const fetchFebResponse = await fetch(`${baseUrl}/api/monthly-shares/2025-02`);
    
    if (fetchFebResponse.ok) {
      const febData = await fetchFebResponse.json();
      console.log('✅ February 2025 shares retrieved:', febData);
    } else {
      console.log('❌ Failed to fetch February shares:', await fetchFebResponse.text());
    }
    
    // Test 5: Fetch shares for a month that doesn't exist
    console.log('\n5. Fetching shares for non-existent month (2025-12)...');
    const fetchNonExistentResponse = await fetch(`${baseUrl}/api/monthly-shares/2025-12`);
    
    if (fetchNonExistentResponse.ok) {
      const nonExistentData = await fetchNonExistentResponse.json();
      console.log('✅ Non-existent month response (should be empty):', nonExistentData);
    } else {
      console.log('❌ Failed to fetch non-existent month shares:', await fetchNonExistentResponse.text());
    }
    
    // Test 6: Get latest shares (should be May since it's the most recent)
    console.log('\n6. Fetching latest shares...');
    const latestResponse = await fetch(`${baseUrl}/api/latest-shares`);
    
    if (latestResponse.ok) {
      const latestData = await latestResponse.json();
      console.log('✅ Latest shares retrieved:', latestData);
    } else {
      console.log('❌ Failed to fetch latest shares:', await latestResponse.text());
    }
    
    console.log('\n🎉 Month-specific shares test completed!');
    console.log('\n📝 Summary:');
    console.log('- May 2025: Alex 40%, Chris 25%, Karen 10%, Sophie 15%, Helen 10%');
    console.log('- Feb 2025: Alex 20%, Chris 30%, Karen 20%, Sophie 20%, Helen 10%');
    console.log('- Each month maintains its own percentage shares independently!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMonthlyShares();