import { Router, Response } from 'express';
import { z } from 'zod';
import { pineconeAssistantService } from '../services/pinecone-assistant.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const updateInstructionsSchema = z.object({
  instructions: z.string().min(10),
});

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const assistant = await pineconeAssistantService.getAssistantForTenant(req.user!.tenantId);
    
    if (!assistant) {
      res.status(404).json({ error: 'No assistant found for this tenant' });
      return;
    }

    res.json({ assistant });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch assistant' });
  }
});

router.put('/instructions', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { instructions } = updateInstructionsSchema.parse(req.body);
    
    await pineconeAssistantService.updateAssistantInstructions(
      req.user!.tenantId,
      instructions
    );

    res.json({ message: 'Instructions updated successfully' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      res.status(400).json({ error: error.message || 'Failed to update instructions' });
    }
  }
});

router.post('/reset', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    await pineconeAssistantService.deleteAssistant(req.user!.tenantId);
    
    const assistant = await pineconeAssistantService.createMockAssistantForTenant(
      req.user!.tenantId,
      {
        instructions: undefined, // Use default instructions
      }
    );

    res.json({ 
      message: 'Assistant reset successfully',
      assistant: {
        id: assistant.id,
        name: assistant.name,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset assistant' });
  }
});

export default router;