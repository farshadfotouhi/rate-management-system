import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

async function testChat() {
  try {
    // 1. Login
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@demofreight.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.tokens.accessToken;
    console.log('✓ Logged in successfully');
    
    // Set auth header for subsequent requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // 2. Create a chat session
    console.log('\n2. Creating chat session...');
    const sessionResponse = await axios.post(`${API_URL}/chat/sessions`, {
      title: 'Test Session'
    });
    
    const sessionId = sessionResponse.data.sessionId;
    console.log(`✓ Session created: ${sessionId}`);
    
    // 3. Send a test message
    console.log('\n3. Sending test message...');
    console.log('Message: "What shipping rates do you have from Taiwan to Dallas?"');
    
    const startTime = Date.now();
    const chatResponse = await axios.post(`${API_URL}/chat/send`, {
      sessionId: sessionId,
      message: 'What shipping rates do you have from Taiwan to Dallas?'
    }, {
      timeout: 30000 // 30 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`\n✓ Response received in ${responseTime}ms`);
    console.log('\n--- Assistant Response ---');
    console.log(chatResponse.data.response);
    console.log('--- End Response ---');
    
    if (chatResponse.data.tokensUsed) {
      console.log(`\nTokens used: ${chatResponse.data.tokensUsed}`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.code === 'ECONNABORTED') {
      console.error('Request timed out');
    } else {
      console.error(error.message);
    }
  }
}

testChat();