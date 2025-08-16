import { config } from '../config';
import { authService } from '../services/auth.service';
import { pineconeAssistantService } from '../services/pinecone-assistant.service';
import { initDatabase, closeDatabase } from '../database';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

async function setupInitialAdmin() {
  try {
    logger.info('Starting initial setup...');
    
    // Initialize database connection
    await initDatabase();
    
    // Create the first tenant
    logger.info('Creating initial tenant...');
    const tenant = await authService.createTenant(
      'Demo Company',
      'Demo Freight Forwarders Inc.',
      'contact@demofreight.com',
      '+1-555-0123',
      '123 Shipping Lane, Port City, PC 12345'
    );
    
    logger.info(`Tenant created with ID: ${tenant.id}`);
    
    // Create admin user for this tenant
    logger.info('Creating admin user...');
    const adminUser = await authService.register(
      tenant.id,
      'admin@demofreight.com',
      'Admin123!@#',  // Default password - should be changed after first login
      'Admin',
      'User',
      'admin'
    );
    
    logger.info(`Admin user created with email: ${adminUser.email}`);
    
    // Create Pinecone Assistant for the tenant
    logger.info('Setting up Pinecone Assistant...');
    try {
      const assistant = await pineconeAssistantService.createMockAssistantForTenant(
        tenant.id,
        {
          instructions: `You are an expert rate manager for ${tenant.companyName}. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.
          
When answering questions:
1. Always provide specific rates when available from the uploaded contracts
2. Mention any special terms or restrictions
3. Suggest the most cost-effective options
4. Consider transit times and reliability
5. Decode port codes to their full names for clarity
6. If no specific rate is found in the contracts, clearly state that and provide general guidance`,
        }
      );
      
      logger.info(`Pinecone Assistant created with ID: ${assistant.pineconeAssistantId}`);
    } catch (error) {
      logger.warn('Could not create Pinecone Assistant. You may need to set it up manually.');
      logger.warn('Make sure you have the correct Pinecone Assistant API key in your .env file');
    }
    
    logger.info('\n========================================');
    logger.info('✅ Initial setup completed successfully!');
    logger.info('========================================\n');
    logger.info('You can now login with:');
    logger.info('  Email: admin@demofreight.com');
    logger.info('  Password: Admin123!@#');
    logger.info('\n⚠️  IMPORTANT: Please change the password after first login!\n');
    logger.info('Access the application at: http://localhost:3001');
    logger.info('========================================\n');
    
  } catch (error) {
    logger.error('Setup failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

// Run the setup
setupInitialAdmin();