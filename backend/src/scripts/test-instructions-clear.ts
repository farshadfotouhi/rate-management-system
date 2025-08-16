import axios from 'axios';

const API_URL = 'http://localhost:3001/api';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1OTZkOTA4YS0yZjAzLTQzYTAtYjFiMC0zYTEzY2YxMGI1NTIiLCJ0ZW5hbnRJZCI6ImVkOGIyMTRkLWMwMzMtNDJjMC1iZDJkLWUwNTVlZGEyODVjZiIsImVtYWlsIjoiYWRtaW5AZGVtb2ZyZWlnaHQuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzU1MjEyMDAyLCJleHAiOjE3NTUyMTI5MDJ9.rmyZY40RNMrOxLMwqwqHHiqT5RpSOJTbQDD5UhtmzNg';

async function testInstructionsClearly() {
  try {
    // Create a new chat session
    console.log('Creating new chat session...');
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

    // Send a test message that specifically asks about ACME Logistics
    console.log('\nSending test message specifically about ACME Logistics...');
    const chatResponse = await axios.post(
      `${API_URL}/chat/send`,
      {
        sessionId: sessionId,
        message: "I am looking for shipping rates from ACME Logistics. Can you help me with your services?"
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

    // Check the response
    const response = chatResponse.data.response.toLowerCase();
    if (response.includes('acme')) {
      console.log('✅ SUCCESS: Assistant acknowledged ACME Logistics!');
    } else if (response.includes('russell')) {
      console.log('⚠️  WARNING: Assistant mentioned Russell instead of ACME');
    } else {
      console.log('📋 NOTE: Response doesn\'t clearly indicate which company');
    }

    // Send another test about who they work for
    console.log('\nSending direct question about identity...');
    const identityResponse = await axios.post(
      `${API_URL}/chat/send`,
      {
        sessionId: sessionId,
        message: "Just to confirm, you work for ACME Logistics, correct?"
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n--- Identity Response ---');
    console.log(identityResponse.data.response);
    console.log('--- End Response ---\n');

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testInstructionsClearly();