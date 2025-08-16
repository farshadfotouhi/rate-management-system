import fetch from 'node-fetch';

async function testPineconeDirectly() {
  const apiKey = 'pcsk_6vWAWo_6UbyRE5LKbt394aL4kjC8wacC6AR6JiMdLRpPjinpFn1QWwqMagRv858kaQtmjv';
  const assistantHost = 'https://prod-1-data.ke.pinecone.io';
  const assistantId = 'rate-assistant-ed8b214d';
  
  console.log('Testing Pinecone Assistant API directly...');
  console.log(`Host: ${assistantHost}`);
  console.log(`Assistant: ${assistantId}`);
  
  const messages = [
    {
      role: 'user',
      content: 'What are the shipping rates from Taiwan to Dallas?'
    }
  ];
  
  console.log('\nSending request...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(
      `${assistantHost}/assistant/chat/${assistantId}`,
      {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2025-01',
        },
        body: JSON.stringify({
          messages: messages,
          model: 'gemini-2.5-pro',
          stream: false,
        }),
      }
    );
    
    const responseTime = Date.now() - startTime;
    console.log(`Response received in ${responseTime}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('\n--- Response ---');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n--- Error Response ---');
      console.log(responseText);
    }
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`\n❌ Error after ${responseTime}ms:`, error.message);
  }
}

testPineconeDirectly();