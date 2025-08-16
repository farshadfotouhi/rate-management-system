import { initDatabase, closeDatabase, query } from '../database';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

async function checkUsers() {
  try {
    logger.info('Checking users in database...');
    
    // Initialize database connection
    await initDatabase();
    
    const users = await query(
      `SELECT id, tenant_id, email, first_name, last_name, role FROM users`
    );
    
    logger.info('Users found:', users.length);
    users.forEach((user: any) => {
      logger.info(`- ${user.email} (${user.first_name} ${user.last_name}) - Role: ${user.role}`);
    });
    
    if (users.length === 0) {
      logger.info('No users found. Creating admin user...');
      
      const bcrypt = await import('bcrypt');
      const { v4: uuidv4 } = await import('uuid');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const tenantId = 'ed8b214d-c033-42c0-bd2d-e055eda285cf';
      
      await query(
        `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), tenantId, 'admin@acmefreight.com', hashedPassword, 'Admin', 'User', 'admin']
      );
      
      logger.info('✅ Admin user created!');
      logger.info('Email: admin@acmefreight.com');
      logger.info('Password: admin123');
    }
    
  } catch (error) {
    logger.error('Failed to check users:', error);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

// Run the check
checkUsers();