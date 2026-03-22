import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Card, CardContent,
  Chip, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, Divider, List, ListItem, ListItemText,
  ListItemIcon,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import MemoryIcon from '@mui/icons-material/Memory';
import CloudIcon from '@mui/icons-material/Cloud';
import DescriptionIcon from '@mui/icons-material/Description';
import adminService from '../services/adminService';
import { Bar } from 'react-chartjs-2';

function SystemServicesPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [h, db, cf, lg] = await Promise.allSettled([
          adminService.getSystemHealth(),
          adminService.getDatabaseStats(),
          adminService.getPlatformConfig(),
          adminService.getSystemLogs(30),
        ]);
        if (h.status === 'fulfilled') setHealth(h.value);
        if (db.status === 'fulfilled') setDbStats(db.value);
        if (cf.status === 'fulfilled') setConfig(cf.value);
        if (lg.status === 'fulfilled') setLogs(lg.value.logs || []);
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

        {/* Platform Config */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              <CloudIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Platform Configuration
            </Typography>
            {config ? (
              <List dense>
                {Object.entries(config).filter(([_, v]) => typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number').map(([key, value]) => (
                  <React.Fragment key={key}>
                    <ListItem disableGutters>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <SettingsIcon fontSize="small" color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary={key.replace(/_/g, ' ')}
                        secondary={typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : String(value)}
                        primaryTypographyProps={{ fontSize: '0.85rem', textTransform: 'capitalize', fontWeight: 500 }}
                        secondaryTypographyProps={{ fontSize: '0.8rem' }}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : <Typography variant="body2" color="text.secondary">No config available</Typography>}
          </Paper>
        </Grid>
      </Grid>

      {/* System Logs */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', mt: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          <DescriptionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Recent System Logs
        </Typography>
        {logs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No logs available</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 160 }}>Timestamp</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 80 }}>Level</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log, i) => (
                  <TableRow key={i} hover>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : log.time || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={log.level || 'INFO'} size="small"
                        sx={{
                          fontFamily: 'monospace', fontSize: '0.72rem',
                          bgcolor: log.level === 'ERROR' ? '#fef2f2' : log.level === 'WARNING' ? '#fefce8' : '#f0fdf4',
                          color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARNING' ? '#f59e0b' : '#10b981',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem"
                        sx={{ maxWidth: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.message || log.msg || '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

export default SystemServicesPage;
