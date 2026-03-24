import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Card, CardContent,
  Chip, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, Divider, List, ListItem, ListItemText,
  ListItemIcon, Tooltip,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import MemoryIcon from '@mui/icons-material/Memory';
import CloudIcon from '@mui/icons-material/Cloud';
import DescriptionIcon from '@mui/icons-material/Description';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import KeyIcon from '@mui/icons-material/Key';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import adminService from '../services/adminService';
import { Bar } from 'react-chartjs-2';

function SystemServicesPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [geminiStatus, setGeminiStatus] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [h, db, cf, lg, gs] = await Promise.allSettled([
          adminService.getSystemHealth(),
          adminService.getDatabaseStats(),
          adminService.getPlatformConfig(),
          adminService.getSystemLogs(30),
          adminService.getGeminiStatus(),
        ]);
        if (h.status === 'fulfilled') setHealth(h.value);
        if (db.status === 'fulfilled') setDbStats(db.value);
        if (cf.status === 'fulfilled') setConfig(cf.value);
        if (lg.status === 'fulfilled') setLogs(lg.value.logs || []);
        if (gs.status === 'fulfilled') setGeminiStatus(gs.value);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={60} /></Box>;

  const serviceStatus = (ok) => ok ? (
    <Chip icon={<CheckCircleIcon />} label="Healthy" color="success" size="small" variant="outlined" />
  ) : (
    <Chip icon={<ErrorIcon />} label="Down" color="error" size="small" variant="outlined" />
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 36, color: '#64748b' }} />
        System & Services
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Monitor system health, database statistics, and platform configuration.
      </Typography>

      {/* System Health */}
      {health && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', mb: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            <MemoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            System Health
          </Typography>
          <Alert severity={health.status === 'healthy' ? 'success' : 'warning'} sx={{ mb: 2, borderRadius: 2 }}>
            Overall Status: <strong>{health.status || 'Unknown'}</strong>
            {health.uptime && ` — Uptime: ${health.uptime}`}
          </Alert>
          <Grid container spacing={2}>
            {health.services && Object.entries(health.services).map(([name, ok]) => (
              <Grid item xs={6} sm={4} md={3} key={name}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'capitalize' }}>
                      {name.replace(/_/g, ' ')}
                    </Typography>
                    {serviceStatus(ok)}
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {health.memory_usage !== undefined && (
              <Grid item xs={12} sm={6}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Memory Usage</Typography>
                    <LinearProgress variant="determinate" value={Math.min(health.memory_usage || 0, 100)}
                      sx={{ height: 10, borderRadius: 5, '& .MuiLinearProgress-bar': { borderRadius: 5 } }} />
                    <Typography variant="caption" color="text.secondary">{(health.memory_usage || 0).toFixed(1)}%</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {health.cpu_usage !== undefined && (
              <Grid item xs={12} sm={6}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>CPU Usage</Typography>
                    <LinearProgress variant="determinate" value={Math.min(health.cpu_usage || 0, 100)}
                      sx={{ height: 10, borderRadius: 5, '& .MuiLinearProgress-bar': { borderRadius: 5 } }} />
                    <Typography variant="caption" color="text.secondary">{(health.cpu_usage || 0).toFixed(1)}%</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Gemini AI Usage */}
      {geminiStatus && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              <AutoAwesomeIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#667eea' }} />
              Gemini AI Usage
            </Typography>
            <Chip
              icon={geminiStatus.gemini_ready ? <CheckCircleIcon /> : <ErrorIcon />}
              label={geminiStatus.gemini_ready ? 'Ready' : 'Unavailable'}
              color={geminiStatus.gemini_ready ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          </Box>

          {/* Date & Cap Summary */}
          {geminiStatus.usage && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
              <Chip label={`Date: ${geminiStatus.usage.date}`} size="small" variant="outlined" />
              <Chip label={`Daily cap: ${geminiStatus.usage.daily_cap} requests / model`} size="small" variant="outlined" color="primary" />
              <Chip
                icon={<ImageIcon sx={{ fontSize: 14 }} />}
                label={`Image chain: ${(geminiStatus.usage.image_model_chain || []).join(' → ')}`}
                size="small"
                sx={{ bgcolor: '#f0f4ff', borderColor: '#667eea', color: '#3730a3' }}
                variant="outlined"
              />
              <Chip
                icon={<TextFieldsIcon sx={{ fontSize: 14 }} />}
                label={`Text chain: ${(geminiStatus.usage.text_model_chain || []).join(' → ')}`}
                size="small"
                sx={{ bgcolor: '#f0fdf4', borderColor: '#22c55e', color: '#166534' }}
                variant="outlined"
              />
            </Box>
          )}

          {/* Per API Key / Model Usage */}
          {geminiStatus.usage && geminiStatus.usage.api_keys_configured && (
            <Grid container spacing={2}>
              {geminiStatus.usage.api_keys_configured.map((keyName) => {
                const keyUsage = (geminiStatus.usage.usage || {})[keyName] || {};
                // Combine all models from both chains
                const allModels = [
                  ...(geminiStatus.usage.image_model_chain || []),
                  ...(geminiStatus.usage.text_model_chain || []),
                ];
                return (
                  <Grid item xs={12} md={6} key={keyName}>
                    <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: '#fafafa' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                          <KeyIcon fontSize="small" sx={{ color: '#64748b' }} />
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#334155' }}>
                            {keyName}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {allModels.map((modelName) => {
                            const count = keyUsage[modelName] || 0;
                            const cap = geminiStatus.usage.daily_cap || 20;
                            const pct = Math.min((count / cap) * 100, 100);
                            const isImage = (geminiStatus.usage.image_model_chain || []).includes(modelName);
                            const barColor = pct >= 100 ? '#ef4444' : pct >= 75 ? '#f97316' : '#667eea';
                            return (
                              <Box key={modelName}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {isImage
                                      ? <ImageIcon sx={{ fontSize: 13, color: '#667eea' }} />
                                      : <TextFieldsIcon sx={{ fontSize: 13, color: '#22c55e' }} />}
                                    <Typography variant="caption" fontWeight={500} sx={{ color: '#475569' }}>
                                      {modelName}
                                    </Typography>
                                  </Box>
                                  <Typography variant="caption" fontWeight={600}
                                    sx={{ color: pct >= 100 ? '#ef4444' : pct >= 75 ? '#f97316' : '#334155' }}>
                                    {count} / {cap}
                                  </Typography>
                                </Box>
                                <Tooltip title={`${count} of ${cap} requests used today`} placement="top">
                                  <LinearProgress
                                    variant="determinate"
                                    value={pct}
                                    sx={{
                                      height: 8,
                                      borderRadius: 4,
                                      bgcolor: '#e2e8f0',
                                      '& .MuiLinearProgress-bar': {
                                        borderRadius: 4,
                                        bgcolor: barColor,
                                      },
                                    }}
                                  />
                                </Tooltip>
                              </Box>
                            );
                          })}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}

          {(!geminiStatus.usage || !geminiStatus.usage.api_keys_configured?.length) && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>No Gemini API keys configured.</Alert>
          )}
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Database Stats */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Database Statistics
            </Typography>
            {dbStats && dbStats.collections ? (
              <>
                <Box sx={{ mb: 2 }}>
                  <Bar
                    data={{
                      labels: Object.keys(dbStats.collections).slice(0, 12),
                      datasets: [{
                        label: 'Documents',
                        data: Object.values(dbStats.collections).slice(0, 12),
                        backgroundColor: '#667eea',
                        borderRadius: 4,
                      }],
                    }}
                    options={{ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }}
                  />
                </Box>
                {dbStats.total_size && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Total DB Size: <strong>{dbStats.total_size}</strong>
                  </Typography>
                )}
              </>
            ) : <Typography variant="body2" color="text.secondary">No database stats available</Typography>}
          </Paper>
        </Grid>

      </Grid>
    </Box>
  );
}

export default SystemServicesPage;
