import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { pineconeAssistantService } from '../services/pinecone-assistant.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const createTenantSchema = z.object({
  name: z.string(),
  companyName: z.string(),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
  adminFirstName: z.string().optional(),
  adminLastName: z.string().optional(),
});

router.post('/', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const data = createTenantSchema.parse(req.body);
    
    const tenant = await authService.createTenant(
      data.name,
      data.companyName,
      data.contactEmail,
      data.contactPhone,
      data.address
    );

    const adminUser = await authService.register(
      tenant.id,
      data.adminEmail,
      data.adminPassword,
      data.adminFirstName,
      data.adminLastName,
      'manager'
    );

    const assistant = await pineconeAssistantService.createMockAssistantForTenant(tenant.id, {
      instructions: `You are an expert rate manager for ${data.companyName}. You know the rate contracts for each carrier like the back of your hand.`,
    });

    res.status(201).json({
      tenant,
      adminUser,
      assistant: {
        id: assistant.id,
        name: assistant.name,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      res.status(400).json({ error: error.message || 'Failed to create tenant' });
    }
  }
});

router.get('/:tenantId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    if (req.user!.tenantId !== tenantId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const tenant = await authService.getTenantById(tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json({ tenant });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

router.put('/:tenantId', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    if (req.user!.tenantId !== tenantId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ message: 'Tenant update endpoint - to be implemented' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

router.delete('/:tenantId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    await pineconeAssistantService.deleteAssistant(tenantId);

    res.json({ message: 'Tenant deletion endpoint - to be implemented' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

export default router;