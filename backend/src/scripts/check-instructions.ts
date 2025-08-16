import { initDatabase, closeDatabase, query } from '../database';

async function checkInstructions() {
  await initDatabase();
  
  const [assistant] = await query(
    `SELECT instructions FROM assistants WHERE tenant_id = 'ed8b214d-c033-42c0-bd2d-e055eda285cf'`
  );
  
  console.log('Current instructions:');
  console.log(assistant?.instructions || 'No instructions found');
  
  await closeDatabase();
}

checkInstructions();