import { config } from '../config';
import { pineconeAssistantService } from '../services/pinecone-assistant.service';
import { initDatabase, closeDatabase, query } from '../database';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

async function upgradeToRealAssistant() {
  try {
    logger.info('Upgrading to real Pinecone Assistant...');
    
    // Initialize database connection
    await initDatabase();
    
    // Get the tenant
    const [tenant] = await query<{ id: string; company_name: string }>(
      `SELECT id, company_name FROM tenants WHERE id = 'ed8b214d-c033-42c0-bd2d-e055eda285cf'`
    );
    
    if (!tenant) {
      logger.error('Tenant not found');
      return;
    }
    
    // Get current assistant settings
    const [currentAssistant] = await query<{ 
      id: string; 
      instructions: string;
      name: string;
    }>(
      `SELECT id, instructions, name FROM assistants WHERE tenant_id = $1`,
      [tenant.id]
    );
    
    if (!currentAssistant) {
      logger.error('No assistant found for tenant');
      return;
    }
    
    logger.info('Creating real Pinecone Assistant...');
    
    try {
      // Delete the mock assistant record first
      await query(`DELETE FROM assistants WHERE tenant_id = $1`, [tenant.id]);
      
      // Link to an existing Pinecone Assistant (replace with your actual assistant name)
      const realAssistantName = 'your-pinecone-assistant-name'; // TODO: Replace with actual assistant name from Pinecone dashboard
      
      console.log('\n⚠️  IMPORTANT: Please update this script with your actual Pinecone Assistant name!');
      console.log(`   Current placeholder: ${realAssistantName}`);
      console.log('   Replace "your-pinecone-assistant-name" with the name of the assistant you created in Pinecone dashboard\n');
      
      const assistant = await pineconeAssistantService.linkAssistantToTenant(
        tenant.id,
        {
          assistantName: realAssistantName,
          instructions: currentAssistant.instructions || `You are an expert rate manager for ${tenant.company_name}. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.`,
          model: 'gemini-2.5-pro',
          temperature: 0.7,
          maxTokens: 2000,
        }
      );
      
      logger.info(`✅ Successfully created real Pinecone Assistant!`);
      logger.info(`Assistant ID: ${assistant.pineconeAssistantId}`);
      logger.info(`\nYour Rate Management System is now using the real Pinecone Assistant API!`);
      logger.info(`You can now:`);
      logger.info(`  - Upload contracts and they'll be processed by AI`);
      logger.info(`  - Chat with the assistant for intelligent responses`);
      logger.info(`  - Get real-time rate queries based on your contracts`);
      
    } catch (error: any) {
      if (error.message?.includes('not found in Pinecone')) {
        logger.error('\n❌ Failed to link to Pinecone Assistant');
        logger.error('Please check:');
        logger.error('  1. The assistant name matches exactly what you created in Pinecone dashboard');
        logger.error('  2. Your PINECONE_ASSISTANT_API_KEY is correct');
        logger.error('  3. You have access to Pinecone Assistant API');
        logger.error('  4. The assistant exists in your Pinecone project');
        logger.error('\nThe system will continue to work in mock mode.');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    logger.error('Failed to upgrade assistant:', error);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

// Run the upgrade
upgradeToRealAssistant();