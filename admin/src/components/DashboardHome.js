import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Grid, CircularProgress, Box } from '@mui/material';
import userService from '../services/userService';

function DashboardHome() {
  const [stats, setStats] = useState({ totalUsers: 0, loading: true });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const users = await userService.getAllUsers();
      setStats({
        totalUsers: users.total || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  if (stats.loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Dashboard Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ boxShadow: 2 }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Users
              </Typography>
              <Typography variant="h5">{stats.totalUsers}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ boxShadow: 2 }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Sessions
              </Typography>
              <Typography variant="h5">0</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ boxShadow: 2 }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                System Status
              </Typography>
              <Typography variant="h5" sx={{ color: 'green' }}>
                Online
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DashboardHome;
