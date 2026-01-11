import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip, Chip, TextField, Button, Stack } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import MealModal from '../MealModal';
import DisableUserDialog from './DisableUserDialog';

function UsersTable({ users, onDisable, onEnable }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [query, setQuery] = useState('');
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [userToDisable, setUserToDisable] = useState(null);

  const handleDisableClick = (user) => {
    setUserToDisable(user);
    setDisableDialogOpen(true);
  };

  const handleDisableConfirm = (reason, days, isPermanent) => {
    if (userToDisable) {
      onDisable(userToDisable.uid, reason, days, isPermanent);
    }
    setDisableDialogOpen(false);
    setUserToDisable(null);
  };

  const handleViewMeals = (user) => {
    setSelectedUser(user);
    setMealModalOpen(true);
  };

  const filteredUsers = useMemo(() => {
    if (!query) return users;
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);
    return users.filter(u => {
      const first = (u.first_name || '').toLowerCase();
      const last = (u.last_name || '').toLowerCase();
      const full = `${first} ${last}`.trim();
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const id = (u.uid || u.id || '').toString().toLowerCase();
      return tokens.every(t => full.includes(t) || first.includes(t) || last.includes(t) || email.includes(t) || role.includes(t) || id.includes(t));
    });
  }, [users, query]);

  const exportToCsv = (rows) => {
    const headers = ['Name','Email','Role','Status'];
    const lines = [headers.join(',')];
    rows.forEach(u => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      const status = u.is_disabled ? 'Disabled' : 'Active';
      const row = [name, u.email || '', u.role || '', status];
      // Escape commas
      lines.push(row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','));
    });
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCloseMealModal = () => {
    setMealModalOpen(false);
    setSelectedUser(null);
  };

  return (
    <>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
      <TextField
        size="small"
        placeholder="Search users by name, email, role..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ width: { xs: '100%', sm: 360 } }}
      />
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => exportToCsv(filteredUsers)}>
          Export (CSV)
        </Button>
        <Button variant="text" size="small" onClick={() => { setQuery(''); }}>
          Clear
        </Button>
      </Stack>
    </Stack>
    <TableContainer 
      component={Paper}
      sx={{
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid #e0e0e0',
      }}
    >
      <Table>
        <TableHead sx={{ bgcolor: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Role</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            filteredUsers.map((user) => (
              <TableRow key={user.uid || user.id}>
                <TableCell>{user.first_name} {user.last_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip label={user.role} size="small" color={user.role === 'admin' ? 'error' : 'primary'} />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={user.is_disabled ? 'Disabled' : 'Active'}
                    size="small"
                    color={user.is_disabled ? 'error' : 'success'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View Meals">
                    <IconButton size="small" color="primary" onClick={() => handleViewMeals(user)}>
                      <RestaurantIcon />
                    </IconButton>
                  </Tooltip>
                  {user.is_disabled ? (
                    <Tooltip title="Enable User">
                      <IconButton size="small" color="success" onClick={() => onEnable(user.uid)}>
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Disable User">
                      <IconButton size="small" color="warning" onClick={() => handleDisableClick(user)}>
                        <BlockIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
      {/* Meal Modal */}
      {selectedUser && (
        <MealModal
          open={mealModalOpen}
          onClose={handleCloseMealModal}
          userId={selectedUser.id || selectedUser._id}
          userName={`${selectedUser.first_name} ${selectedUser.last_name}`}
        />
      )}

      {/* Disable User Dialog */}
      <DisableUserDialog
        open={disableDialogOpen}
        onClose={() => {
          setDisableDialogOpen(false);
          setUserToDisable(null);
        }}
        onConfirm={handleDisableConfirm}
        userName={userToDisable ? `${userToDisable.first_name} ${userToDisable.last_name}` : ''}
      />
    </>
  );
}

export default UsersTable;
