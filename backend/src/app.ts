import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { initDatabase } from './database';
import winston from 'winston';

import authRoutes from './routes/auth.routes';
import tenantRoutes from './routes/tenant.routes';
import assistantRoutes from './routes/assistant.routes';
import contractRoutes from './routes/contract.routes';
import chatRoutes from './routes/chat.routes';
import extractionRoutes from './routes/extraction.routes';

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({ 
      filename: config.LOG_FILE_PATH,
      level: 'error' 
    }),
  ],
});

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  
  app.use(cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  }));

  app.use(compression());

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use('/api/', limiter);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('Request processed', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        ip: req.ip,
      });
    });
    next();
  });

  app.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/tenants', tenantRoutes);
  app.use('/api/assistants', assistantRoutes);
  app.use('/api/contracts', contractRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/extraction', extractionRoutes);

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
    });

    res.status(500).json({
      error: config.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
    });
  });

  return app;
}

export async function startApp(): Promise<void> {
  try {
    await initDatabase();
    
    const app = createApp();
    const port = config.PORT;

    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}