import { initDatabase, closeDatabase, query } from '../database';

async function restoreDefaultInstructions() {
  await initDatabase();
  
  const defaultInstructions = `You are an expert rate manager for a logistics company. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.`;
  
  await query(
    `UPDATE assistants 
     SET instructions = $1 
     WHERE tenant_id = 'ed8b214d-c033-42c0-bd2d-e055eda285cf'`,
    [defaultInstructions]
  );
  
  console.log('Instructions restored to default.');
  
  await closeDatabase();
}

restoreDefaultInstructions();