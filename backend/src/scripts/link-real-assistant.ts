import { config } from '../config';
import { pineconeAssistantService } from '../services/pinecone-assistant.service';
import { initDatabase, closeDatabase, query } from '../database';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

// Usage: npm run link-assistant -- <tenantId> <assistantName>
async function linkRealAssistant() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      logger.error('Usage: npm run link-assistant -- <tenantId> <assistantName>');
      logger.error('Example: npm run link-assistant -- ed8b214d-c033-42c0-bd2d-e055eda285cf my-rate-assistant');
      process.exit(1);
    }
    
    const [tenantId, assistantName] = args;
    
    logger.info(`Linking Pinecone Assistant "${assistantName}" to tenant ${tenantId}...`);
    
    // Initialize database connection
    await initDatabase();
    
    // Get the tenant
    const [tenant] = await query<{ id: string; company_name: string }>(
      `SELECT id, company_name FROM tenants WHERE id = $1`,
      [tenantId]
    );
    
    if (!tenant) {
      logger.error(`Tenant ${tenantId} not found`);
      process.exit(1);
    }
    
    // Get current assistant settings if any
    const [currentAssistant] = await query<{ 
      id: string; 
      instructions: string;
      name: string;
    }>(
      `SELECT id, instructions, name FROM assistants WHERE tenant_id = $1`,
      [tenant.id]
    );
    
    logger.info(`Found tenant: ${tenant.company_name}`);
    
    try {
      // Delete existing assistant record if any
      if (currentAssistant) {
        await query(`DELETE FROM assistants WHERE tenant_id = $1`, [tenant.id]);
        logger.info('Removed existing assistant record');
      }
      
      // Link to the real Pinecone Assistant
      const assistant = await pineconeAssistantService.linkAssistantToTenant(
        tenant.id,
        {
          assistantName: assistantName,
          instructions: currentAssistant?.instructions || `You are an expert rate manager for ${tenant.company_name}. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.

When answering questions:
1. Always provide specific rates when available from the uploaded contracts
2. Mention any special terms or restrictions
3. Suggest the most cost-effective options
4. Consider transit times and reliability
5. Decode port codes to their full names for clarity
6. If no specific rate is found in the contracts, clearly state that and provide general guidance`,
          model: 'gemini-2.5-pro',
          temperature: 0.7,
          maxTokens: 2000,
        }
      );
      
      logger.info(`✅ Successfully linked Pinecone Assistant!`);
      logger.info(`Assistant Name: ${assistant.pineconeAssistantId}`);
      logger.info(`Tenant: ${tenant.company_name}`);
      logger.info(`\nYour Rate Management System is now using the real Pinecone Assistant API!`);
      logger.info(`You can now:`);
      logger.info(`  - Upload contracts and they'll be processed by AI`);
      logger.info(`  - Chat with the assistant for intelligent responses`);
      logger.info(`  - Get real-time rate queries based on your contracts`);
      
    } catch (error: any) {
      if (error.message?.includes('not found in Pinecone')) {
        logger.error(`\n❌ Failed to link to Pinecone Assistant "${assistantName}"`);
        logger.error('Please check:');
        logger.error('  1. The assistant name matches exactly what you created in Pinecone dashboard');
        logger.error('  2. Your PINECONE_ASSISTANT_API_KEY is correct');
        logger.error('  3. You have access to Pinecone Assistant API');
        logger.error('  4. The assistant exists in your Pinecone project');
        logger.error('\nTo create an assistant in Pinecone:');
        logger.error('  1. Go to https://app.pinecone.io/');
        logger.error('  2. Navigate to Assistant tab');
        logger.error('  3. Create a new assistant with any name you like');
        logger.error('  4. Copy the assistant name and use it with this script');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    logger.error('Failed to link assistant:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

// Run the script
linkRealAssistant();