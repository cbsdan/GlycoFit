import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, IconButton, Typography, Box, Avatar, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../contexts/AuthContext';

function Header({ onMenuClick }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const { logout, userDetails } = useAuth();
  const navigate = useNavigate();

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const getInitials = () => {
    if (userDetails?.first_name && userDetails?.last_name) {
      return `${userDetails.first_name[0]}${userDetails.last_name[0]}`.toUpperCase();
    }
    return 'A';
  };

  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        zIndex: 1200,
        background: 'linear-gradient(90deg, #1a237e 0%, #0d47a1 100%)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
          GlycoFit Admin Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
          <Typography variant="body2" sx={{ mr: 1 }}>
            {userDetails?.first_name} {userDetails?.last_name}
          </Typography>
        </Box>
        <IconButton
          color="inherit"
          onClick={handleMenuOpen}
        >
          {userDetails?.avatar?.url ? (
            <Avatar src={userDetails.avatar.url} sx={{ width: 32, height: 32 }} />
          ) : (
            <Avatar sx={{ bgcolor: '#1976d2', width: 32, height: 32 }}>
              {getInitials()}
            </Avatar>
          )}
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleMenuClose}>
            <AccountCircleIcon sx={{ mr: 1 }} /> Profile
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <LogoutIcon sx={{ mr: 1 }} /> Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
