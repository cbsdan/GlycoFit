import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
} from '@mui/material';
import userService from '../services/userService';
import MealModal from './MealModal';

function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dialogType, setDialogType] = useState('disable');
  const [formData, setFormData] = useState({ reason: '', isPermanent: false, endDate: '' });
  const [mealModalOpen, setMealModalOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getAllUsers(0, 50);
      setUsers(data.users || []);
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
          selectedUser._id || selectedUser.id,
          formData.reason,
          formData.endDate || null,
          formData.isPermanent
        );
      } else if (dialogType === 'enable') {
        await userService.enableUser(selectedUser._id || selectedUser.id, formData.reason);
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
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Users Management
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user._id || user.id}>
                <TableCell>{`${user.first_name} ${user.last_name}`}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell sx={{ color: user.is_disabled ? 'red' : 'green' }}>
                  {user.is_disabled ? 'Disabled' : 'Active'}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
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
    </Box>
  );
}

export default UsersManagement;
