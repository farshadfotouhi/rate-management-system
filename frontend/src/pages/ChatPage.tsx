import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Avatar,
  Chip,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  AttachFile as AttachFileIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  tokensUsed?: number;
}

interface Session {
  id: string;
  title: string;
  startedAt: Date;
  endedAt?: Date;
}

export default function ChatPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSessions = async () => {
    try {
      const response = await axios.get('/api/chat/sessions');
      setSessions(response.data.sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await axios.post('/api/chat/sessions', {
        title: `Chat - ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
      });
      const sessionId = response.data.sessionId;
      
      const newSession = {
        id: sessionId,
        title: `Chat - ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
        startedAt: new Date(),
      };
      
      setCurrentSession(newSession);
      // Check if session already exists before adding
      setSessions(prev => {
        const exists = prev.some(s => s.id === sessionId);
        if (exists) return prev;
        return [newSession, ...prev];
      });
      setMessages([]);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await axios.get(`/api/chat/sessions/${sessionId}/messages`);
      const loadedMessages = response.data.messages.map((msg: any) => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
      }));
      setMessages(loadedMessages);
      
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        setCurrentSession(session);
      }
    } catch (error) {
      console.error('Failed to load session messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    let sessionId = currentSession?.id;
    
    // Create a session if none exists
    if (!sessionId) {
      try {
        const response = await axios.post('/api/chat/sessions', {
          title: `Chat - ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
        });
        sessionId = response.data.sessionId;
        
        const newSession = {
          id: sessionId,
          title: `Chat - ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
          startedAt: new Date(),
        };
        
        setCurrentSession(newSession);
        setSessions(prev => {
          const exists = prev.some(s => s.id === sessionId);
          if (exists) return prev;
          return [newSession, ...prev];
        });
        setMessages([]);
      } catch (error) {
        console.error('Failed to create session:', error);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputMessage; // Store before clearing
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/chat/send', {
        sessionId: sessionId,
        message: messageText,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        createdAt: new Date(),
        tokensUsed: response.data.tokensUsed,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update session title if this was the first message
      if (messages.length === 0 && currentSession) {
        const updatedSession = {
          ...currentSession,
          title: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
        };
        setCurrentSession(updatedSession);
        setSessions(prev => 
          prev.map(s => s.id === sessionId ? updatedSession : s)
        );
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'I apologize, but I encountered an issue processing your message. This could be due to a temporary connectivity problem. Please try again in a moment.',
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the onClick to load the session
    
    if (!window.confirm('Are you sure you want to delete this chat session?')) {
      return;
    }
    
    try {
      await axios.delete(`/api/chat/sessions/${sessionId}`);
      
      // Remove from sessions list
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // If deleting current session, create a new one
      if (currentSession?.id === sessionId) {
        await createNewSession();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <Box sx={{ height: 'calc(100vh - 140px)', display: 'flex' }}>
      <Grid container spacing={2} sx={{ height: '100%' }}>
        <Grid item xs={3} sx={{ height: '100%' }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Sessions</Typography>
                <IconButton 
                  size="small" 
                  onClick={createNewSession}
                  title="New Chat"
                >
                  <AddIcon />
                </IconButton>
              </Box>
            </Box>
            <Divider />
            <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
              {sessions.map((session) => (
                <ListItem
                  key={session.id}
                  button
                  selected={currentSession?.id === session.id}
                  onClick={() => loadSession(session.id)}
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={(e) => deleteSession(session.id, e)}
                      sx={{ 
                        opacity: 0.5,
                        '&:hover': { opacity: 1 }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                  sx={{
                    '&:hover .MuiListItemSecondaryAction-root': {
                      opacity: 1
                    }
                  }}
                >
                  <ListItemText
                    primary={session.title}
                    secondary={format(new Date(session.startedAt), 'MMM dd, HH:mm')}
                    primaryTypographyProps={{
                      noWrap: true,
                      sx: { pr: 2 }
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={9} sx={{ height: '100%' }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h5" sx={{ color: 'primary.main' }}>
                RMS Agent
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ask questions about your contracts, rates, and shipping routes
              </Typography>
            </Box>

            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
              {messages.map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
                      maxWidth: '70%',
                    }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                        mx: 1,
                      }}
                    >
                      {message.role === 'user' ? <PersonIcon /> : <BotIcon />}
                    </Avatar>
                    <Card
                      sx={{
                        bgcolor: message.role === 'user' ? 'primary.light' : 'grey.100',
                        color: message.role === 'user' ? 'white' : 'text.primary',
                      }}
                    >
                      <CardContent>
                        {message.role === 'assistant' ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <Typography>{message.content}</Typography>
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            {format(message.createdAt, 'HH:mm')}
                          </Typography>
                          {message.tokensUsed && (
                            <Chip
                              size="small"
                              label={`${message.tokensUsed} tokens`}
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>
                </Box>
              ))}
              {isLoading && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
                  <CircularProgress size={30} />
                  <Typography variant="caption" sx={{ mt: 1, opacity: 0.7 }}>
                    Assistant is thinking...
                  </Typography>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Box>

            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <IconButton sx={{ mr: 1 }}>
                  <AttachFileIcon />
                </IconButton>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  variant="outlined"
                  placeholder="Ask about rates, routes, carriers, or contract terms..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  sx={{ mr: 1 }}
                />
                <IconButton
                  color="primary"
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                >
                  <SendIcon />
                </IconButton>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}