import React, { useState, useEffect, useCallback } from 'react';
import { Grid, Typography, Box, CircularProgress, Paper, List, ListItem, ListItemText, ListItemIcon, Avatar, Divider } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StatCard from '../components/common/StatCard';
import UsersStatsModal from '../components/UsersStatsModal';
import ActiveUsersModal from '../components/ActiveUsersModal';
import PhysiciansModal from '../components/PhysiciansModal';
import DisabledUsersModal from '../components/DisabledUsersModal';
import TopFoodsChart from '../components/TopFoodsChart';
import MealAveragesCard from '../components/MealAveragesCard';
import { useAuth } from '../contexts/AuthContext';
import adminService from '../services/adminService';
import { Doughnut, Bar } from 'react-chartjs-2';

const API_BASE_URL = process.env.REACT_APP_API_URL

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getCachedToken } = useAuth();
  const [openUsersModal, setOpenUsersModal] = useState(false);
  const [openActiveUsersModal, setOpenActiveUsersModal] = useState(false);
  const [openPhysiciansModal, setOpenPhysiciansModal] = useState(false);
  const [openDisabledUsersModal, setOpenDisabledUsersModal] = useState(false);

  // New dashboard widgets state
  const [riskDist, setRiskDist] = useState(null);
  const [trackerAdoption, setTrackerAdoption] = useState(null);
  const [consultSummary, setConsultSummary] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

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

  // Fetch new dashboard widgets
  useEffect(() => {
    const load = async () => {
      try {
        const [rd, ta, cs, ra] = await Promise.allSettled([
          adminService.getRiskDistribution(),
          adminService.getTrackerAdoption(),
          adminService.getConsultationsSummary(),
          adminService.getRecentActivity(5),
        ]);
        if (rd.status === 'fulfilled') setRiskDist(rd.value);
        if (ta.status === 'fulfilled') setTrackerAdoption(ta.value);
        if (cs.status === 'fulfilled') setConsultSummary(cs.value);
        if (ra.status === 'fulfilled') setRecentActivity(ra.value.activities || []);
      } catch (e) { console.error('Dashboard widgets error:', e); }
    };
    load();
  }, []);

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
        {/* Risk Distribution Doughnut */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              <WarningAmberIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#f59e0b' }} />
              Risk Distribution
            </Typography>
            {riskDist ? (
              <Box sx={{ maxWidth: 280, mx: 'auto', mt: 2 }}>
                <Doughnut
                  data={{
                    labels: ['Low', 'Moderate', 'High', 'Very High'],
                    datasets: [{
                      data: [
                        riskDist.low || 0,
                        riskDist.moderate || 0,
                        riskDist.high || 0,
                        riskDist.very_high || 0,
                      ],
                      backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#991b1b'],
                    }],
                  }}
                  options={{ plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: true }}
                />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
            )}
          </Paper>
        </Grid>

        {/* Tracker Adoption Bar */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              📈 Tracker Adoption
            </Typography>
            {trackerAdoption ? (
              <Box sx={{ mt: 2 }}>
                <Bar
                  data={{
                    labels: Object.keys(trackerAdoption.trackers || {}),
                    datasets: [{
                      label: 'Active Users',
                      data: Object.values(trackerAdoption.trackers || {}),
                      backgroundColor: ['#667eea', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
                      borderRadius: 6,
                    }],
                  }}
                  options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
            )}
          </Paper>
        </Grid>

        {/* Consultation Summary + Recent Activity */}
        <Grid item xs={12} lg={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              <VideoCallIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#06b6d4' }} />
              Consultations
            </Typography>
            {consultSummary ? (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                <Chip label={`${consultSummary.total || 0} Total`} color="primary" />
                <Chip label={`${consultSummary.pending || 0} Pending`} color="warning" />
                <Chip label={`${consultSummary.completed || 0} Completed`} color="success" />
              </Box>
            ) : <CircularProgress size={24} />}
          </Paper>

          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              <AccessTimeIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#667eea' }} />
              Recent Activity
            </Typography>
            {recentActivity.length > 0 ? (
              <List dense disablePadding>
                {recentActivity.map((a, i) => (
                  <React.Fragment key={i}>
                    <ListItem disableGutters sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: '#667eea', fontSize: 12 }}>
                          {(a.user || '?').charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={a.description || a.type || 'Activity'}
                        secondary={a.time || ''}
                        primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 500 }}
                        secondaryTypographyProps={{ fontSize: '0.72rem' }}
                      />
                    </ListItem>
                    {i < recentActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">No recent activity</Typography>
            )}
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
