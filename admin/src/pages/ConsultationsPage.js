import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Card, CardContent, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  IconButton, Pagination, TextField, MenuItem,
} from '@mui/material';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import EventIcon from '@mui/icons-material/Event';
import MedicationIcon from '@mui/icons-material/Medication';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import adminService from '../services/adminService';

function ConsultationsPage() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const perPage = 15;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sm] = await Promise.allSettled([adminService.getConsultationsSummary()]);
        if (sm.status === 'fulfilled') setSummary(sm.value);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const fetchTab = async () => {
      try {
        const params = { page, limit: perPage };
        if (status) params.status = status;
        if (tab === 0) {
          const data = await adminService.getConsultationsList(params);
          setConsultations(data.consultations || []);
          setTotal(data.total || 0);
        } else if (tab === 1) {
          const data = await adminService.getAppointments(params);
          setAppointments(data.appointments || []);
          setTotal(data.total || 0);
        } else {
          const data = await adminService.getPrescriptions(params);
          setPrescriptions(data.prescriptions || []);
          setTotal(data.total || 0);
        }
      } catch (e) { console.error(e); }
    };
    fetchTab();
  }, [tab, page, status]);

  const openDetail = async (id) => {
    try {
      const data = await adminService.getConsultationDetail(id);
      setDetail(data);
      setDetailOpen(true);
    } catch (e) { console.error(e); }
  };

  const statusColor = (s) => {
    if (!s) return 'default';
    const sl = s.toLowerCase();
    if (sl === 'completed' || sl === 'done') return 'success';
    if (sl === 'pending' || sl === 'scheduled') return 'warning';
    if (sl === 'cancelled' || sl === 'rejected') return 'error';
    return 'info';
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={60} /></Box>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        <VideoCallIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 36, color: '#06b6d4' }} />
        Consultations & Telehealth
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage consultations, appointments, and prescriptions.
      </Typography>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Consultations', val: summary.total || 0, color: '#06b6d4', icon: <VideoCallIcon /> },
            { label: 'Pending', val: summary.pending || 0, color: '#f59e0b', icon: <EventIcon /> },
            { label: 'Completed', val: summary.completed || 0, color: '#10b981', icon: <VideoCallIcon /> },
            { label: 'Prescriptions', val: summary.prescriptions || 0, color: '#7c3aed', icon: <MedicationIcon /> },
          ].map((s, i) => (
            <Grid item xs={6} md={3} key={i}>
              <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                  <Avatar sx={{ bgcolor: s.color + '20', color: s.color }}>{s.icon}</Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{s.val}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tabs + Filter */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e0e0', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }}
            sx={{ '& .MuiTab-root': { textTransform: 'none' } }}>
            <Tab icon={<VideoCallIcon />} label="Consultations" iconPosition="start" />
            <Tab icon={<EventIcon />} label="Appointments" iconPosition="start" />
            <Tab icon={<MedicationIcon />} label="Prescriptions" iconPosition="start" />
          </Tabs>
          <TextField select size="small" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            sx={{ width: 140 }} label="Status">
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </TextField>
        </Box>
      </Paper>

      {/* Content Tables */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
        {tab === 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Patient</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Physician</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">View</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {consultations.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center">No consultations</TableCell></TableRow>
                ) : consultations.map((c, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{c.patient_name || c.patient || '—'}</TableCell>
                    <TableCell>{c.physician_name || c.physician || '—'}</TableCell>
                    <TableCell>{c.date ? new Date(c.date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell><Chip label={c.status || '—'} size="small" color={statusColor(c.status)} variant="outlined" /></TableCell>
                    <TableCell>{c.type || c.consultation_type || '—'}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => openDetail(c._id || c.id)} color="primary">
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 1 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Patient</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Physician</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Date & Time</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {appointments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center">No appointments</TableCell></TableRow>
                ) : appointments.map((a, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{a.patient_name || a.patient || '—'}</TableCell>
                    <TableCell>{a.physician_name || a.physician || '—'}</TableCell>
                    <TableCell>{a.date ? new Date(a.date).toLocaleString() : '—'}</TableCell>
                    <TableCell><Chip label={a.status || '—'} size="small" color={statusColor(a.status)} variant="outlined" /></TableCell>
                    <TableCell>{a.type || a.appointment_type || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 2 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Patient</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Physician</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Medication</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Dosage</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prescriptions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center">No prescriptions</TableCell></TableRow>
                ) : prescriptions.map((p, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{p.patient_name || p.patient || '—'}</TableCell>
                    <TableCell>{p.physician_name || p.physician || '—'}</TableCell>
                    <TableCell>{p.medication || p.drug_name || '—'}</TableCell>
                    <TableCell>{p.dosage || '—'}</TableCell>
                    <TableCell>{p.date ? new Date(p.date).toLocaleDateString() : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {total > perPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination count={Math.ceil(total / perPage)} page={page} onChange={(_, v) => setPage(v)} color="primary" />
          </Box>
        )}
      </Paper>

      {/* Consultation Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Consultation Detail
          <IconButton onClick={() => setDetailOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {detail ? (
            <Grid container spacing={2}>
              {[
                ['Patient', detail.patient_name || detail.patient],
                ['Physician', detail.physician_name || detail.physician],
                ['Date', detail.date ? new Date(detail.date).toLocaleString() : '—'],
                ['Status', detail.status],
                ['Type', detail.type || detail.consultation_type],
                ['Notes', detail.notes || detail.soap_notes || '—'],
                ['Diagnosis', detail.diagnosis || '—'],
                ['Follow-up', detail.follow_up || '—'],
              ].map(([k, v]) => (
                <Grid item xs={6} key={k}>
                  <Typography variant="caption" color="text.secondary">{k}</Typography>
                  <Typography variant="body2" fontWeight={500}>{v || '—'}</Typography>
                </Grid>
              ))}
            </Grid>
          ) : <CircularProgress />}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default ConsultationsPage;
