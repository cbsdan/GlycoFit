import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
} from '@mui/material';

function DisableUserDialog({ open, onClose, onConfirm, userName }) {
  const [reason, setReason] = useState('');
  const [durationType, setDurationType] = useState('days');
  const [customDays, setCustomDays] = useState('7');
  const [isPermanent, setIsPermanent] = useState(false);

  const handleClose = () => {
    setReason('');
    setDurationType('days');
    setCustomDays('7');
    setIsPermanent(false);
    onClose();
  };

  const handleConfirm = () => {
    if (!reason.trim()) {
      alert('Please provide a reason for disabling the user');
      return;
    }

    let days = 0;
    if (!isPermanent) {
      if (durationType === 'days') {
        days = parseInt(customDays);
      } else if (durationType === '7days') {
        days = 7;
      } else if (durationType === '30days') {
        days = 30;
      } else if (durationType === '90days') {
        days = 90;
      }

      if (isNaN(days) || days <= 0) {
        alert('Please enter a valid number of days');
        return;
      }
    }

    onConfirm(reason.trim(), days, isPermanent);
    handleClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        }
      }}
    >
      <DialogTitle 
        sx={{
          background: 'linear-gradient(135deg, #f59e0b15 0%, #f59e0b05 100%)',
          borderBottom: '2px solid #f59e0b',
          color: '#f59e0b',
          fontWeight: 600,
        }}
      >
        ⚠️ Disable User Account
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You are about to disable the account for: <strong>{userName}</strong>
          </Typography>

          <TextField
            fullWidth
            label="Reason for Disabling"
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter the reason for disabling this user account..."
            required
            sx={{ mb: 3 }}
          />

          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend">Disable Duration</FormLabel>
            <RadioGroup
              value={isPermanent ? 'permanent' : durationType}
              onChange={(e) => {
                if (e.target.value === 'permanent') {
                  setIsPermanent(true);
                } else {
                  setIsPermanent(false);
                  setDurationType(e.target.value);
                }
              }}
            >
              <FormControlLabel value="7days" control={<Radio />} label="7 Days" />
              <FormControlLabel value="30days" control={<Radio />} label="30 Days" />
              <FormControlLabel value="90days" control={<Radio />} label="90 Days" />
              <FormControlLabel 
                value="days" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>Custom:</span>
                    <TextField
                      size="small"
                      type="number"
                      value={customDays}
                      onChange={(e) => {
                        setCustomDays(e.target.value);
                        setDurationType('days');
                        setIsPermanent(false);
                      }}
                      inputProps={{ min: 1 }}
                      sx={{ width: 100 }}
                      disabled={isPermanent}
                    />
                    <span>days</span>
                  </Box>
                }
              />
              <FormControlLabel 
                value="permanent" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography variant="body2" color="error">
                      Permanent (until manually enabled)
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" color="warning">
          Disable User
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DisableUserDialog;
