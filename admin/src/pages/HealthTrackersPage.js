import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Card, CardContent, Avatar,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogContentText,
  IconButton, Divider, LinearProgress, Chip,
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import SmokingRoomsIcon from '@mui/icons-material/SmokingRooms';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import adminService from '../services/adminService';
import { Bar, Doughnut } from 'react-chartjs-2';

const TRACKER_TREND_INFO = {
  food: {
    title: 'Food Tracker — Trend Summary',
    description:
      'Tracks average nutrient intake per meal, food type diversity, and diet-based diabetes risk across all users. ' +
      'Rising averages in added sugars, refined carbs, or processed foods signal increasing dietary risk. ' +
      'The risk distribution shows how many users fall into each dietary risk tier based on their baseline assessment.',
  },
  steps: {
    title: 'Step Tracker — Trend Summary',
    description:
      'Measures platform-wide average daily step count and 10,000-step goal achievement rate over the last 30 days. ' +
      'A declining average or low goal achievement rate indicates growing sedentary behavior and elevated diabetes risk. ' +
      'Activity level distribution shows the breakdown of user fitness profiles from their baseline onboarding.',
  },
  sleep: {
    title: 'Sleep Tracker — Trend Summary',
    description:
      'Monitors average sleep duration and the percentage of users sleeping too little (<6h) or too much (>9h). ' +
      'Both extremes are associated with increased insulin resistance and T2D risk. ' +
      'Source distribution reveals the mix of manual entries vs. Health Connect wearable sync.',
  },
  smoking: {
    title: 'Smoking Tracker — Trend Summary',
    description:
      'Displays smoking status across the user base. Active smoking increases T2D risk by ~44% (Willi et al., 2007 JAMA). ' +
      'A higher proportion of current smokers raises overall platform risk. ' +
      'Former smoker statistics show average cessation duration, which correlates with risk reduction over time.',
  },
  alcohol: {
    title: 'Alcohol Tracker — Trend Summary',
    description:
      'Captures average weekly drink consumption and monthly binge episodes across the platform. ' +
      'Heavy drinking (>14 drinks/week for women, >21 for men) increases T2D risk by 40–50%. ' +
      'Binge drinking causes acute metabolic dysregulation even at otherwise moderate consumption levels. ' +
      'Pattern distribution shows the spread between occasional, weekend, regular, and daily drinkers.',
  },
};

const CHART_DESCRIPTIONS = {
  food: {
    avg_nutrients: 'Average macronutrient values per meal aggregated from all logged meals in the last 30 days.',
    food_type_distribution: 'Breakdown of meal categories logged across the platform — shows dietary diversity.',
    risk_distribution: 'Users categorized by food-related diabetes risk level derived from baseline dietary assessments.',
  },
  steps: {
    activity_level_distribution: 'Distribution of users by their self-reported baseline activity level (sedentary to very active).',
  },
  sleep: {
    source_distribution: 'How sleep data is recorded — manual entry vs. automatic Health Connect sync from wearables.',
  },
  smoking: {
    status_distribution: 'Proportion of users by smoking history: never smoked, former smokers, and active smokers.',
    current_smokers: 'Average daily cigarette count and years smoked among currently active smokers.',
    former_smokers: 'Average years since quitting among users who have stopped smoking.',
  },
  alcohol: {
    drinking_pattern_distribution: 'Distribution of drinking patterns (none, occasional, weekends, regular, daily) among users with alcohol baselines.',
  },
};

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
  const [infoOpen, setInfoOpen] = useState(false);
  const [detailChart, setDetailChart] = useState(null);
  const descriptions = CHART_DESCRIPTIONS[tracker.key] || {};
  const trendInfo = TRACKER_TREND_INFO[tracker.key];

  const statEntries = Object.entries(data).filter(([k]) => typeof data[k] === 'number' || typeof data[k] === 'string');
  const listEntries = Object.entries(data).filter(([k]) => Array.isArray(data[k]));
  const objEntries = Object.entries(data).filter(([k]) => typeof data[k] === 'object' && !Array.isArray(data[k]) && data[k] !== null);

  return (
    <>
      {/* Trend Info Dialog */}
      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{trendInfo?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: 'pre-line' }}>{trendInfo?.description}</DialogContentText>
        </DialogContent>
      </Dialog>

      {/* Trend Summary Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<InfoOutlinedIcon />}
          onClick={() => setInfoOpen(true)}
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          Trend Summary
        </Button>
      </Box>
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

      {/* Chart Detail Dialog */}
      <ChartDetailDialog
        open={!!detailChart}
        onClose={() => setDetailChart(null)}
        chartKey={detailChart?.key}
        chartData={detailChart?.obj}
        description={detailChart ? descriptions[detailChart.key] : ''}
        color={tracker.color}
      />

      {/* Object data as charts */}
      <Grid container spacing={3}>
        {objEntries.map(([key, obj]) => (
          <Grid item xs={12} md={4} key={key}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="h6" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                  {key.replace(/_/g, ' ')}
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<BarChartIcon fontSize="small" />}
                  onClick={() => setDetailChart({ key, obj })}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', ml: 1, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Details
                </Button>
              </Box>
              {descriptions[key] && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  {descriptions[key]}
                </Typography>
              )}
              <Box sx={{ flex: 1 }}>
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
              </Box>
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

// ─── Chart Detail Dialog ──────────────────────────────────────────────────────

const PALETTE = ['#667eea', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6'];

function ChartDetailDialog({ open, onClose, chartKey, chartData, description, color }) {
  if (!chartData) return null;

  const entries = Object.entries(chartData)
    .map(([label, value]) => ({ label, value: Number(value) || 0 }))
    .filter(e => e.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = entries.reduce((s, e) => s + e.value, 0);
  const dominant = entries[0];
  const dominantPct = total > 0 ? ((dominant?.value / total) * 100).toFixed(1) : 0;

  // Build insight sentence
  const insight = dominant
    ? `${dominant.label.replace(/_/g, ' ')} is the leading category at ${dominantPct}% of all records.`
    : 'No data available.';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon sx={{ color }} />
          <Typography variant="h6" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
            {chartKey?.replace(/_/g, ' ')} — Detail Breakdown
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}

        {/* Insight chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Chip
            icon={<TrendingUpIcon />}
            label={insight}
            size="small"
            sx={{ bgcolor: color + '18', color, fontWeight: 600, fontSize: '0.72rem', height: 'auto', py: 0.5 }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Total records: {total.toLocaleString()}
        </Typography>

        <Divider sx={{ my: 1.5 }} />

        {/* Per-category breakdown */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {entries.map(({ label, value }, idx) => {
            const pct = total > 0 ? (value / total) * 100 : 0;
            return (
              <Box key={label}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize', fontWeight: idx === 0 ? 700 : 400 }}>
                    {label.replace(/_/g, ' ')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {value.toLocaleString()} records
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color, minWidth: 44, textAlign: 'right' }}>
                      {pct.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: '#f1f5f9',
                    '& .MuiLinearProgress-bar': { bgcolor: PALETTE[idx % PALETTE.length], borderRadius: 4 },
                  }}
                />
              </Box>
            );
          })}
        </Box>

        {entries.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            No data to display.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
