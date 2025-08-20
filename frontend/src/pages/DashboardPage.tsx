import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Chat as ChatIcon,
  Description as DocumentIcon,
  LocalShipping as ShippingIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface DashboardStats {
  totalContracts: number;
  activeContracts: number;
  totalQueries: number;
  averageResponseTime: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalContracts: 0,
    activeContracts: 0,
    totalQueries: 0,
    averageResponseTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // In a real app, this would fetch from an API endpoint
      // For now, we'll use mock data
      setTimeout(() => {
        setStats({
          totalContracts: 12,
          activeContracts: 10,
          totalQueries: 156,
          averageResponseTime: 1.2,
        });
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setIsLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color }: any) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}.light`,
              color: `${color}.main`,
              mr: 2,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4">{value}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        RMS Agent Dashboard
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
        Welcome back, {user?.firstName || 'User'}! Here's your rate management overview
      </Typography>

      {isLoading ? (
        <LinearProgress />
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Contracts"
                value={stats.totalContracts}
                icon={<DocumentIcon />}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Contracts"
                value={stats.activeContracts}
                icon={<TrendingUpIcon />}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Queries"
                value={stats.totalQueries}
                icon={<ChatIcon />}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Avg Response Time"
                value={`${stats.averageResponseTime}s`}
                icon={<ShippingIcon />}
                color="warning"
              />
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    • Contract "MAERSK-2024-Q1" uploaded successfully
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    • New rate query: "Shanghai to Los Angeles 40ft container"
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    • Assistant instructions updated
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    • Contract "CMA-CGM-2023" expired
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="body2"
                    onClick={() => navigate('/chat')}
                    sx={{
                      cursor: 'pointer',
                      color: 'primary.main',
                      '&:hover': { textDecoration: 'underline' },
                      mb: 1,
                    }}
                  >
                    → Start a new chat session
                  </Typography>
                  <Typography
                    variant="body2"
                    onClick={() => navigate('/contracts')}
                    sx={{
                      cursor: 'pointer',
                      color: 'primary.main',
                      '&:hover': { textDecoration: 'underline' },
                      mb: 1,
                    }}
                  >
                    → Upload a new contract
                  </Typography>
                  <Typography
                    variant="body2"
                    onClick={() => navigate('/contracts')}
                    sx={{
                      cursor: 'pointer',
                      color: 'primary.main',
                      '&:hover': { textDecoration: 'underline' },
                      mb: 1,
                    }}
                  >
                    → View all contracts
                  </Typography>
                  <Typography
                    variant="body2"
                    onClick={() => navigate('/settings')}
                    sx={{
                      cursor: 'pointer',
                      color: 'primary.main',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    → Configure assistant settings
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  );
}