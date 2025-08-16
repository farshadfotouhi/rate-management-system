import axios from 'axios';

const API_URL = 'http://localhost:3001/api';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1OTZkOTA4YS0yZjAzLTQzYTAtYjFiMC0zYTEzY2YxMGI1NTIiLCJ0ZW5hbnRJZCI6ImVkOGIyMTRkLWMwMzMtNDJjMC1iZDJkLWUwNTVlZGEyODVjZiIsImVtYWlsIjoiYWRtaW5AZGVtb2ZyZWlnaHQuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzU1MjEyODY2LCJleHAiOjE3NTUyMTM3NjZ9.Qud1pIhoWB4Y4p5kFSHgrsTNCcBabiyA93HzUpiOwow';

async function testUIFlow() {
  try {
    console.log('=== Simulating UI Settings Page Flow ===\n');
    
    // 1. Component mounts - fetch current instructions
    console.log('1. Page loads - fetching current instructions...');
    const getResponse = await axios.get(`${API_URL}/assistants`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const currentInstructions = getResponse.data?.assistant?.instructions || 
      'You are an expert rate manager for a logistics company. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.';
    
    console.log('Current instructions loaded:');
    console.log(currentInstructions.substring(0, 100) + '...\n');
    
    // 2. User modifies instructions
    const newInstructions = 'You are an expert rate manager for ACME Corp. You specialize in ocean freight and provide competitive rates.';
    console.log('2. User changes instructions to:');
    console.log(newInstructions + '\n');
    
    // 3. User clicks Save
    console.log('3. User clicks Save - sending update...');
    const updateResponse = await axios.put(
      `${API_URL}/assistants/instructions`,
      { instructions: newInstructions },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Response:', updateResponse.data);
    console.log('');
    
    // 4. Simulate page refresh - fetch instructions again
    console.log('4. User refreshes page - fetching instructions again...');
    const refreshResponse = await axios.get(`${API_URL}/assistants`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const afterRefresh = refreshResponse.data?.assistant?.instructions;
    console.log('Instructions after refresh:');
    console.log(afterRefresh + '\n');
    
    // 5. Verify persistence
    if (afterRefresh === newInstructions) {
      console.log('✅ SUCCESS: Instructions persisted correctly!');
    } else {
      console.log('❌ FAILED: Instructions did not persist');
      console.log('Expected:', newInstructions);
      console.log('Got:', afterRefresh);
    }
    
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testUIFlow();