import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Card, CardContent, Avatar,
  Tabs, Tab, Chip, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow,
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import SmokingRoomsIcon from '@mui/icons-material/SmokingRooms';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import adminService from '../services/adminService';
import { Bar, Doughnut } from 'react-chartjs-2';

const TRACKER_TABS = [
  { label: 'Food', icon: <RestaurantIcon />, key: 'food', color: '#10b981' },
  { label: 'Steps', icon: <DirectionsWalkIcon />, key: 'steps', color: '#667eea' },
  { label: 'Sleep', icon: <BedtimeIcon />, key: 'sleep', color: '#7c3aed' },
  { label: 'Smoking', icon: <SmokingRoomsIcon />, key: 'smoking', color: '#f59e0b' },
  { label: 'Alcohol', icon: <LocalBarIcon />, key: 'alcohol', color: '#ef4444' },
];

function HealthTrackersPage() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [food, steps, sleep, smoking, alcohol] = await Promise.allSettled([
          adminService.getFoodTrackerStats(),
          adminService.getStepTrackerStats(),
          adminService.getSleepTrackerStats(),
          adminService.getSmokingTrackerStats(),
          adminService.getAlcoholTrackerStats(),
        ]);
        setData({
          food: food.status === 'fulfilled' ? food.value : null,
          steps: steps.status === 'fulfilled' ? steps.value : null,
          sleep: sleep.status === 'fulfilled' ? sleep.value : null,
          smoking: smoking.status === 'fulfilled' ? smoking.value : null,
          alcohol: alcohol.status === 'fulfilled' ? alcohol.value : null,
        });
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={60} /></Box>;

  const currentTracker = TRACKER_TABS[tab];
  const trackerData = data[currentTracker.key];

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #667eea 0%, #06b6d4 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        <MonitorHeartIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 36, color: '#667eea' }} />
        Health Trackers
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Platform-wide statistics for all lifestyle trackers.
      </Typography>

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e0e0', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 } }}>
          {TRACKER_TABS.map((t, i) => (
            <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" />
          ))}
        </Tabs>
      </Paper>

      {!trackerData ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px solid #e0e0e0' }}>
          <Typography color="text.secondary">No data available for {currentTracker.label} tracker</Typography>
        </Paper>
      ) : (
        <TrackerPanel data={trackerData} tracker={currentTracker} />
      )}
    </Box>
  );
}

function TrackerPanel({ data, tracker }) {
  const statEntries = Object.entries(data).filter(([k]) => typeof data[k] === 'number' || typeof data[k] === 'string');
  const listEntries = Object.entries(data).filter(([k]) => Array.isArray(data[k]));
  const objEntries = Object.entries(data).filter(([k]) => typeof data[k] === 'object' && !Array.isArray(data[k]) && data[k] !== null);

  return (
    <>
      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statEntries.slice(0, 8).map(([key, value]) => (
          <Grid item xs={6} sm={4} md={3} key={key}>
            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}>
              <CardContent sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: tracker.color + '20', color: tracker.color, width: 40, height: 40 }}>
                  {tracker.icon}
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                    {key.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Object data as charts */}
      <Grid container spacing={3}>
        {objEntries.map(([key, obj]) => (
          <Grid item xs={12} md={6} key={key}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
              <Typography variant="h6" gutterBottom fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                {key.replace(/_/g, ' ')}
              </Typography>
              {Object.keys(obj).length <= 6 ? (
                <Doughnut
                  data={{
                    labels: Object.keys(obj),
                    datasets: [{
                      data: Object.values(obj),
                      backgroundColor: ['#667eea', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#7c3aed'],
                    }],
                  }}
                  options={{ plugins: { legend: { position: 'bottom' } } }}
                />
              ) : (
                <Bar
                  data={{
                    labels: Object.keys(obj).slice(0, 12),
                    datasets: [{
                      label: key.replace(/_/g, ' '),
                      data: Object.values(obj).slice(0, 12),
                      backgroundColor: tracker.color,
                      borderRadius: 4,
                    }],
                  }}
                  options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                />
              )}
            </Paper>
          </Grid>
        ))}

        {/* Array data as tables */}
        {listEntries.map(([key, arr]) => (
          <Grid item xs={12} key={key}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
              <Typography variant="h6" gutterBottom fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                {key.replace(/_/g, ' ')}
              </Typography>
              {arr.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No data</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        {Object.keys(arr[0]).slice(0, 6).map(col => (
                          <TableCell key={col} sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                            {col.replace(/_/g, ' ')}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {arr.slice(0, 10).map((row, ri) => (
                        <TableRow key={ri} hover>
                          {Object.keys(arr[0]).slice(0, 6).map(col => (
                            <TableCell key={col}>{String(row[col] ?? '—')}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </>
  );
}

export default HealthTrackersPage;
