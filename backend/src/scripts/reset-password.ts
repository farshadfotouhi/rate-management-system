import { initDatabase, closeDatabase, query } from '../database';
import bcrypt from 'bcrypt';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

async function resetPassword() {
  try {
    logger.info('Resetting password for admin user...');
    
    // Initialize database connection
    await initDatabase();
    
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await query(
      `UPDATE users SET password_hash = $1 WHERE email = $2`,
      [hashedPassword, 'admin@demofreight.com']
    );
    
    logger.info('✅ Password reset successfully!');
    logger.info('Email: admin@demofreight.com');
    logger.info('Password: admin123');
    
  } catch (error) {
    logger.error('Failed to reset password:', error);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

// Run the reset
resetPassword();