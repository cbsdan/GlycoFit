import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Divider,
  Chip,
  Grid,
  Avatar,
  Tab,
  Tabs,
  Alert,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import SmokingRoomsIcon from '@mui/icons-material/SmokingRooms';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import adminService from '../services/adminService';

/* ─── tiny helpers ─────────────────────────────────────────────────── */

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid #f0f0f0' }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, minWidth: 160 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ textAlign: 'right', wordBreak: 'break-all' }}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

function SectionHeader({ icon, title, color = '#667eea' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, mt: 1 }}>
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ color }}>
        {title}
      </Typography>
    </Box>
  );
}

function TrackerCard({ title, icon, color, children, hasBadge, badgeLabel }) {
  return (
    <Box
      sx={{
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        p: 2,
        mb: 2,
        background: '#fafafa',
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        {hasBadge !== undefined && (
          <Chip
            size="small"
            label={hasBadge ? (badgeLabel || 'Baseline Set') : 'No Baseline'}
            color={hasBadge ? 'success' : 'default'}
            sx={{ ml: 'auto', fontSize: '0.7rem' }}
          />
        )}
      </Box>
      {children}
    </Box>
  );
}

function RiskChip({ level }) {
  const map = {
    low: { color: 'success', label: 'Low' },
    moderate: { color: 'warning', label: 'Moderate' },
    high: { color: 'error', label: 'High' },
    very_high: { color: 'error', label: 'Very High' },
  };
  if (!level) return <Typography variant="body2">—</Typography>;
  const c = map[level] || { color: 'default', label: level };
  return <Chip size="small" label={c.label} color={c.color} />;
}

function formatDate(val) {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return val;
  }
}

function formatDateOnly(val) {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return val;
  }
}

/* ─── main component ───────────────────────────────────────────────── */

