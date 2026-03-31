import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Typography, Box, CircularProgress, Paper,
  List, ListItem, ListItemText, ListItemIcon,
  Avatar, Divider, Chip, Tabs, Tab,
  IconButton, Tooltip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import StatCard from '../components/common/StatCard';
import UsersStatsModal from '../components/UsersStatsModal';
import ActiveUsersModal from '../components/ActiveUsersModal';
import PhysiciansModal from '../components/PhysiciansModal';
import DisabledUsersModal from '../components/DisabledUsersModal';
import RiskTrendChart from '../components/RiskTrendChart';
import RiskComponentsChart from '../components/RiskComponentsChart';
import { useAuth } from '../contexts/AuthContext';
import adminService from '../services/adminService';
import { Doughnut, Bar } from 'react-chartjs-2';
import '../config/chartSetup';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const RISK_COLORS = {
  low: '#10b981',
  moderate: '#f59e0b',
  high: '#ef4444',
};

const STATUS_DISPLAY = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  in_progress: 'In Progress',
  pending: 'Pending',
  no_show: 'No Show',
};

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return isoStr;
  }
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getCachedToken } = useAuth();
  const [openUsersModal, setOpenUsersModal] = useState(false);
  const [openActiveUsersModal, setOpenActiveUsersModal] = useState(false);
  const [openPhysiciansModal, setOpenPhysiciansModal] = useState(false);
  const [openDisabledUsersModal, setOpenDisabledUsersModal] = useState(false);

  // Dashboard widget state
  const [riskDist, setRiskDist] = useState(null);
  const [trackerAdoption, setTrackerAdoption] = useState(null);
  const [consultSummary, setConsultSummary] = useState(null);
  const [recentActivity, setRecentActivity] = useState(null);
  const [activityTab, setActivityTab] = useState(0);
  const [summaryDialog, setSummaryDialog] = useState({ open: false, chart: null });

  const getAuthHeaders = useCallback(async () => {
    try {
      const token = await getCachedToken();
      if (!token) return { 'Content-Type': 'application/json' };
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
    } catch (err) {
      return { 'Content-Type': 'application/json' };
    }
  }, [getCachedToken]);

  const fetchStats = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/users/stats`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch new dashboard widgets
  useEffect(() => {
    const load = async () => {
      try {
        const [rd, ta, cs, ra] = await Promise.allSettled([
          adminService.getRiskDistribution(),
          adminService.getTrackerAdoption(),
          adminService.getConsultationsSummary(),
          adminService.getRecentActivity(5),
        ]);
        if (rd.status === 'fulfilled') setRiskDist(rd.value);
        if (ta.status === 'fulfilled') setTrackerAdoption(ta.value);
        if (cs.status === 'fulfilled') setConsultSummary(cs.value);
        if (ra.status === 'fulfilled') setRecentActivity(ra.value);
      } catch (e) { console.error('Dashboard widgets error:', e); }
    };
    load();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  // ── Derived chart data ─────────────────────────────────────────────────
  const distMap = riskDist?.distribution || {};
  const riskLabels = ['low', 'moderate', 'high'];
  const riskDisplay = ['Low', 'Moderate', 'High'];
  const riskValues = riskLabels.map((k) => distMap[k] || 0);
  const totalAssessed = riskDist?.total_assessed || 0;
  const unassessed = riskDist?.unassessed || 0;

  const adoptionMap = trackerAdoption?.adoption || {};
  const adoptionLabels = Object.keys(adoptionMap).map((k) => k.charAt(0).toUpperCase() + k.slice(1));
  const adoptionValues = Object.values(adoptionMap);
  const totalUsers = trackerAdoption?.total_users || 0;

  const byStatus = consultSummary?.by_status || {};
  const consultTotal = consultSummary?.total || 0;
  const avgRating = consultSummary?.avg_rating || 0;
  const completedCount = byStatus.completed || 0;
  const scheduledCount = byStatus.scheduled || 0;
  const cancelledCount = byStatus.cancelled || 0;

  const registrations = recentActivity?.recent_registrations || [];
  const consultHistory = recentActivity?.recent_consultations || [];
  const highRiskAlerts = recentActivity?.high_risk_alerts || [];

  const riskColor = (cat) => ({ low: '#10b981', moderate: '#f59e0b', high: '#ef4444' }[cat] || '#9ca3af');

  const handleDownloadPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.setFontSize(22);
      pdf.setTextColor('#764ba2');
      pdf.text('GlycoFit Dashboard Detailed Report', 10, 20);
      
      pdf.setFontSize(12);
      pdf.setTextColor('#333333');
      pdf.text(`Report Generated: ${new Date().toLocaleDateString()}`, 10, 30);
      pdf.text(`Total Users: ${stats?.total_users || 0}   |   Active Users: ${stats?.active_users || 0}   |   Physicians: ${stats?.physicians || 0}`, 10, 38);
      
      let currentY = 50;

      const addChartToPdf = async (elementId, title, summaryText) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        // Check if we need to add a new page (rough estimate)
        if (currentY > pdfHeight - 80) {
          pdf.addPage();
          currentY = 20;
        }

        pdf.setFontSize(14);
        pdf.setTextColor('#333333');
        pdf.text(title, 10, currentY);
        currentY += 8;

        pdf.setFontSize(10);
        pdf.setTextColor('#555555');
        const splitText = pdf.splitTextToSize(summaryText, pdfWidth - 20);
        pdf.text(splitText, 10, currentY);
        currentY += (splitText.length * 5) + 5;

        const canvas = await html2canvas(el, { scale: 1.5, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        
        // Make image 2/3 of the page width and center it
        const usableWidth = pdfWidth - 20;
        const imgWidth = usableWidth * 0.66;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Calculate X offset to center the image
        const imgX = (pdfWidth - imgWidth) / 2;
        
        if (currentY + imgHeight > pdfHeight - 20) {
           pdf.addPage();
           currentY = 20;
        }

        pdf.addImage(imgData, 'PNG', imgX, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 20;
      };

      // 1. Risk Distribution
      let riskDistText = "No risk distribution data available. Users need to complete assessments to populate this section.";
      if (riskDist) {
        riskDistText = `Risk Distribution Analysis: A total of ${totalAssessed} users have successfully completed their diabetes risk assessments, while ${unassessed} users remain unassessed. `;
        const details = riskLabels.map(k => `${distMap[k] || 0} individuals are classified as carrying '${k}' risk`).join(', ');
        riskDistText += `A breakdown of the assessed population reveals that ${details}. `;
        
        if (totalAssessed > 0) {
          const maxVal = Math.max(...riskValues);
          const dominant = riskLabels[riskValues.indexOf(maxVal)];
          const majPct = Math.round((maxVal / totalAssessed) * 100);
          riskDistText += `The majority of the user base (${majPct}%) falls into the ${dominant} risk category. Consistent tracking and targeted interventions should be prioritized for patients in the moderate to high risk brackets to proactively improve overall community health outcomes.`;
        }
      }
      await addChartToPdf('chart-risk-dist', 'Risk Distribution', riskDistText);

      // 2. Risk Score Trend
      await addChartToPdf('chart-risk-trend', 'Risk Score Trend', 'Risk Score Trend Analysis: This chart visualizes the average diabetes risk score of the platform\'s user base over a specified chronological period. Tracking this trend provides immediate insights into how cumulative health risk is evolving across all onboarded patients. A descending, stable trendline points towards a successful population-level response to health regimens, indicating that users are effectively managing their lifestyle choices. Conversely, an upward trajectory calls for a clinical review of current engagement strategies and suggests sending targeted broad-scale health advice or requiring high-risk users to undergo immediate consultation bookings.');

      // 3. Risk Component Averages
      await addChartToPdf('chart-risk-components', 'Average Risk Components', 'Risk Component Averages Analysis: By dissecting the aggregate risk score into individual causative factors—such as BMI, Physical Activity, Fasting Glucose, Blood Pressure, and sleep quality—this breakdown highlights the specific metrics that most strongly drive systemic health risk among the assessed users. Health practitioners can use this granular data to formulate focused public health campaigns or directly calibrate automated app-based health recommendations. Identifying widespread poor metrics early effectively highlights which dietary guidelines, exercise programs, or specialized medical features demand higher visibility within the standard user interface.');

      // 4. Tracker Adoption
      let trackerAdoptionText = "No tracker adoption data is currently available. Users must interact with their daily health logging tools for data to aggregate.";
      if (trackerAdoption && totalUsers > 0) {
        const topAdoptionVal = Math.max(...adoptionValues);
        const topIdx = adoptionValues.indexOf(topAdoptionVal);
        const topAdoptionLabel = adoptionLabels[topIdx];
        const topPct = Math.round((topAdoptionVal / totalUsers) * 100);

        const bottomAdoptionVal = Math.min(...adoptionValues);
        const bottomIdx = adoptionValues.indexOf(bottomAdoptionVal);
        const bottomAdoptionLabel = adoptionLabels[bottomIdx];
        const bottomPct = Math.round((bottomAdoptionVal / totalUsers) * 100);

        trackerAdoptionText = `Tracker Adoption Analysis: Monitoring active feature interaction among the full cohort of ${totalUsers} total users highlights the tools successfully retaining user engagement versus those requiring UI optimization. Currently, a substantial ${topPct}% of the user community is actively utilizing the ${topAdoptionLabel} tracker, establishing it as the highest-performing module with excellent consistent engagement. On the opposite end of the spectrum, the ${bottomAdoptionLabel} tracker demonstrates the lowest uptake, with only ${bottomPct}% utilization. Expanding notifications, improving onboarding awareness, or adjusting the logging complexity for the less adopted trackers may help stabilize platform-wide holistic health logging.`;
      }
      await addChartToPdf('chart-tracker-adoption', 'Tracker Adoption', trackerAdoptionText);

      pdf.save('GlycoFit_Dashboard_Report_Detailed.pdf');
    } catch (error) {
      console.error('Error generating detailed PDF', error);
    }
  };

  return (
    <Box>
      {/* Modals */}
      {openUsersModal && (
        <UsersStatsModal
          open={openUsersModal}
          onClose={() => setOpenUsersModal(false)}
          apiBase={API_BASE_URL}
          getAuthHeaders={getAuthHeaders}
          initialStats={stats || {}}
        />
      )}
      {openActiveUsersModal && (
        <ActiveUsersModal
          open={openActiveUsersModal}
          onClose={() => setOpenActiveUsersModal(false)}
          apiBase={API_BASE_URL}
          getAuthHeaders={getAuthHeaders}
        />
      )}
      {openPhysiciansModal && (
        <PhysiciansModal
          open={openPhysiciansModal}
          onClose={() => setOpenPhysiciansModal(false)}
          apiBase={API_BASE_URL}
          getAuthHeaders={getAuthHeaders}
        />
      )}
      {openDisabledUsersModal && (
        <DisabledUsersModal
          open={openDisabledUsersModal}
          onClose={() => setOpenDisabledUsersModal(false)}
          apiBase={API_BASE_URL}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {/* Chart Summary Dialog */}
      <Dialog open={summaryDialog.open} onClose={() => setSummaryDialog({ open: false, chart: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {summaryDialog.chart === 'riskDist' && '⚠ Risk Distribution — Summary'}
          {summaryDialog.chart === 'trackerAdoption' && '📈 Tracker Adoption — Summary'}
          {summaryDialog.chart === 'consultations' && '📞 Consultations — Summary'}
          {summaryDialog.chart === 'recentActivity' && '🕐 Recent Activity — Summary'}
        </DialogTitle>
        <DialogContent dividers>
          {/* Risk Distribution Summary */}
          {summaryDialog.chart === 'riskDist' && (
            riskDist ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  <strong>{totalAssessed}</strong> users have been assessed for diabetes risk, with <strong>{unassessed}</strong> yet to complete an assessment.
                </Typography>
                {riskLabels.map((k, i) => {
                  const count = distMap[k] || 0;
                  const pct = totalAssessed > 0 ? Math.round((count / totalAssessed) * 100) : 0;
                  return (
                    <Box key={k} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: RISK_COLORS[k], flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>{riskDisplay[i]}</Typography>
                      <Typography variant="body2" fontWeight={600}>{count} users</Typography>
                      <Chip label={`${pct}%`} size="small" sx={{ bgcolor: RISK_COLORS[k] + '22', color: RISK_COLORS[k], fontWeight: 600, fontSize: '0.7rem', height: 20 }} />
                    </Box>
                  );
                })}
                {totalAssessed > 0 && (() => {
                  const maxVal = Math.max(...riskValues);
                  const dominant = riskLabels[riskValues.indexOf(maxVal)];
                  return (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Most users fall in the <strong style={{ textTransform: 'capitalize' }}>{dominant.replace('_', ' ')}</strong> risk category.
                    </Typography>
                  );
                })()}
              </Box>
            ) : <Typography variant="body2" color="text.secondary">Data not loaded yet.</Typography>
          )}

          {/* Tracker Adoption Summary */}
          {summaryDialog.chart === 'trackerAdoption' && (
            trackerAdoption ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  Out of <strong>{totalUsers}</strong> total users, the following shows tracker engagement:
                </Typography>
                {adoptionLabels.map((label, i) => {
                  const count = adoptionValues[i];
                  const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;
                  return (
                    <Box key={label} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{count} users</Typography>
                      <Chip label={`${pct}%`} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                    </Box>
                  );
                })}
                {adoptionValues.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                    Most adopted: <strong>{adoptionLabels[adoptionValues.indexOf(Math.max(...adoptionValues))]}</strong>
                    {' · '}Least adopted: <strong>{adoptionLabels[adoptionValues.indexOf(Math.min(...adoptionValues))]}</strong>
                  </Typography>
                )}
              </Box>
            ) : <Typography variant="body2" color="text.secondary">Data not loaded yet.</Typography>
          )}

          {/* Consultations Summary */}
          {summaryDialog.chart === 'consultations' && (
            consultSummary ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  <strong>{consultTotal}</strong> total consultations recorded across all physicians and patients.
                </Typography>
                {[
                  { label: 'Completed', count: completedCount, color: '#10b981' },
                  { label: 'Scheduled', count: scheduledCount, color: '#3b82f6' },
                  { label: 'Cancelled', count: cancelledCount, color: '#ef4444' },
                ].map(({ label, count, color }) => {
                  const pct = consultTotal > 0 ? Math.round((count / consultTotal) * 100) : 0;
                  return (
                    <Box key={label} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{count}</Typography>
                      <Chip label={`${pct}%`} size="small" sx={{ bgcolor: color + '22', color, fontWeight: 600, fontSize: '0.7rem', height: 20 }} />
                    </Box>
                  );
                })}
                {consultTotal > 0 && (
                  <Typography variant="body2" sx={{ mt: 1.5 }}>
                    Completion rate: <strong>{Math.round((completedCount / consultTotal) * 100)}%</strong>
                  </Typography>
                )}
                {avgRating > 0 && (
                  <Box sx={{ mt: 1, p: 1.5, bgcolor: '#fefce8', borderRadius: 2 }}>
                    <Typography variant="body2">⭐ Average patient rating: <strong>{avgRating}/5</strong> ({consultSummary.rated_count || 0} rated)</Typography>
                  </Box>
                )}
              </Box>
            ) : <Typography variant="body2" color="text.secondary">Data not loaded yet.</Typography>
          )}

          {/* Recent Activity Summary */}
          {summaryDialog.chart === 'recentActivity' && (
            <Box>
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                {[
                  { label: 'New Registrations', count: registrations.length, color: '#667eea', bg: '#f0f4ff' },
                  { label: 'Recent Consults', count: consultHistory.length, color: '#06b6d4', bg: '#e0f7fa' },
                  { label: 'High-Risk Alerts', count: highRiskAlerts.length, color: '#ef4444', bg: '#fff1f2' },
                ].map(({ label, count, color, bg }) => (
                  <Box key={label} sx={{ textAlign: 'center', p: 1.5, bgcolor: bg, borderRadius: 2, flex: 1, minWidth: 90 }}>
                    <Typography variant="h5" fontWeight={700} sx={{ color }}>{count}</Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Box>
                ))}
              </Box>
              {registrations.length > 0 && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Latest registration: <strong>{registrations[0]?.name || registrations[0]?.email || 'Unknown'}</strong> on {formatDate(registrations[0]?.date)}
                </Typography>
              )}
              {highRiskAlerts.length > 0 && (
                <Typography variant="body2" color="error">
                  ⚠ {highRiskAlerts.length} user{highRiskAlerts.length > 1 ? 's' : ''} flagged as high risk — immediate attention recommended.
                </Typography>
              )}
              {registrations.length === 0 && consultHistory.length === 0 && highRiskAlerts.length === 0 && (
                <Typography variant="body2" color="text.secondary">No recent activity to display.</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryDialog({ open: false, chart: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontWeight: 700,
              mb: 0.5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Dashboard Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor and manage your GlycoFit platform
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<DownloadIcon />}
          onClick={handleDownloadPDF}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            fontWeight: 600,
            borderRadius: 2,
            px: 3,
            py: 1
          }}
        >
          Download PDF
        </Button>
      </Box>

      <Box id="dashboard-content">
        {/* ── Row 1: Stat Cards ─────────────────────────────────────────────── */}
        <Grid container spacing={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total Users"
            value={stats?.total_users || 0}
            subtitle="All registered users"
            icon={<PeopleIcon />}
            color="#667eea"
            onClick={() => setOpenUsersModal(true)}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Active Users"
            value={stats?.active_users || 0}
            subtitle="Currently active"
            icon={<VerifiedUserIcon />}
            color="#06b6d4"
            onClick={() => setOpenActiveUsersModal(true)}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Physicians"
            value={stats?.physicians || 0}
            subtitle="Medical professionals"
            icon={<LocalHospitalIcon />}
            color="#10b981"
            onClick={() => setOpenPhysiciansModal(true)}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Disabled Users"
            value={stats?.disabled_users || 0}
            subtitle="Temporarily disabled"
            icon={<PersonOffIcon />}
            color="#f59e0b"
            onClick={() => setOpenDisabledUsersModal(true)}
          />
        </Grid>
      </Grid>

      {/* ── Row 2: Risk Distribution + Tracker Adoption + Risk Component Averages ── */}
      <Grid container spacing={3} sx={{ mt: 2 }}>

        {/* Risk Distribution Doughnut */}
        <Grid item xs={12} md={6} lg={4} id="chart-risk-dist">
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                <WarningAmberIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#f59e0b' }} />
                Risk Distribution
              </Typography>
              <Tooltip title="View Summary">
                <IconButton size="small" onClick={() => setSummaryDialog({ open: true, chart: 'riskDist' })}>
                  <InfoOutlinedIcon fontSize="small" sx={{ color: '#9ca3af' }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Breakdown of all assessed users by risk level (Low, Moderate, High) based on the XGBoost lifestyle ML model.
            </Typography>
            {riskDist ? (
              <>
                <Box sx={{ maxWidth: 240, mx: 'auto', mt: 1 }}>
                  <Doughnut
                    data={{
                      labels: riskDisplay,
                      datasets: [{
                        data: riskValues,
                        backgroundColor: riskLabels.map((k) => RISK_COLORS[k]),
                        borderWidth: 2,
                        borderColor: '#fff',
                      }],
                    }}
                    options={{
                      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
                      maintainAspectRatio: true,
                      cutout: '60%',
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">{totalAssessed} assessed</Typography>
                  {unassessed > 0 && (
                    <Typography variant="caption" color="text.secondary">{unassessed} unassessed</Typography>
                  )}
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
            )}
          </Paper>
        </Grid>

        {/* Risk Score Trend */}
        <Grid item xs={12} md={6} lg={4} id="chart-risk-trend">
          <RiskTrendChart />
        </Grid>

        <Grid item xs={12} md={12} lg={4} id="chart-risk-components">
          <RiskComponentsChart />
        </Grid>

      </Grid>

      {/* ── Row 3: Tracker Adoption + Consultations / Recent Activity ── */}
      <Grid container spacing={3} sx={{ mt: 2, alignItems: "start" }}>
        <Grid item xs={12} md={8} id="chart-tracker-adoption">
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                📈 Tracker Adoption
              </Typography>
              <Tooltip title="View Summary">
                <IconButton size="small" onClick={() => setSummaryDialog({ open: true, chart: 'trackerAdoption' })}>
                  <InfoOutlinedIcon fontSize="small" sx={{ color: '#9ca3af' }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Number of users who have recorded at least one baseline entry for each health tracker (food, sleep, activity, etc.).
            </Typography>
            {trackerAdoption ? (
              <>
                <Bar
                  data={{
                    labels: adoptionLabels,
                    datasets: [{
                      label: 'Users with Baseline',
                      data: adoptionValues,
                      backgroundColor: ['#667eea', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
                      borderRadius: 6,
                    }],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          afterLabel: (ctx) =>
                            totalUsers > 0
                              ? `${Math.round((ctx.parsed.y / totalUsers) * 100)}% of users`
                              : '',
                        },
                      },
                    },
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                  out of {totalUsers} total users
                </Typography>
              </>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
            {/* Consultations Summary */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0', mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  <VideoCallIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#06b6d4' }} />
                  Consultations
                </Typography>
                <Tooltip title="View Summary">
                  <IconButton size="small" onClick={() => setSummaryDialog({ open: true, chart: 'consultations' })}>
                    <InfoOutlinedIcon fontSize="small" sx={{ color: '#9ca3af' }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Summary of all physician–patient consultations by status and average patient rating.
              </Typography>
              {consultSummary ? (
                <Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`${consultTotal} Total`} size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 600 }} />
                    <Chip label={`${completedCount} Completed`} size="small" sx={{ bgcolor: '#d1fae5', color: '#065f46', fontWeight: 600 }} />
                    <Chip label={`${scheduledCount} Scheduled`} size="small" sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 600 }} />
                    {cancelledCount > 0 && (
                      <Chip label={`${cancelledCount} Cancelled`} size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 600 }} />
                    )}
                  </Box>
                  {avgRating > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      ⭐ Avg rating: {avgRating}/5 ({consultSummary.rated_count || 0} rated)
                    </Typography>
                  )}
                </Box>
              ) : <CircularProgress size={24} />}
            </Paper>

            {/* Recent Activity with Tabs */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  🕐 Recent Activity
                </Typography>
                <Tooltip title="View Summary">
                  <IconButton size="small" onClick={() => setSummaryDialog({ open: true, chart: 'recentActivity' })}>
                    <InfoOutlinedIcon fontSize="small" sx={{ color: '#9ca3af' }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Latest platform events: new user registrations, recent consultations, and users flagged as high-risk.
              </Typography>
              <Tabs
                value={activityTab}
                onChange={(_, v) => setActivityTab(v)}
                variant="fullWidth"
                sx={{ mb: 1, '& .MuiTab-root': { fontSize: '0.7rem', minHeight: 36, py: 0 } }}
              >
                <Tab label={`New (${registrations.length})`} />
                <Tab label={`Consults (${consultHistory.length})`} />
                <Tab label={`⚠ High (${highRiskAlerts.length})`} />
              </Tabs>

              {recentActivity === null ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
              ) : (
                <>
                  {/* Tab 0: Registrations */}
                  {activityTab === 0 && (
                    <List dense disablePadding>
                      {registrations.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No recent registrations</Typography>
                      ) : registrations.map((u, i) => (
                        <React.Fragment key={u.id || i}>
                          <ListItem disableGutters sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: '#667eea', fontSize: 12 }}>
                                <PersonAddIcon sx={{ fontSize: 14 }} />
                              </Avatar>
                            </ListItemIcon>
                            <ListItemText
                              primary={u.name || u.email || 'User'}
                              secondary={formatDate(u.date)}
                              primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 500 }}
                              secondaryTypographyProps={{ fontSize: '0.72rem' }}
                            />
                          </ListItem>
                          {i < registrations.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  )}

                  {/* Tab 1: Consultations */}
                  {activityTab === 1 && (
                    <List dense disablePadding>
                      {consultHistory.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No recent consultations</Typography>
                      ) : consultHistory.map((c, i) => (
                        <React.Fragment key={c.id || i}>
                          <ListItem disableGutters sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: '#06b6d4', fontSize: 12 }}>
                                <VideoCallIcon sx={{ fontSize: 14 }} />
                              </Avatar>
                            </ListItemIcon>
                            <ListItemText
                              primary={c.patient_name || 'Patient'}
                              secondary={`${c.physician_name || 'Dr.'} · ${formatDate(c.date)}`}
                              primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 500 }}
                              secondaryTypographyProps={{ fontSize: '0.72rem' }}
                            />
                            <Chip
                              label={STATUS_DISPLAY[c.status] || c.status || '—'}
                              size="small"
                              sx={{ fontSize: '0.65rem', height: 18, ml: 0.5 }}
                            />
                          </ListItem>
                          {i < consultHistory.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  )}

                  {/* Tab 2: High-risk alerts */}
                  {activityTab === 2 && (
                    <List dense disablePadding>
                      {highRiskAlerts.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No high-risk alerts</Typography>
                      ) : highRiskAlerts.map((a, i) => (
                        <React.Fragment key={a.user_id || i}>
                          <ListItem disableGutters sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: riskColor(a.risk_category), fontSize: 12 }}>
                                <ReportProblemIcon sx={{ fontSize: 14 }} />
                              </Avatar>
                            </ListItemIcon>
                            <ListItemText
                              primary={a.user_name || 'User'}
                              secondary={`Score: ${a.risk_score ?? '—'} · ${formatDate(a.date)}`}
                              primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 500 }}
                              secondaryTypographyProps={{ fontSize: '0.72rem' }}
                            />
                            <Chip
                              label={(a.risk_category || '').replace('_', ' ')}
                              size="small"
                              sx={{
                                fontSize: '0.65rem', height: 18, ml: 0.5,
                                bgcolor: riskColor(a.risk_category) + '22',
                                color: riskColor(a.risk_category),
                                fontWeight: 600,
                              }}
                            />
                          </ListItem>
                          {i < highRiskAlerts.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </>
              )}
            </Paper>
        </Grid>
      </Grid>
      </Box>
    </Box>
  );
}

export default Dashboard;