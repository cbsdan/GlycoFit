import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Snackbar } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UsersTable from '../components/users/UsersTable';
import AddUserDialog from '../components/users/AddUserDialog';

const API_BASE_URL = 'http://localhost:4000/api';

function UsersPage() {
  const [openDialog, setOpenDialog] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/users?skip=0&limit=50`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users. Make sure the backend is running on port 4000.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSaveUser = async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }

      const result = await response.json();
      setUsers([...users, result.user]);
      handleCloseDialog();
      setSuccessMessage('User created successfully!');
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err.message || 'Failed to save user. Please try again.');
    }
  };

  const handleDisableUser = async (userId, reason) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (!response.ok) throw new Error('Failed to disable user');
      
      fetchUsers();
      setSuccessMessage('User disabled successfully!');
    } catch (err) {
      setError('Failed to disable user');
    }
  };

  const handleEnableUser = async (userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to enable user');
      
      fetchUsers();
      setSuccessMessage('User enabled successfully!');
    } catch (err) {
      setError('Failed to enable user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to delete user');
        
        fetchUsers();
        setSuccessMessage('User deleted successfully!');
      } catch (err) {
        setError('Failed to delete user');
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Users Management
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddUser}>
          Add User
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <UsersTable 
        users={users} 
        onRefresh={fetchUsers}
        onDisable={handleDisableUser}
        onEnable={handleEnableUser}
        onDelete={handleDeleteUser}
      />
      
      <AddUserDialog open={openDialog} onClose={handleCloseDialog} onSave={handleSaveUser} />
      
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
      />
    </Box>
  );
}

export default UsersPage;
