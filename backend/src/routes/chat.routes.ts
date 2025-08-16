import { Router, Response } from 'express';
import { z } from 'zod';
import { pineconeAssistantService } from '../services/pinecone-assistant.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { query } from '../database';

const router = Router();

const createSessionSchema = z.object({
  title: z.string().optional(),
});

const sendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
});

router.post('/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { title } = createSessionSchema.parse(req.body);
    
    const sessionId = await pineconeAssistantService.createChatSession(
      req.user!.tenantId,
      req.user!.userId,
      title
    );

    res.status(201).json({ sessionId });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      res.status(400).json({ error: error.message || 'Failed to create session' });
    }
  }
});

router.get('/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await query(
      `SELECT 
        id, title, status, started_at as "startedAt", ended_at as "endedAt"
      FROM chat_sessions
      WHERE user_id = $1 AND tenant_id = $2
      ORDER BY started_at DESC
      LIMIT 50`,
      [req.user!.userId, req.user!.tenantId]
    );

    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/sessions/:sessionId/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const [session] = await query(
      `SELECT tenant_id FROM chat_sessions WHERE id = $1`,
      [sessionId]
    );

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.tenant_id !== req.user!.tenantId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const messages = await query(
      `SELECT 
        id, role, content, tokens_used as "tokensUsed", 
        response_time_ms as "responseTimeMs", created_at as "createdAt"
      FROM chat_messages
      WHERE session_id = $1
      ORDER BY created_at ASC`,
      [sessionId]
    );

    res.json({ messages });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/send', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, message } = sendMessageSchema.parse(req.body);
    
    const [session] = await query(
      `SELECT tenant_id FROM chat_sessions WHERE id = $1`,
      [sessionId]
    );

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.tenant_id !== req.user!.tenantId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const response = await pineconeAssistantService.sendMessage(sessionId, message);
    
    res.json({
      response: response.response,
      tokensUsed: response.tokensUsed,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      res.status(400).json({ error: error.message || 'Failed to send message' });
    }
  }
});

router.put('/sessions/:sessionId/end', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    await query(
      `UPDATE chat_sessions 
      SET status = 'ended', ended_at = NOW()
      WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user!.userId]
    );

    res.json({ message: 'Session ended successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to end session' });
  }
});

router.delete('/sessions/:sessionId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Verify ownership
    const [session] = await query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user!.userId]
    );
    
    if (!session) {
      res.status(404).json({ error: 'Session not found or access denied' });
      return;
    }
    
    // Delete messages first (cascade)
    await query(
      `DELETE FROM chat_messages WHERE session_id = $1`,
      [sessionId]
    );
    
    // Delete session
    await query(
      `DELETE FROM chat_sessions WHERE id = $1`,
      [sessionId]
    );

    res.json({ message: 'Session deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;