import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Chip, Avatar, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, TextField, InputAdornment,
  List, ListItem, ListItemText, Divider, Tab, Tabs, Card, CardContent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import adminService from '../services/adminService';
import AdminCreatePhysician from '../components/AdminCreatePhysician';

const physicianName = (p) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.email || 'Unknown';

function PhysicianManagementPage() {
  const [physicians, setPhysicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPhysician, setSelectedPhysician] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [detailData, setDetailData] = useState({ details: null, patients: [], consultations: [], availability: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchPhysicians = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getPhysicians({ search });
      setPhysicians(data.physicians || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchPhysicians(); }, [fetchPhysicians]);

  const openDetail = async (physician) => {
    setSelectedPhysician(physician);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailTab(0);
    try {
      const id = physician._id || physician.uid;
      const [details, patients, consultations, availability] = await Promise.allSettled([
        adminService.getPhysicianDetails(id),
        adminService.getPhysicianPatients(id),
        adminService.getPhysicianConsultations(id),
        adminService.getPhysicianAvailability(id),
      ]);
      setDetailData({
        details: details.status === 'fulfilled' ? details.value : null,
        patients: patients.status === 'fulfilled' ? (patients.value.patients || []) : [],
        consultations: consultations.status === 'fulfilled' ? (consultations.value.consultations || []) : [],
        availability: availability.status === 'fulfilled' ? (availability.value.availability || []) : [],
      });
    } catch (e) { console.error(e); }
    setDetailLoading(false);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Physician Management
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Manage registered physicians, view their patients, consultations, and availability.
        </Typography>
        <Button variant="contained" color="success" onClick={() => setCreateDialogOpen(true)}>
          Create Physician
        </Button>
      </Box>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e0e0e0', mb: 3 }}>
        <TextField
          fullWidth size="small" placeholder="Search physicians by name or email..."
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Physician</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Specialization</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Patients</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {physicians.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">No physicians found</TableCell></TableRow>
              ) : physicians.map((p) => (
                <TableRow key={p._id || p.uid} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        src={p.avatar?.url || undefined}
                        sx={{ bgcolor: '#10b981', width: 36, height: 36 }}
                      >
                        {physicianName(p).charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" fontWeight={500}>
                        {physicianName(p)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{p.email || '—'}</TableCell>
                  <TableCell>{p.specialization || p.specialty || '—'}</TableCell>
                  <TableCell>{p.total_patients ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={p.is_disabled ? 'Disabled' : 'Active'}
                      color={p.is_disabled ? 'error' : 'success'}
                      size="small" variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openDetail(p)} color="primary">
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Physician Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Physician</DialogTitle>
        <DialogContent>
          <AdminCreatePhysician onSuccess={() => { setCreateDialogOpen(false); fetchPhysicians(); }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Physician Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MedicalServicesIcon color="success" />
            <Typography variant="h6" fontWeight={600}>
              {physicianName(selectedPhysician) !== 'Unknown' ? physicianName(selectedPhysician) : 'Physician Details'}
            </Typography>
          </Box>
          <IconButton onClick={() => setDetailOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (
            <>
              <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 2 }}>
                <Tab icon={<MedicalServicesIcon />} label="Profile" iconPosition="start" />
                <Tab icon={<PeopleIcon />} label={`Patients (${detailData.patients.length})`} iconPosition="start" />
                <Tab icon={<EventIcon />} label={`Appointments (${detailData.consultations.length})`} iconPosition="start" />
              </Tabs>

              {detailTab === 0 && detailData.details && (() => {
                const u = detailData.details.user || {};
                const prof = detailData.details.profile || {};
                const stats = detailData.details.stats || {};
                return (
                <Grid container spacing={2}>
                  {[
                    ['Name', [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email],
                    ['Email', u.email],
                    ['Specialization', prof.specialization],
                    ['License Number', prof.license_number],
                    ['Consultation Fee', prof.consultation_fee != null ? `₱${prof.consultation_fee}` : null],
                    ['Experience', prof.years_of_experience != null ? `${prof.years_of_experience} yr(s)` : null],
                    ['Age', u.age],
                    ['Sex', u.sex],
                    ['Total Patients', stats.total_patients ?? '—'],
                    ['Total Consultations', stats.total_consultations ?? '—'],
                    ['Status', u.is_disabled ? 'Disabled' : 'Active'],
                    ['Member Since', u.created_at ? new Date(u.created_at).toLocaleDateString() : null],
                  ].map(([label, value]) => (
                    <Grid item xs={6} key={label}>
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography variant="body2" fontWeight={500}>{value != null && value !== '' ? value : '—'}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                  {prof.bio && (
                    <Grid item xs={12}>
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="caption" color="text.secondary">Bio</Typography>
                          <Typography variant="body2">{prof.bio}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  {prof.languages?.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Languages</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {prof.languages.map((lang, i) => (
                          <Chip key={i} label={lang} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Grid>
                  )}
                  {detailData.availability.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>Availability Slots</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {detailData.availability.map((slot, i) => (
                          <Chip key={i} label={`${slot.day || slot.date || ''} ${slot.start_time || ''}-${slot.end_time || ''}`} size="small" variant="outlined" color="info" />
                        ))}
                      </Box>
                    </Grid>
                  )}
                </Grid>
                );
              })()}

              {detailTab === 1 && (
                <List>
                  {detailData.patients.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No patients linked</Typography>
                  ) : detailData.patients.map((pt, i) => (
                    <React.Fragment key={i}>
                      <ListItem>
                        <ListItemText
                          primary={pt.patient_name || pt.name || pt.displayName || pt.patient_email || 'Unknown'}
                          secondary={pt.patient_email || pt.email || ''}
                        />
                      </ListItem>
                      {i < detailData.patients.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}

              {detailTab === 2 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Patient</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailData.consultations.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center">No consultations</TableCell></TableRow>
                      ) : detailData.consultations.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell>{c.patient_name || '—'}</TableCell>
                          <TableCell>{(c.scheduled_date || c.date) ? new Date(c.scheduled_date || c.date).toLocaleDateString() : '—'}</TableCell>
                          <TableCell>
                            <Chip label={c.status || '—'} size="small" color={c.status === 'completed' ? 'success' : c.status === 'pending' ? 'warning' : c.status === 'approved' ? 'info' : 'default'} variant="outlined" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PhysicianManagementPage;
