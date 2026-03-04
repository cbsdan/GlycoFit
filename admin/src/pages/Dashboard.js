import React, { useState, useEffect, useCallback } from 'react';
import { Grid, Typography, Box, CircularProgress, Paper } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import StatCard from '../components/common/StatCard';
import UsersStatsModal from '../components/UsersStatsModal';
import ActiveUsersModal from '../components/ActiveUsersModal';
import PhysiciansModal from '../components/PhysiciansModal';
import DisabledUsersModal from '../components/DisabledUsersModal';
import TopFoodsChart from '../components/TopFoodsChart';
import MealAveragesCard from '../components/MealAveragesCard';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getCachedToken } = useAuth();
  const [openUsersModal, setOpenUsersModal] = useState(false);
  const [openActiveUsersModal, setOpenActiveUsersModal] = useState(false);
  const [openPhysiciansModal, setOpenPhysiciansModal] = useState(false);
  const [openDisabledUsersModal, setOpenDisabledUsersModal] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    try {
      const token = await getCachedToken();
      if (!token) return { 'Content-Type': 'application/json' };
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
    } catch (err) {
      return { 'Content-Type': 'application/json' };
    }
  }, [getCachedToken]);

  const fetchStats = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/users/stats`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      <div>
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{ 
            fontWeight: 700,
            mb: 1,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Dashboard Overview
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Monitor and manage your GlycoFit platform
        </Typography>
      </div>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total Users"
            value={stats?.total_users || 0}
            subtitle="All registered users"
            icon={<PeopleIcon />}
            color="#667eea"
            onClick={() => setOpenUsersModal(true)}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Active Users"
            value={stats?.active_users || 0}
            subtitle="Currently active"
            icon={<VerifiedUserIcon />}
            color="#06b6d4"
            onClick={() => setOpenActiveUsersModal(true)}
          />
        </Grid>

          {openUsersModal && (
            <UsersStatsModal
              open={openUsersModal}
              onClose={() => setOpenUsersModal(false)}
              apiBase={API_BASE_URL}
              getAuthHeaders={getAuthHeaders}
              initialStats={stats || {}}
            />
          )}
          {openActiveUsersModal && (
            <ActiveUsersModal
              open={openActiveUsersModal}
              onClose={() => setOpenActiveUsersModal(false)}
              apiBase={API_BASE_URL}
              getAuthHeaders={getAuthHeaders}
            />
          )}
          {openPhysiciansModal && (
            <PhysiciansModal
              open={openPhysiciansModal}
              onClose={() => setOpenPhysiciansModal(false)}
              apiBase={API_BASE_URL}
              getAuthHeaders={getAuthHeaders}
            />
          )}
          {openDisabledUsersModal && (
            <DisabledUsersModal
              open={openDisabledUsersModal}
              onClose={() => setOpenDisabledUsersModal(false)}
              apiBase={API_BASE_URL}
              getAuthHeaders={getAuthHeaders}
            />
          )}
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Physicians"
            value={stats?.physicians || 0}
            subtitle="Medical professionals"
            icon={<LocalHospitalIcon />}
            color="#10b981"
            onClick={() => setOpenPhysiciansModal(true)}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Disabled Users"
            value={stats?.disabled_users || 0}
            subtitle="Temporarily disabled"
            icon={<PersonOffIcon />}
            color="#f59e0b"
            onClick={() => setOpenDisabledUsersModal(true)}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6} lg={4}>
          <MealAveragesCard apiBase={API_BASE_URL} getAuthHeaders={getAuthHeaders} />
        </Grid>

        <Grid item xs={12} md={6} lg={8}>
          <TopFoodsChart apiBase={API_BASE_URL} getAuthHeaders={getAuthHeaders} />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
            <Paper 
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                border: '1px solid #667eea30',
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                📊 System Overview
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Welcome to the GlycoFit Admin Dashboard. Here you can manage users, create physician accounts, and monitor system activity.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip label="Users Management" color="primary" variant="outlined" />
                <Chip label="Meal Monitoring" color="secondary" variant="outlined" />
                <Chip label="Account Control" color="success" variant="outlined" />
              </Box>
            </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function Chip({ label, color, variant }) {
  return (
    <Box
      sx={{
        px: 2,
        py: 0.5,
        borderRadius: 2,
        border: `1px solid`,
        borderColor: `${color}.main`,
        color: `${color}.main`,
        fontSize: '0.875rem',
        fontWeight: 500,
      }}
    >
      {label}
    </Box>
  );
}

export default Dashboard;