function UserViewModal({ open, onClose, user }) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [trackers, setTrackers] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [risk, setRisk] = useState(null);
  const [activity, setActivity] = useState(null);
  const [errors, setErrors] = useState({});

  /* The backend tracker/assessment/risk/activity endpoints all accept Firebase
     uid in the URL: /admin/users/<uid>/trackers  — the backend resolves it to the
     MongoDB _id internally.  Passing user.uid (Firebase UID) is always correct. */
  const resolvedId = user?.uid;

  useEffect(() => {
    if (open && resolvedId) {
      fetchAllData();
    }
    // Reset on close
    if (!open) {
      setTrackers(null);
      setAssessment(null);
      setRisk(null);
      setActivity(null);
      setErrors({});
      setTab(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resolvedId]);

  const fetchAllData = async () => {
    setLoading(true);
    const newErrors = {};

    const results = await Promise.allSettled([
      adminService.getUserTrackers(resolvedId),
      adminService.getUserAssessment(resolvedId),
      adminService.getUserRiskOverview(resolvedId),
      adminService.getUserActivity(resolvedId),
    ]);

    if (results[0].status === 'fulfilled') {
      setTrackers(results[0].value);
    } else {
      newErrors.trackers = results[0].reason?.response?.data?.error || 'Failed to load tracker data';
    }

    if (results[1].status === 'fulfilled') {
      setAssessment(results[1].value);
    } else {
      newErrors.assessment = results[1].reason?.response?.data?.error || 'Failed to load assessment data';
    }

    if (results[2].status === 'fulfilled') {
      setRisk(results[2].value);
    } else {
      newErrors.risk = results[2].reason?.response?.data?.error || 'Failed to load risk data';
    }

    if (results[3].status === 'fulfilled') {
      setActivity(results[3].value);
    } else {
      newErrors.activity = results[3].reason?.response?.data?.error || 'Failed to load activity data';
    }

    setErrors(newErrors);
    setLoading(false);
  };

  if (!user) return null;

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const initials = `${(user.first_name || ' ')[0]}${(user.last_name || ' ')[0]}`.toUpperCase();
  const avatarUrl = user.avatar?.url || null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '95vw',
          maxWidth: '95vw',
          height: '95vh',
          maxHeight: '95vh',
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 2,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={avatarUrl}
            sx={{ width: 48, height: 48, bgcolor: 'rgba(255,255,255,0.3)', fontWeight: 700 }}
          >
            {initials}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {fullName}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              {user.email} &nbsp;·&nbsp;
              <Chip
                size="small"
                label={user.role}
                sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontSize: '0.7rem', height: 20 }}
              />
            </Typography>
          </Box>
          <Chip
            size="small"
            label={user.is_disabled ? 'Disabled' : 'Active'}
            sx={{
              ml: 'auto',
              bgcolor: user.is_disabled ? '#ef5350' : '#66bb6a',
              color: 'white',
              fontWeight: 600,
            }}
          />
        </Box>
      </DialogTitle>

      {/* ── Tabs ── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          <Tab icon={<PersonIcon fontSize="small" />} iconPosition="start" label="Personal Info" />
          <Tab icon={<FavoriteIcon fontSize="small" />} iconPosition="start" label="Lifestyle Trackers" />
          <Tab icon={<AssessmentIcon fontSize="small" />} iconPosition="start" label="Risk & Assessment" />
          <Tab icon={<FitnessCenterIcon fontSize="small" />} iconPosition="start" label="Activity" />
        </Tabs>
      </Box>

      {/* ── Scrollable Content ── */}
      <DialogContent sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <>
            {/* ════ TAB 0 — Personal Info ════ */}
            <TabPanel value={tab} index={0}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <SectionHeader icon={<PersonIcon />} title="Basic Information" />
                  <InfoRow label="First Name" value={user.first_name} />
                  <InfoRow label="Last Name" value={user.last_name} />
                  <InfoRow label="Email" value={user.email} />
                  <InfoRow label="Role" value={user.role} />
                  <InfoRow label="Status" value={user.is_disabled ? 'Disabled' : 'Active'} />
                  <InfoRow label="Firebase UID" value={user.uid} />
                  <InfoRow label="MongoDB ID" value={user.id || user._id} />
                  <InfoRow label="Registered" value={formatDate(user.created_at)} />
                  <InfoRow label="Last Updated" value={formatDate(user.updated_at)} />
                  <InfoRow label="Disclaimer Accepted" value={
                    user.disclaimer_accepted === true ? 'Yes'
                      : user.disclaimer_accepted === false ? 'No'
                        : 'Not Shown'
                  } />
                </Grid>

                <Grid item xs={12} md={6}>
                  <SectionHeader icon={<FavoriteIcon />} title="Health Metrics" color="#e53935" />
                  <InfoRow label="Age" value={user.age != null ? `${user.age} yrs` : null} />
                  <InfoRow label="Sex" value={user.sex} />
                  <InfoRow label="Height" value={user.height != null ? `${user.height} cm` : null} />
                  <InfoRow label="Weight" value={user.weight != null ? `${user.weight} kg` : null} />
                  <InfoRow
                    label="BMI"
                    value={
                      user.height && user.weight
                        ? `${(user.weight / Math.pow(user.height / 100, 2)).toFixed(1)}`
                        : null
                    }
                  />
                  <InfoRow label="Diagnosis Status" value={user.diagnosis_status?.replace(/_/g, ' ')} />
                  <InfoRow label="Push Notifications" value={user.enable_push_notifications ? 'Enabled' : 'Disabled'} />
                  <InfoRow label="MFA Enabled" value={user.multi_factor_enabled ? 'Yes' : 'No'} />
                </Grid>
              </Grid>
            </TabPanel>

            {/* ════ TAB 1 — Lifestyle Trackers ════ */}
            <TabPanel value={tab} index={1}>
              {errors.trackers && (
                <Alert severity="error" sx={{ mb: 2 }}>{errors.trackers}</Alert>
              )}

              {!trackers && !errors.trackers && (
                <Alert severity="info">No tracker data available.</Alert>
              )}

              {trackers && (
                <Grid container spacing={2}>
                  {/* ── Food ── */}
                  <Grid item xs={12} sm={6}>
                    <TrackerCard
                      title="Food / Diet"
                      icon={<span style={{ fontSize: 20 }}>🍽️</span>}
                      color="#f57c00"
                      hasBadge={trackers.food?.has_baseline}
                    >
                      <InfoRow label="Risk Score" value={trackers.food?.baseline_risk_score ?? '—'} />
                      <InfoRow label="Risk Level" value={
                        trackers.food?.baseline_risk_level
                          ? <RiskChip level={trackers.food.baseline_risk_level} />
                          : '—'
                      } />
                    </TrackerCard>
                  </Grid>

                  {/* ── Steps ── */}
                  <Grid item xs={12} sm={6}>
                    <TrackerCard
                      title="Step Counter"
                      icon={<DirectionsWalkIcon />}
                      color="#1976d2"
                      hasBadge={trackers.steps?.has_baseline}
                    >
                      <InfoRow label="Avg Daily Steps (7d)" value={
                        trackers.steps?.avg_daily_steps_7d != null
                          ? trackers.steps.avg_daily_steps_7d.toLocaleString()
                          : '—'
                      } />
                      <InfoRow label="Activity Level" value={trackers.steps?.activity_level ?? '—'} />
                      <InfoRow label="Recent Records (7d)" value={trackers.steps?.recent_records ?? '—'} />
                    </TrackerCard>
                  </Grid>

                  {/* ── Sleep ── */}
                  <Grid item xs={12} sm={6}>
                    <TrackerCard
                      title="Sleep"
                      icon={<BedtimeIcon />}
                      color="#7b1fa2"
                      hasBadge={trackers.sleep?.has_baseline}
                    >
                      <InfoRow label="Avg Sleep Hours (7d)" value={
                        trackers.sleep?.avg_sleep_hours_7d != null
                          ? `${trackers.sleep.avg_sleep_hours_7d} hrs`
                          : '—'
                      } />
                      <InfoRow label="Baseline Avg Sleep" value={
                        trackers.sleep?.baseline_avg != null
                          ? `${trackers.sleep.baseline_avg} hrs`
                          : '—'
                      } />
                      <InfoRow label="Recent Records (7d)" value={trackers.sleep?.recent_records ?? '—'} />
                    </TrackerCard>
                  </Grid>

                  {/* ── Smoking ── */}
                  <Grid item xs={12} sm={6}>
                    <TrackerCard
                      title="Smoking"
                      icon={<SmokingRoomsIcon />}
                      color="#d32f2f"
                      hasBadge={trackers.smoking?.has_baseline}
                    >
                      <InfoRow label="Status" value={trackers.smoking?.status ?? '—'} />
                      <InfoRow label="Cigarettes / Day" value={trackers.smoking?.cigarettes_per_day ?? '—'} />
                      <InfoRow label="Years Smoked" value={trackers.smoking?.pack_years ?? '—'} />
                    </TrackerCard>
                  </Grid>

                  {/* ── Alcohol ── */}
                  <Grid item xs={12} sm={6}>
                    <TrackerCard
                      title="Alcohol"
                      icon={<LocalBarIcon />}
                      color="#00695c"
                      hasBadge={trackers.alcohol?.has_baseline}
                    >
                      <InfoRow label="Drinks / Week" value={trackers.alcohol?.drinks_per_week ?? '—'} />
                      <InfoRow label="Binge Episodes / Month" value={trackers.alcohol?.binge_frequency ?? '—'} />
                    </TrackerCard>
                  </Grid>
                </Grid>
              )}
            </TabPanel>

            {/* ════ TAB 2 — Risk & Assessment ════ */}
            <TabPanel value={tab} index={2}>
              <Grid container spacing={3}>
                {/* Risk Overview */}
                <Grid item xs={12} md={6}>
                  <SectionHeader icon={<AssessmentIcon />} title="Overall Risk Overview" color="#e53935" />
                  {errors.risk && <Alert severity="error" sx={{ mb: 1 }}>{errors.risk}</Alert>}
                  {!risk && !errors.risk && <Alert severity="info">No risk data available.</Alert>}
                  {risk && !risk.has_assessment && (
                    <Alert severity="info">No risk assessment found.</Alert>
                  )}
                  {risk?.has_assessment && (
                    <>
                      <InfoRow label="Overall Score" value={
                        risk.overall_risk_score != null
                          ? `${(risk.overall_risk_score).toFixed(1)}%`
                          : '—'
                      } />
                      <InfoRow label="Risk Category" value={<RiskChip level={risk.overall_risk_category} />} />
                      <InfoRow label="Assessed At" value={formatDate(risk.assessed_at)} />

                      {risk.component_scores && Object.keys(risk.component_scores).length > 0 && (
                        <>
                          <Divider sx={{ my: 1.5 }} />
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                            Component Scores
                          </Typography>
                          {Object.entries(risk.component_scores).map(([k, v]) => {
                            // v may be a nested object {weighted_score, raw_score, status, has_data, ...}
                            let display;
                            if (v == null) {
                              display = '—';
                            } else if (typeof v === 'number') {
                              display = v.toFixed(2);
                            } else if (typeof v === 'object') {
                              const ws = v.weighted_score ?? v.raw_score;
                              const status = v.status ? ` (${v.status})` : '';
                              const hasData = v.has_data === false ? ' · no data' : '';
                              display = ws != null ? `${Number(ws).toFixed(2)}${status}${hasData}` : JSON.stringify(v);
                            } else {
                              display = String(v);
                            }
                            return (
                              <InfoRow
                                key={k}
                                label={k.replace(/_/g, ' ')}
                                value={display}
                              />
                            );
                          })}
                        </>
                      )}

                      {risk.primary_risk_factors?.length > 0 && (
                        <>
                          <Divider sx={{ my: 1.5 }} />
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                            Primary Risk Factors
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {risk.primary_risk_factors.map((f, i) => (
                              <Chip key={i} size="small" label={typeof f === 'object' && f !== null ? (f.component_name || f.component || JSON.stringify(f)) : String(f ?? '')} color="error" variant="outlined" />
                            ))}
                          </Box>
                        </>
                      )}

                      {risk.protective_factors?.length > 0 && (
                        <>
                          <Divider sx={{ my: 1.5 }} />
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                            Protective Factors
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {risk.protective_factors.map((f, i) => (
                              <Chip key={i} size="small" label={typeof f === 'object' && f !== null ? (f.component_name || f.component || JSON.stringify(f)) : String(f ?? '')} color="success" variant="outlined" />
                            ))}
                          </Box>
                        </>
                      )}
                    </>
                  )}
                </Grid>

                {/* Diabetes Assessment */}
                <Grid item xs={12} md={6}>
                  <SectionHeader icon={<AssessmentIcon />} title="Diabetes Assessment" color="#1565c0" />
                  {errors.assessment && <Alert severity="error" sx={{ mb: 1 }}>{errors.assessment}</Alert>}
                  {!assessment && !errors.assessment && <Alert severity="info">No assessment data.</Alert>}
                  {assessment && !assessment.has_assessment && (
                    <Alert severity="info">No diabetes assessment taken.</Alert>
                  )}
                  {assessment?.has_assessment && (
                    <>
                      <InfoRow label="Risk Level" value={<RiskChip level={assessment.risk_level} />} />
                      <InfoRow label="Probability" value={
                        assessment.probability != null
                          ? `${(assessment.probability * 100).toFixed(1)}%`
                          : '—'
                      } />
                      <InfoRow label="Confidence" value={assessment.confidence ?? '—'} />
                      <InfoRow label="Assessed At" value={formatDate(assessment.assessed_at)} />

                      {assessment.answers && Object.keys(assessment.answers).length > 0 && (
                        <>
                          <Divider sx={{ my: 1.5 }} />
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                            Assessment Answers
                          </Typography>
                          {Object.entries(assessment.answers).map(([k, v]) => {
                            let display;
                            if (v == null) display = '—';
                            else if (typeof v === 'object') display = JSON.stringify(v);
                            else display = String(v);
                            return (
                              <InfoRow
                                key={k}
                                label={k.replace(/_/g, ' ')}
                                value={display}
                              />
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </Grid>
              </Grid>
            </TabPanel>

            {/* ════ TAB 3 — Activity ════ */}
            <TabPanel value={tab} index={3}>
              {errors.activity && <Alert severity="error" sx={{ mb: 2 }}>{errors.activity}</Alert>}
              {!activity && !errors.activity && <Alert severity="info">No activity data available.</Alert>}

              {activity && (
                <Grid container spacing={3}>
                  {/* Daily Activities */}
                  <Grid item xs={12} md={6}>
                    <SectionHeader icon={<DirectionsWalkIcon />} title="Daily Activity (Last 30 days)" color="#1976d2" />
                    {!activity.activities?.length ? (
                      <Alert severity="info" sx={{ mt: 1 }}>No daily activity records found.</Alert>
                    ) : (
                      <Box sx={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 2 }}>
                        {activity.activities.map((a, i) => (
                          <Box
                            key={i}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              px: 2,
                              py: 1,
                              borderBottom: i < activity.activities.length - 1 ? '1px solid #f0f0f0' : 'none',
                            }}
                          >
                            <Typography variant="body2" fontWeight={600} sx={{ minWidth: 100 }}>
                              {formatDateOnly(a.date)}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                              {a.steps != null && (
                                <Typography variant="body2" color="text.secondary">
                                  👣 {(a.steps || 0).toLocaleString()} steps
                                </Typography>
                              )}
                              {a.distance != null && (
                                <Typography variant="body2" color="text.secondary">
                                  📏 {a.distance}m
                                </Typography>
                              )}
                              {a.calories_burned != null && (
                                <Typography variant="body2" color="text.secondary">
                                  🔥 {a.calories_burned} kcal
                                </Typography>
                              )}
                              {a.active_minutes != null && (
                                <Typography variant="body2" color="text.secondary">
                                  ⏱ {a.active_minutes} min
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Grid>

                  {/* Health Connect Data */}
                  <Grid item xs={12} md={6}>
                    <SectionHeader icon={<FitnessCenterIcon />} title="Health Connect Data (Recent)" color="#2e7d32" />
                    {!activity.health_data?.length ? (
                      <Alert severity="info" sx={{ mt: 1 }}>No Health Connect data found.</Alert>
                    ) : (
                      <Box sx={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 2 }}>
                        {activity.health_data.map((h, i) => (
                          <Box
                            key={h.id || i}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              px: 2,
                              py: 1,
                              borderBottom: i < activity.health_data.length - 1 ? '1px solid #f0f0f0' : 'none',
                            }}
                          >
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {h.type?.replace(/_/g, ' ')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(h.date)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              {h.value} {h.unit}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Grid>
                </Grid>
              )}
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid #e0e0e0', flexShrink: 0 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default UserViewModal;
