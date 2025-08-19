import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { contractExtractionService } from '../services/contract-extraction.service';
import { query } from '../database';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Start extraction for a contract
router.post('/contracts/:contractId/extract', authenticate, async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const userId = req.user!.userId;
    const tenantId = req.user!.tenantId;

    // Verify contract belongs to tenant
    const [contract] = await query(
      `SELECT id FROM contracts WHERE id = $1 AND tenant_id = $2`,
      [contractId, tenantId]
    );

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check if extraction is already in progress
    const [existingJob] = await query(
      `SELECT id, status FROM extraction_jobs 
       WHERE contract_id = $1 AND status IN ('pending', 'processing')
       ORDER BY created_at DESC LIMIT 1`,
      [contractId]
    );

    if (existingJob) {
      return res.status(400).json({ 
        error: 'Extraction already in progress',
        jobId: existingJob.id,
        status: existingJob.status
      });
    }

    // Start extraction
    const jobId = await contractExtractionService.startExtraction(contractId, userId);

    res.json({
      message: 'Extraction started successfully',
      jobId,
      status: 'pending'
    });

  } catch (error: any) {
    logger.error('Failed to start extraction:', error);
    res.status(500).json({ error: 'Failed to start extraction' });
  }
});

// Get extraction job status
router.get('/extraction-jobs/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify job belongs to tenant
    const job = await contractExtractionService.getExtractionJob(jobId);

    if (!job || job.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    // Calculate progress percentage
    const progress = job.totalSections > 0 
      ? Math.round((job.completedSections / job.totalSections) * 100)
      : 0;

    res.json({
      ...job,
      progress
    });

  } catch (error: any) {
    logger.error('Failed to get extraction job:', error);
    res.status(500).json({ error: 'Failed to get extraction job status' });
  }
});

// Get all extraction jobs for a contract
router.get('/contracts/:contractId/extraction-jobs', authenticate, async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify contract belongs to tenant
    const [contract] = await query(
      `SELECT id FROM contracts WHERE id = $1 AND tenant_id = $2`,
      [contractId, tenantId]
    );

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const jobs = await contractExtractionService.getExtractionJobsByContract(contractId);

    res.json(jobs);

  } catch (error: any) {
    logger.error('Failed to get extraction jobs:', error);
    res.status(500).json({ error: 'Failed to get extraction jobs' });
  }
});

// Cancel extraction job
router.post('/extraction-jobs/:jobId/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify job belongs to tenant and is cancellable
    const [job] = await query(
      `SELECT id, status FROM extraction_jobs 
       WHERE id = $1 AND tenant_id = $2`,
      [jobId, tenantId]
    );

    if (!job) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    if (job.status !== 'pending' && job.status !== 'processing') {
      return res.status(400).json({ error: 'Job cannot be cancelled', currentStatus: job.status });
    }

    await contractExtractionService.cancelExtraction(jobId);

    res.json({ message: 'Extraction cancelled successfully' });

  } catch (error: any) {
    logger.error('Failed to cancel extraction:', error);
    res.status(500).json({ error: 'Failed to cancel extraction' });
  }
});

// Download extraction results
router.get('/extraction-jobs/:jobId/download/:fileName?', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId, fileName } = req.params;
    const tenantId = req.user!.tenantId;

    // Get job details
    const job = await contractExtractionService.getExtractionJob(jobId);

    if (!job || job.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Extraction not completed', status: job.status });
    }

    // Determine which file to download
    const targetFileName = fileName || 'complete_extraction.json';
    const filePath = path.join(job.outputDirectory, targetFileName);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    // Read and send file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${targetFileName}"`);
    res.send(fileContent);

  } catch (error: any) {
    logger.error('Failed to download extraction results:', error);
    res.status(500).json({ error: 'Failed to download extraction results' });
  }
});

// List available extraction files for a job
router.get('/extraction-jobs/:jobId/files', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const tenantId = req.user!.tenantId;

    // Get job details
    const job = await contractExtractionService.getExtractionJob(jobId);

    if (!job || job.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Extraction not completed', status: job.status });
    }

    // List files in output directory
    const files = await fs.readdir(job.outputDirectory);
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(job.outputDirectory, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        };
      })
    );

    res.json({
      jobId,
      outputDirectory: job.outputDirectory,
      files: fileDetails
    });

  } catch (error: any) {
    logger.error('Failed to list extraction files:', error);
    res.status(500).json({ error: 'Failed to list extraction files' });
  }
});

export default router;