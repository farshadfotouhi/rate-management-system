import axios from 'axios';

const API_URL = 'http://localhost:3001/api';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1OTZkOTA4YS0yZjAzLTQzYTAtYjFiMC0zYTEzY2YxMGI1NTIiLCJ0ZW5hbnRJZCI6ImVkOGIyMTRkLWMwMzMtNDJjMC1iZDJkLWUwNTVlZGEyODVjZiIsImVtYWlsIjoiYWRtaW5AZGVtb2ZyZWlnaHQuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzU1MjEyMDAyLCJleHAiOjE3NTUyMTI5MDJ9.rmyZY40RNMrOxLMwqwqHHiqT5RpSOJTbQDD5UhtmzNg';

async function testCustomInstructions() {
  try {
    // First, update the instructions to ACME Logistics
    console.log('Updating instructions to ACME Logistics...');
    const updateResponse = await axios.put(
      `${API_URL}/assistants/instructions`,
      {
        instructions: "You are an expert rate manager for ACME Logistics. You specialize in ocean freight rates and can provide competitive pricing for all container sizes. You have extensive knowledge of port codes and can decode them to city and country. Your role is to help customers find the best shipping rates from our contracted carriers."
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Instructions updated successfully');

    // Create a new chat session
    console.log('\nCreating new chat session...');
    const sessionResponse = await axios.post(
      `${API_URL}/chat/sessions`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const sessionId = sessionResponse.data.sessionId;
    console.log('Session created:', sessionId);

    // Send a test message
    console.log('\nSending test message...');
    const chatResponse = await axios.post(
      `${API_URL}/chat/send`,
      {
        sessionId: sessionId,
        message: "What company do you work for and what services do you provide?"
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n--- Assistant Response ---');
    console.log(chatResponse.data.response);
    console.log('--- End Response ---\n');

    // Check if the response mentions ACME Logistics
    if (chatResponse.data.response.toLowerCase().includes('acme')) {
      console.log('✅ SUCCESS: Assistant is using ACME Logistics instructions!');
    } else if (chatResponse.data.response.toLowerCase().includes('russell')) {
      console.log('❌ FAILED: Assistant is still using Russell Ltd instructions');
    } else {
      console.log('⚠️  UNCLEAR: Response doesn\'t clearly indicate which instructions are being used');
      console.log('Please check the response above');
    }

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testCustomInstructions();