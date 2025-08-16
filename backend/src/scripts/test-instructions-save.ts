import axios from 'axios';
import { initDatabase, closeDatabase, query } from '../database';

const API_URL = 'http://localhost:3001/api';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1OTZkOTA4YS0yZjAzLTQzYTAtYjFiMC0zYTEzY2YxMGI1NTIiLCJ0ZW5hbnRJZCI6ImVkOGIyMTRkLWMwMzMtNDJjMC1iZDJkLWUwNTVlZGEyODVjZiIsImVtYWlsIjoiYWRtaW5AZGVtb2ZyZWlnaHQuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzU1MjEyODY2LCJleHAiOjE3NTUyMTM3NjZ9.Qud1pIhoWB4Y4p5kFSHgrsTNCcBabiyA93HzUpiOwow';

async function testInstructionsSave() {
  await initDatabase();
  
  try {
    // Check current instructions in DB
    console.log('1. Current instructions in database:');
    const [before] = await query(
      `SELECT instructions FROM assistants WHERE tenant_id = 'ed8b214d-c033-42c0-bd2d-e055eda285cf'`
    );
    console.log(before?.instructions || 'No instructions');
    
    // Fetch via API
    console.log('\n2. Fetching via GET /api/assistants:');
    const getResponse = await axios.get(`${API_URL}/assistants`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Instructions from API:', getResponse.data?.assistant?.instructions || 'No instructions');
    
    // Update instructions
    const newInstructions = `You are an expert rate manager for GLOBAL SHIPPING CO. Updated at ${new Date().toISOString()}`;
    console.log('\n3. Updating instructions to:', newInstructions);
    
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
    console.log('Update response:', updateResponse.data);
    
    // Check after update
    console.log('\n4. Instructions in database after update:');
    const [after] = await query(
      `SELECT instructions FROM assistants WHERE tenant_id = 'ed8b214d-c033-42c0-bd2d-e055eda285cf'`
    );
    console.log(after?.instructions || 'No instructions');
    
    // Fetch via API again
    console.log('\n5. Fetching via GET /api/assistants after update:');
    const getResponse2 = await axios.get(`${API_URL}/assistants`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Instructions from API:', getResponse2.data?.assistant?.instructions || 'No instructions');
    
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  } finally {
    await closeDatabase();
  }
}

testInstructionsSave();