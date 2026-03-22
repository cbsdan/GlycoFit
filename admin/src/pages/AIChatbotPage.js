import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Card, CardContent, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Pagination,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import adminService from '../services/adminService';
import { Bar, Doughnut } from 'react-chartjs-2';

function AIChatbotPage() {
  const [loading, setLoading] = useState(true);
  const [chatbotStats, setChatbotStats] = useState(null);
  const [foodStats, setFoodStats] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [cs, fs] = await Promise.allSettled([
          adminService.getChatbotStats(),
          adminService.getAiFoodAnalysisStats(),
        ]);
        if (cs.status === 'fulfilled') setChatbotStats(cs.value);
        if (fs.status === 'fulfilled') setFoodStats(fs.value);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const fetchConvs = async () => {
      try {
        const data = await adminService.getChatbotConversations({ page, limit: perPage });
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
      } catch (e) { console.error(e); }
    };
    fetchConvs();
  }, [page]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={60} /></Box>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        <SmartToyIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 36, color: '#8b5cf6' }} />
        AI & Chatbot
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Monitor AI chatbot usage and food analysis powered by Gemini & Groq.
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {chatbotStats && [
          { label: 'Total Chatbot Conversations', val: chatbotStats.total_conversations || 0, color: '#8b5cf6', icon: <SmartToyIcon /> },
          { label: 'Total Bot Messages', val: chatbotStats.total_messages || 0, color: '#667eea', icon: <QuestionAnswerIcon /> },
          { label: 'Active Users (Chatbot)', val: chatbotStats.unique_users || 0, color: '#10b981', icon: <SmartToyIcon /> },
          { label: 'Avg Messages/Session', val: (chatbotStats.avg_messages_per_session || 0).toFixed(1), color: '#06b6d4', icon: <QuestionAnswerIcon /> },
        ].map((s, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                <Avatar sx={{ bgcolor: s.color + '20', color: s.color }}>{s.icon}</Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  <Typography variant="h5" fontWeight={700}>{s.val}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Food Analysis Stats */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              <RestaurantIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#10b981' }} />
              AI Food Analysis
            </Typography>
            {foodStats ? (
              <>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {[
                    { label: 'Total Analyses', val: foodStats.total_analyses || 0 },
                    { label: 'This Week', val: foodStats.this_week || 0 },
                    { label: 'Unique Users', val: foodStats.unique_users || 0 },
                    { label: 'Avg Confidence', val: `${((foodStats.avg_confidence || 0) * 100).toFixed(0)}%` },
                  ].map((s, i) => (
                    <Grid item xs={6} key={i}>
                      <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                      <Typography variant="h6" fontWeight={700}>{s.val}</Typography>
                    </Grid>
                  ))}
                </Grid>
                {foodStats.top_foods && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Top Analyzed Foods</Typography>
                    <Bar
                      data={{
                        labels: foodStats.top_foods.map(f => f.name || f.food_name),
                        datasets: [{
                          label: 'Analyses',
                          data: foodStats.top_foods.map(f => f.count),
                          backgroundColor: '#10b981',
                          borderRadius: 6,
                        }],
                      }}
                      options={{ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }}
                    />
                  </Box>
                )}
              </>
            ) : <Typography variant="body2" color="text.secondary">No data</Typography>}
          </Paper>
        </Grid>

        {/* Chatbot Topic Distribution (if available) */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>Chatbot Usage Overview</Typography>
            {chatbotStats && chatbotStats.topic_distribution ? (
              <Box sx={{ maxWidth: 280, mx: 'auto' }}>
                <Doughnut
                  data={{
                    labels: Object.keys(chatbotStats.topic_distribution),
                    datasets: [{
                      data: Object.values(chatbotStats.topic_distribution),
                      backgroundColor: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
                    }],
                  }}
                  options={{ plugins: { legend: { position: 'bottom' } } }}
                />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <SmartToyIcon sx={{ fontSize: 64, color: '#e0e0e0', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  {chatbotStats?.total_conversations || 0} total chatbot conversations
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {chatbotStats?.total_messages || 0} total messages exchanged
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Chatbot Conversations Table */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>Recent Chatbot Conversations</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Messages</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last Active</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Preview</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {conversations.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No chatbot conversations</TableCell></TableRow>
              ) : conversations.map((c, i) => (
                <TableRow key={i} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#8b5cf6', fontSize: 12 }}>
                        {(c.user_name || c.user || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      {c.user_name || c.user || 'Unknown'}
                    </Box>
                  </TableCell>
                  <TableCell>{c.message_count || c.messages || 0}</TableCell>
                  <TableCell>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.last_message || c.preview || '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {total > perPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination count={Math.ceil(total / perPage)} page={page} onChange={(_, v) => setPage(v)} color="primary" />
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default AIChatbotPage;
