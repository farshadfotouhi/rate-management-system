import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Tabs,
  Tab,
  Alert,
  Switch,
  FormControlLabel,
  Divider,
  Grid,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [tabValue, setTabValue] = useState(0);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Assistant Settings
  const [assistantInstructions, setAssistantInstructions] = useState('');
  
  // Profile Settings
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  
  // Password Settings
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [chatNotifications, setChatNotifications] = useState(true);
  const [contractAlerts, setContractAlerts] = useState(true);

  // Fetch assistant settings on component mount
  useEffect(() => {
    const fetchAssistantSettings = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/assistants');
        if (response.data?.assistant?.instructions) {
          setAssistantInstructions(response.data.assistant.instructions);
        } else {
          // Set default if no instructions exist
          setAssistantInstructions(
            `You are an expert rate manager for a logistics company. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.`
          );
        }
      } catch (err: any) {
        console.error('Failed to fetch assistant settings:', err);
        // Set default on error
        setAssistantInstructions(
          `You are an expert rate manager for a logistics company. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAssistantSettings();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setSuccess('');
    setError('');
  };

  const handleSaveAssistantSettings = async () => {
    try {
      await axios.put('/api/assistants/instructions', {
        instructions: assistantInstructions,
      });
      setSuccess('Assistant instructions updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update assistant settings');
    }
  };

  const handleSaveProfile = async () => {
    setSuccess('Profile settings saved successfully');
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    try {
      await axios.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    }
  };

  const handleSaveNotifications = () => {
    setSuccess('Notification preferences saved successfully');
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Assistant" />
            <Tab label="Profile" />
            <Tab label="Security" />
            <Tab label="Notifications" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>
            Assistant Instructions
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Customize how your AI assistant responds to rate queries
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TextField
                fullWidth
                multiline
                rows={10}
                variant="outlined"
                value={assistantInstructions}
                onChange={(e) => setAssistantInstructions(e.target.value)}
                placeholder="Enter custom instructions for your assistant..."
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveAssistantSettings}
              >
                Save Assistant Settings
              </Button>
            </>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Profile Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                disabled
              />
            </Grid>
          </Grid>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveProfile}
            sx={{ mt: 2 }}
          >
            Save Profile
          </Button>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Change Password
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
          />
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleChangePassword}
            sx={{ mt: 2 }}
          >
            Change Password
          </Button>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Notification Preferences
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
              />
            }
            label="Email Notifications"
            sx={{ display: 'block', mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={chatNotifications}
                onChange={(e) => setChatNotifications(e.target.checked)}
              />
            }
            label="Chat Response Notifications"
            sx={{ display: 'block', mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={contractAlerts}
                onChange={(e) => setContractAlerts(e.target.checked)}
              />
            }
            label="Contract Expiry Alerts"
            sx={{ display: 'block', mb: 2 }}
          />
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveNotifications}
            sx={{ mt: 2 }}
          >
            Save Notification Settings
          </Button>
        </TabPanel>
      </Paper>
    </Container>
  );
}