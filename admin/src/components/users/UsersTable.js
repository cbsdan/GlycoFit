import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip, Chip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

function UsersTable({ users, onDisable, onEnable, onDelete }) {
  const handleDisable = (userId) => {
    const reason = prompt('Enter reason for disabling user:');
    if (reason) {
      onDisable(userId, reason);
    }
  };

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
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
              <TableRow key={user.id}>
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
                  {user.is_disabled ? (
                    <Tooltip title="Enable User">
                      <IconButton size="small" color="success" onClick={() => onEnable(user.id)}>
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Disable User">
                      <IconButton size="small" color="warning" onClick={() => handleDisable(user.id)}>
                        <BlockIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => onDelete(user.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default UsersTable;
