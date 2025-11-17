import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip, Chip } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import MealModal from '../MealModal';
import DisableUserDialog from './DisableUserDialog';

function UsersTable({ users, onDisable, onEnable }) {
  const [selectedUser, setSelectedUser] = useState(null);
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

  const handleCloseMealModal = () => {
    setMealModalOpen(false);
    setSelectedUser(null);
  };

  return (
    <>
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
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
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
