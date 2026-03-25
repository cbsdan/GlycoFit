import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import userService from '../services/userService';
import MealModal from './MealModal';
import UserViewModal from './UserViewModal';

function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dialogType, setDialogType] = useState('disable');
  const [formData, setFormData] = useState({ reason: '', isPermanent: false, endDate: '' });
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const diagnosisLabel = (status) => {
    switch (status) {
      case 'type2_diabetes': return 'Type 2 Diabetes';
      case 'prediabetes': return 'Pre-diabetes';
      default: return 'Not Diagnosed';
    }
  };

  const diagnosisColor = (status) => {
    switch (status) {
      case 'type2_diabetes': return 'error';
      case 'prediabetes': return 'warning';
      default: return 'success';
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredUsers = useMemo(() => {
    let list = users;
    if (query) {
      const q = query.toLowerCase().trim();
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter(u => {
        const first = (u.first_name || '').toLowerCase();
        const last = (u.last_name || '').toLowerCase();
        const full = `${first} ${last}`.trim();
        const email = (u.email || '').toLowerCase();
        const role = (u.role || '').toLowerCase();
        const id = (u._id || u.id || '').toString().toLowerCase();
        return tokens.every(t => full.includes(t) || first.includes(t) || last.includes(t) || email.includes(t) || role.includes(t) || id.includes(t));
      });
    }

    const diagnosisOrder = { type2_diabetes: 2, prediabetes: 1, not_diagnosed: 0 };
    const dir = sortDirection === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
          break;
        case 'email':
          cmp = (a.email || '').localeCompare(b.email || '');
          break;
        case 'role':
          cmp = (a.role || '').localeCompare(b.role || '');
          break;
        case 'diagnosis':
          cmp = (diagnosisOrder[a.diagnosis_status] || 0) - (diagnosisOrder[b.diagnosis_status] || 0);
          break;
        case 'status':
          cmp = (a.is_disabled === b.is_disabled) ? 0 : a.is_disabled ? 1 : -1;
          break;
        default:
          break;
      }
      return cmp * dir;
    });

    return list;
  }, [users, query, sortField, sortDirection]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getAllUsers(0, 0);
      setUsers((data.users || []).filter(u => (u.role || '').toLowerCase() !== 'physician'));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user, type) => {
    setSelectedUser(user);
    setDialogType(type);
    setFormData({ reason: '', isPermanent: false, endDate: '' });
    setOpenDialog(true);
  };

  const handleOpenMealModal = (user) => {
    setSelectedUser(user);
    setMealModalOpen(true);
  };

  const handleOpenViewModal = (user) => {
    setViewUser(user);
    setViewModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setViewUser(null);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
  };

  const handleCloseMealModal = () => {
    setMealModalOpen(false);
    setSelectedUser(null);
  };

  const handleSubmit = async () => {
    try {
      if (dialogType === 'disable') {
        await userService.disableUser(
          selectedUser.uid,
          formData.reason,
          formData.endDate || null,
          formData.isPermanent
        );
      } else if (dialogType === 'enable') {
        await userService.enableUser(selectedUser.uid, formData.reason);
      }
      fetchUsers();
      handleCloseDialog();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ width: { xs: 160, sm: 280 } }}
          />
        </Box>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              {[
                { id: 'name', label: 'Name' },
                { id: 'email', label: 'Email' },
                { id: 'role', label: 'Role' },
                { id: 'diagnosis', label: 'Diagnosis' },
                { id: 'status', label: 'Status' },
              ].map((col) => (
                <TableCell key={col.id} sortDirection={sortField === col.id ? sortDirection : false}>
                  <TableSortLabel
                    active={sortField === col.id}
                    direction={sortField === col.id ? sortDirection : 'asc'}
                    onClick={() => handleSort(col.id)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user._id || user.id}>
                <TableCell>{`${user.first_name} ${user.last_name}`}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  <Chip
                    label={diagnosisLabel(user.diagnosis_status)}
                    color={diagnosisColor(user.diagnosis_status)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell sx={{ color: user.is_disabled ? 'red' : 'green' }}>
                  {user.is_disabled ? 'Disabled' : 'Active'}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      onClick={() => handleOpenViewModal(user)}
                    >
                      View
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="info"
                      onClick={() => handleOpenMealModal(user)}
                    >
                      Meals
                    </Button>
                    {user.is_disabled ? (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => handleOpenDialog(user, 'enable')}
                      >
                        Enable
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        onClick={() => handleOpenDialog(user, 'disable')}
                      >
                        Disable
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Disable/Enable Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogType === 'disable' ? 'Disable User' : 'Enable User'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Reason"
            multiline
            rows={3}
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            sx={{ mb: 2 }}
          />
          {dialogType === 'disable' && (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isPermanent}
                    onChange={(e) => setFormData({ ...formData, isPermanent: e.target.checked })}
                  />
                }
                label="Permanent Disable"
                sx={{ mb: 2 }}
              />
              {!formData.isPermanent && (
                <TextField
                  fullWidth
                  label="End Date"
                  type="datetime-local"
                  InputLabelProps={{ shrink: true }}
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Meal Modal */}
      {selectedUser && (
        <MealModal
          open={mealModalOpen}
          onClose={handleCloseMealModal}
          userId={selectedUser.id || selectedUser._id}
          userName={`${selectedUser.first_name} ${selectedUser.last_name}`}
        />
      )}

      {/* User View Modal */}
      <UserViewModal
        open={viewModalOpen}
        onClose={handleCloseViewModal}
        user={viewUser}
      />


    </Box>
  );
}

export default UsersManagement;
