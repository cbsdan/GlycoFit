import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, MenuItem,
  Card, CardContent, Avatar, LinearProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import adminService from '../services/adminService';
import { Doughnut, Bar, Line } from 'react-chartjs-2';

function RiskAssessmentsPage() {
  const [loading, setLoading] = useState(true);
  const [riskDist, setRiskDist] = useState(null);
  const [compAvg, setCompAvg] = useState(null);
  const [trend, setTrend] = useState(null);
  const [highRisk, setHighRisk] = useState([]);
  const [assessStats, setAssessStats] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [trendPeriod, setTrendPeriod] = useState('30');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rd, ca, tr, hr, as, al] = await Promise.allSettled([
          adminService.getRiskDistribution(),
          adminService.getRiskComponentAverages(),
          adminService.getRiskTrend({ days: trendPeriod }),
          adminService.getHighRiskPatients({ limit: 10 }),
          adminService.getAssessmentStats(),
          adminService.getAssessmentsList({ limit: 20 }),
        ]);
        if (rd.status === 'fulfilled') setRiskDist(rd.value);
        if (ca.status === 'fulfilled') setCompAvg(ca.value);
        if (tr.status === 'fulfilled') setTrend(tr.value);
        if (hr.status === 'fulfilled') setHighRisk(hr.value.patients || []);
        if (as.status === 'fulfilled') setAssessStats(as.value);
        if (al.status === 'fulfilled') setAssessments(al.value.assessments || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [trendPeriod]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={60} /></Box>;

  const riskColors = { low: '#10b981', moderate: '#f59e0b', high: '#ef4444', very_high: '#991b1b' };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Risk & Assessments
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Analyze diabetes risk distribution, trends, and individual assessments across the platform.
      </Typography>

      {/* Stats Cards */}
      {assessStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Assessments', value: assessStats.total_assessments || 0, color: '#667eea', icon: <AssessmentIcon /> },
            { label: 'Avg Risk Score', value: `${(assessStats.avg_score || 0).toFixed(1)}%`, color: '#f59e0b', icon: <TrendingUpIcon /> },
            { label: 'High Risk Users', value: assessStats.high_risk_count || 0, color: '#ef4444', icon: <WarningAmberIcon /> },
            { label: 'Assessed This Month', value: assessStats.this_month || 0, color: '#10b981', icon: <AssessmentIcon /> },
          ].map((s, i) => (
            <Grid item xs={6} md={3} key={i}>
              <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                  <Avatar sx={{ bgcolor: s.color + '20', color: s.color }}>{s.icon}</Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Risk Distribution Doughnut */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>Risk Distribution</Typography>
            {riskDist ? (
              <Box sx={{ maxWidth: 260, mx: 'auto', mt: 2 }}>
                <Doughnut
                  data={{
                    labels: ['Low', 'Moderate', 'High', 'Very High'],
                    datasets: [{
                      data: [riskDist.low || 0, riskDist.moderate || 0, riskDist.high || 0, riskDist.very_high || 0],
                      backgroundColor: Object.values(riskColors),
                    }],
                  }}
                  options={{ plugins: { legend: { position: 'bottom' } } }}
                />
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
                  {riskDist.total || 0} total assessments
                </Typography>
              </Box>
            ) : <Typography variant="body2" color="text.secondary">No data</Typography>}
          </Paper>
        </Grid>

        {/* Component Averages Bar */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>Component Averages</Typography>
            {compAvg && compAvg.components ? (
              <Bar
                data={{
                  labels: Object.keys(compAvg.components),
                  datasets: [{
                    label: 'Avg Score',
                    data: Object.values(compAvg.components),
                    backgroundColor: '#667eea',
                    borderRadius: 6,
                  }],
                }}
                options={{ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }}
              />
            ) : <Typography variant="body2" color="text.secondary">No data</Typography>}
          </Paper>
        </Grid>

        {/* Risk Trend Over Time */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>Risk Trend</Typography>
              <TextField select size="small" value={trendPeriod} onChange={e => setTrendPeriod(e.target.value)} sx={{ width: 100 }}>
                <MenuItem value="7">7 days</MenuItem>
                <MenuItem value="30">30 days</MenuItem>
                <MenuItem value="90">90 days</MenuItem>
              </TextField>
            </Box>
            {trend && trend.data_points ? (
              <Line
                data={{
                  labels: trend.data_points.map(d => d.date || d.label),
                  datasets: [{
                    label: 'Avg Risk Score',
                    data: trend.data_points.map(d => d.avg_score || d.value),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    fill: true,
                    tension: 0.4,
                  }],
                }}
                options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
              />
            ) : <Typography variant="body2" color="text.secondary">No trend data</Typography>}
          </Paper>
        </Grid>
      </Grid>

      {/* High Risk Patients */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', mt: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          <WarningAmberIcon sx={{ verticalAlign: 'middle', mr: 1, color: '#ef4444' }} />
          High Risk Patients
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#fef2f2' }}>
                <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Risk Score</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Risk Level</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last Assessment</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {highRisk.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No high risk patients found</TableCell></TableRow>
              ) : highRisk.map((p, i) => (
                <TableRow key={i} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 30, height: 30, bgcolor: '#ef4444', fontSize: 13 }}>
                        {(p.name || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      {p.name || p.email || 'Unknown'}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 140 }}>
                      <LinearProgress variant="determinate" value={Math.min(p.risk_score || 0, 100)}
                        sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: '#fee2e2', '& .MuiLinearProgress-bar': { bgcolor: '#ef4444', borderRadius: 4 } }}
                      />
                      <Typography variant="body2" fontWeight={600}>{(p.risk_score || 0).toFixed(0)}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={p.risk_level || 'High'} size="small" sx={{ bgcolor: '#fef2f2', color: '#ef4444', fontWeight: 600 }} />
                  </TableCell>
                  <TableCell>{p.last_assessed ? new Date(p.last_assessed).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Recent Assessments List */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', mt: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>Recent Assessments</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Level</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assessments.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No assessments</TableCell></TableRow>
              ) : assessments.map((a, i) => (
                <TableRow key={i} hover>
                  <TableCell>{a.user_name || a.user || '—'}</TableCell>
                  <TableCell>{a.type || 'Overall'}</TableCell>
                  <TableCell>{(a.score || 0).toFixed(1)}%</TableCell>
                  <TableCell>
                    <Chip label={a.risk_level || '—'} size="small" variant="outlined"
                      color={a.risk_level === 'high' || a.risk_level === 'very_high' ? 'error' : a.risk_level === 'moderate' ? 'warning' : 'success'}
                    />
                  </TableCell>
                  <TableCell>{a.date ? new Date(a.date).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default RiskAssessmentsPage;
