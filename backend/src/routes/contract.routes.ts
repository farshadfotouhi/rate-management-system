import { Router, Response } from 'express';
import multer from 'multer';
import { contractProcessorService } from '../services/contract-processor.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { config } from '../config';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = config.ALLOWED_FILE_TYPES.split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

router.post('/upload', authenticate, upload.single('contract'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const contract = await contractProcessorService.processContract(
      req.user!.tenantId,
      req.user!.userId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(201).json({
      message: 'Contract uploaded and processed successfully',
      contract: {
        id: contract.id,
        fileName: contract.fileName,
        carrierName: contract.carrierName,
        contractNumber: contract.contractNumber,
        metadata: contract.metadata,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to process contract' });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const contracts = await contractProcessorService.getContractsForTenant(req.user!.tenantId);
    
    res.json({ contracts });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

router.delete('/:contractId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { contractId } = req.params;
    
    await contractProcessorService.deleteContract(contractId, req.user!.tenantId);
    
    res.json({ message: 'Contract deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

export default router;