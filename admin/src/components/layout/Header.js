import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, IconButton, Typography, Box, Avatar, Menu, MenuItem, InputBase, Badge } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
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
        background: 'linear-gradient(90deg, rgba(19,64,120,0.95) 0%, rgba(13,71,161,0.95) 100%)',
        boxShadow: '0 6px 30px rgba(2,6,23,0.12)',
      }}
    >
      <Toolbar>
        <IconButton color="inherit" onClick={onMenuClick} sx={{ mr: 2 }}>
          <MenuIcon />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: '700' }}>
            GlycoFit Admin
          </Typography>

          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.08)', px: 2, py: 0.4, borderRadius: 2, width: '60%', maxWidth: 520 }}>
              <SearchIcon sx={{ color: 'rgba(255,255,255,0.8)', mr: 1 }} />
              <InputBase placeholder="Search users, meals, physicians..." sx={{ color: '#fff', width: '100%' }} />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton color="inherit">
              <Badge variant="dot" color="error">
                <NotificationsNoneIcon />
              </Badge>
            </IconButton>
            <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
              {userDetails?.first_name} {userDetails?.last_name}
            </Typography>
          </Box>
        </Box>

        <IconButton color="inherit" onClick={handleMenuOpen}>
          {userDetails?.avatar?.url ? (
            <Avatar src={userDetails.avatar.url} sx={{ width: 32, height: 32 }} />
          ) : (
            <Avatar sx={{ bgcolor: '#1976d2', width: 32, height: 32 }}>{getInitials()}</Avatar>
          )}
        </IconButton>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
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
