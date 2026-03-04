import React from 'react';
import { Card, CardContent, Box, Typography } from '@mui/material';

function StatCard({ title, value, icon, color, subtitle, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <Card 
        sx={{ 
          height: '100%',
          background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
          border: `1px solid ${color}30`,
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease',
          '&:hover': onClick ? {
            boxShadow: `0 12px 24px ${color}30`,
            border: `1px solid ${color}60`,
            transform: 'translateY(-8px)',
          } : {},
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, ${color}, ${color}80)`,
          }
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  mb: 1
                }}
              >
                {title}
              </Typography>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700,
                  color: color,
                  mb: subtitle ? 0.5 : 0
                }}
              >
                {value}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            <Box 
              sx={{ 
                color,
                fontSize: 48,
                opacity: 0.9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: 2,
                bgcolor: `${color}15`,
              }}
            >
              {icon}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </div>
  );
}

export default StatCard;
