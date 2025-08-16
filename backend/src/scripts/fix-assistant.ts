import { initDatabase, closeDatabase, query } from '../database';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

async function fixAssistant() {
  try {
    logger.info('Fixing assistant for tenant...');
    
    // Initialize database connection
    await initDatabase();
    
    // Check if tenant exists
    const [tenant] = await query<{ id: string; company_name: string }>(
      `SELECT id, company_name FROM tenants WHERE id = 'ed8b214d-c033-42c0-bd2d-e055eda285cf'`
    );
    
    if (!tenant) {
      logger.error('Tenant not found');
      return;
    }
    
    logger.info(`Found tenant: ${tenant.company_name}`);
    
    // Check if assistant already exists
    const [existingAssistant] = await query(
      `SELECT id FROM assistants WHERE tenant_id = $1`,
      [tenant.id]
    );
    
    if (existingAssistant) {
      logger.info('Assistant already exists, updating it...');
      await query(
        `UPDATE assistants 
         SET pinecone_assistant_id = $1, is_active = true, updated_at = NOW()
         WHERE tenant_id = $2`,
        ['mock-assistant-' + tenant.id, tenant.id]
      );
    } else {
      logger.info('Creating new assistant record...');
      // Create a mock assistant record
      await query(
        `INSERT INTO assistants (
          id, tenant_id, pinecone_assistant_id, name, model, 
          instructions, temperature, max_tokens, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidv4(),
          tenant.id,
          'mock-assistant-' + tenant.id, // Mock ID since we don't have Pinecone Assistant
          tenant.company_name + ' Rate Assistant',
          'gemini-2.5-pro',
          `You are an expert rate manager for ${tenant.company_name}. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.`,
          0.7,
          2000,
          true
        ]
      );
    }
    
    // Update tenant record
    await query(
      `UPDATE tenants 
       SET pinecone_assistant_id = $1, 
           assistant_instructions = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [
        'mock-assistant-' + tenant.id,
        `You are an expert rate manager for ${tenant.company_name}.`,
        tenant.id
      ]
    );
    
    logger.info('✅ Assistant fixed successfully!');
    
  } catch (error) {
    logger.error('Failed to fix assistant:', error);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

// Run the fix
fixAssistant();