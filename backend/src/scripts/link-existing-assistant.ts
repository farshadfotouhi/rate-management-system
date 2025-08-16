import { initDatabase, closeDatabase, query } from '../database';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

async function linkExistingAssistant() {
  try {
    logger.info('Linking existing Pinecone Assistant to tenant...');
    
    // Initialize database connection
    await initDatabase();
    
    const tenantId = 'ed8b214d-c033-42c0-bd2d-e055eda285cf';
    const pineconeAssistantId = 'rate-assistant-ed8b214d'; // The assistant you see in Pinecone
    
    // Check if tenant exists
    const [tenant] = await query<{ id: string; company_name: string }>(
      `SELECT id, company_name FROM tenants WHERE id = $1`,
      [tenantId]
    );
    
    if (!tenant) {
      logger.error('Tenant not found');
      return;
    }
    
    logger.info(`Found tenant: ${tenant.company_name}`);
    
    // Delete any existing assistant records
    await query(`DELETE FROM assistants WHERE tenant_id = $1`, [tenantId]);
    logger.info('Cleared existing assistant records');
    
    // Create new assistant record linked to the Pinecone assistant
    const [assistant] = await query(
      `INSERT INTO assistants (
        id, tenant_id, pinecone_assistant_id, name, model, 
        instructions, temperature, max_tokens, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        uuidv4(),
        tenantId,
        pineconeAssistantId,
        'Rate Assistant',
        'gemini-2.5-pro',
        `You are an expert rate manager for ${tenant.company_name}. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.`,
        0.7,
        2000,
        true
      ]
    );
    
    // Update tenant record
    await query(
      `UPDATE tenants 
       SET pinecone_assistant_id = $1, 
           updated_at = NOW()
       WHERE id = $2`,
      [pineconeAssistantId, tenantId]
    );
    
    logger.info('✅ Successfully linked existing Pinecone Assistant!');
    logger.info(`Assistant ID in Pinecone: ${pineconeAssistantId}`);
    logger.info(`Database record ID: ${assistant.id}`);
    logger.info('\n🎉 Your Rate Management System is now connected to the real Pinecone Assistant!');
    logger.info('You can now:');
    logger.info('  - Chat with the AI assistant');
    logger.info('  - Upload contracts for AI processing');
    logger.info('  - Get intelligent responses based on your data');
    
  } catch (error) {
    logger.error('Failed to link assistant:', error);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

// Run the linking
linkExistingAssistant();