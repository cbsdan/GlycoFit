import React, { useState } from 'react';
import {
  Button,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import apiClient from '../config/api';

function AdminCreatePhysician({ onSuccess }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'physician',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    // Validation
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await apiClient.post('/admin/users/create', form);
      setSuccessMsg(`Physician account created successfully! Email: ${form.email}`);
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role: 'physician',
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to create physician'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <TextField
        label="First Name"
        name="first_name"
        value={form.first_name}
        onChange={handleChange}
        fullWidth
        required
        sx={{ mb: 2 }}
      />
      <TextField
        label="Last Name"
        name="last_name"
        value={form.last_name}
        onChange={handleChange}
        fullWidth
        required
        sx={{ mb: 2 }}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        fullWidth
        required
        sx={{ mb: 2 }}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        value={form.password}
        onChange={handleChange}
        fullWidth
        required
        helperText="Minimum 6 characters"
        sx={{ mb: 2 }}
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        disabled={loading}
        sx={{ height: 48 }}
      >
        {loading ? <CircularProgress size={24} /> : 'Create Physician Account'}
      </Button>
    </form>
  );
}

export default AdminCreatePhysician;
