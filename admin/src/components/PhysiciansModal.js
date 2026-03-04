import React, { useEffect, useState, useMemo, forwardRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  TextField,
  Stack,
  Chip,
  Avatar,
  IconButton,
  Slide,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function PhysiciansModal({ open, onClose, apiBase, getAuthHeaders }) {
  const [loading, setLoading] = useState(false);
  const [physicians, setPhysicians] = useState([]);
  const [query, setQuery] = useState('');

  const fetchPhysicians = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
      const res = await fetch(`${apiBase}/admin/users?limit=200`, { headers, method: 'GET' });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      const list = (data.users || []).filter(u => (u.role || '').toLowerCase() === 'physician');
      setPhysicians(list);
    } catch (err) {
      setPhysicians([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) fetchPhysicians();
  }, [open]);

  const filteredPhysicians = useMemo(() => {
    if (!query) return physicians;
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);
    return physicians.filter(u => {
      const first = (u.first_name || '').toLowerCase();
      const last = (u.last_name || '').toLowerCase();
      const full = `${first} ${last}`.trim();
      const email = (u.email || '').toLowerCase();
      const id = (u.id || u.uid || '').toString().toLowerCase();
      return tokens.every(t => full.includes(t) || first.includes(t) || last.includes(t) || email.includes(t) || id.includes(t));
    });
  }, [physicians, query]);

  const exportToCsv = (rows) => {
    const headers = ['Name','Email','Status'];
    const lines = [headers.join(',')];
    rows.forEach(u => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u.email || '');
      const status = u.is_disabled ? 'Disabled' : 'Active';
      const row = [name, u.email || '', status];
      lines.push(row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','));
    });
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'physicians.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const initials = (first, last) => {
    const f = (first || '').trim()[0] || '';
    const l = (last || '').trim()[0] || '';
    return (f + l).toUpperCase() || 'P';
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" TransitionComponent={Transition} keepMounted>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LocalHospitalIcon color="success" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Physicians</Typography>
          <Chip label={`${physicians.length} total`} size="small" color="success" sx={{ ml: 1 }} />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                All registered physicians
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search name, email, id..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                  sx={{ width: { xs: '100%', sm: 320 } }}
                />
                <IconButton aria-label="Export CSV" onClick={() => exportToCsv(filteredPhysicians)}>
                  <DownloadIcon />
                </IconButton>
              </Stack>
            </Stack>

            <TableContainer 
              component={Paper} 
              sx={{ maxHeight: 440, borderRadius: 3, boxShadow: '0 6px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Physician</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPhysicians.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">No physicians found</TableCell>
                    </TableRow>
                  ) : (
                    filteredPhysicians.map((u) => (
                      <TableRow key={u.id || u.uid} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar 
                              src={u.avatar?.url} 
                              sx={{ bgcolor: 'success.main' }}
                            >
                              {initials(u.first_name, u.last_name)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ID: {u.id || u.uid}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Chip label={u.is_disabled ? 'Disabled' : 'Active'} size="small" color={u.is_disabled ? 'error' : 'success'} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
