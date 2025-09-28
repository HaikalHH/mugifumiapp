// Test script to check API endpoints
const testEndpoints = async () => {
  const baseUrl = 'http://localhost:3000';
  
  console.log('Testing API endpoints...\n');
  
  // Test 1: Basic connectivity
  try {
    const response = await fetch(`${baseUrl}/api/test-simple`);
    const data = await response.json();
    console.log('✅ Test Simple API:', data.success ? 'PASS' : 'FAIL');
    console.log('   Response:', data.message);
  } catch (error) {
    console.log('❌ Test Simple API: FAIL');
    console.log('   Error:', error.message);
  }
  
  // Test 2: Products API
  try {
    const response = await fetch(`${baseUrl}/api/products`);
    const data = await response.json();
    console.log('✅ Products API:', response.ok ? 'PASS' : 'FAIL');
    console.log('   Status:', response.status);
  } catch (error) {
    console.log('❌ Products API: FAIL');
    console.log('   Error:', error.message);
  }
  
  // Test 3: Orders API
  try {
    const response = await fetch(`${baseUrl}/api/orders`);
    const data = await response.json();
    console.log('✅ Orders API:', response.ok ? 'PASS' : 'FAIL');
    console.log('   Status:', response.status);
    if (!response.ok) {
      console.log('   Error:', data.error);
    }
  } catch (error) {
    console.log('❌ Orders API: FAIL');
    console.log('   Error:', error.message);
  }
  
  // Test 4: Pending Orders API
  try {
    const response = await fetch(`${baseUrl}/api/orders/pending`);
    const data = await response.json();
    console.log('✅ Pending Orders API:', response.ok ? 'PASS' : 'FAIL');
    console.log('   Status:', response.status);
    if (!response.ok) {
      console.log('   Error:', data.error);
    }
  } catch (error) {
    console.log('❌ Pending Orders API: FAIL');
    console.log('   Error:', error.message);
  }
  
  // Test 5: Deliveries API
  try {
    const response = await fetch(`${baseUrl}/api/deliveries`);
    const data = await response.json();
    console.log('✅ Deliveries API:', response.ok ? 'PASS' : 'FAIL');
    console.log('   Status:', response.status);
    if (!response.ok) {
      console.log('   Error:', data.error);
    }
  } catch (error) {
    console.log('❌ Deliveries API: FAIL');
    console.log('   Error:', error.message);
  }
  
  console.log('\nAPI endpoint testing completed.');
};

// Run the tests
testEndpoints().catch(console.error);
