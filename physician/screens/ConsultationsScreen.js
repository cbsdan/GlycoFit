import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { consultationAPI } from '../services/api';
import { Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// ─── Mini-calendar helpers ────────────────────────────────────────────────────
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConsultationsScreen() {
  const { colors: theme } = useTheme();
  const { showToast } = useToast();

  const [selectedTab, setSelectedTab] = useState('calendar');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [consultations, setConsultations] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);

  // Calendar state
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
  const [showScheduleTimePicker, setShowScheduleTimePicker] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Track which tabs have already been fetched to avoid redundant API calls
  const loadedTabs = useRef(new Set());

  useEffect(() => {
    fetchData();
  }, [selectedTab]);

  const fetchData = async (force = false) => {
    const tabKey = selectedTab;

    // Skip fetch if this tab's data is already cached and not forced
    if (!force && loadedTabs.current.has(tabKey)) {
      return;
    }

    try {
      setLoading(true);

      // Fetch pending count only on first ever load, when on pending tab, or on force-refresh
      if (force || tabKey === 'pending' || !loadedTabs.current.has('_pending')) {
        const pendingRes = await consultationAPI.getPending();
        if (pendingRes.success) {
          setPendingRequests(pendingRes.data);
          loadedTabs.current.add('_pending');
        }
      }

      if (tabKey === 'calendar') {
        // Fetch ALL consultations — all statuses — for the calendar view
        const response = await consultationAPI.getAll();
        if (response.success) {
          const sorted = [...response.data].sort((a, b) =>
            new Date(a.scheduled_date) - new Date(b.scheduled_date)
          );
          setConsultations(response.data);
          const nowMs = Date.now();
          const upcoming = sorted.filter(c =>
            new Date(c.scheduled_date).getTime() >= nowMs &&
            !['cancelled', 'rejected', 'no-show'].includes(c.status)
          );
          setUpcomingAppointments(upcoming.slice(0, 10));
        }

      } else if (tabKey !== 'pending') {
        const statusMap = { upcoming: 'approved', completed: 'completed', cancelled: 'cancelled' };
        const status = statusMap[tabKey];
        if (status) {
          const response = await consultationAPI.getAll({ status });
          if (response.success) {
            setConsultations(response.data);
          }
        }
      }

      loadedTabs.current.add(tabKey);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    loadedTabs.current.clear();
    await fetchData(true);
    setRefreshing(false);
  };

  const handleApprove = (consultation) => {
    setSelectedConsultation(consultation);
    setShowApproveModal(true);
  };

  const handleSchedule = (consultation) => {
    setSelectedConsultation(consultation);
    // Pre-fill with the consultation's existing date/time if available
    setScheduleDate(consultation.scheduled_date ? new Date(consultation.scheduled_date) : new Date());
    setScheduleTime(
      consultation.scheduled_time ||
      (consultation.scheduled_date
        ? new Date(consultation.scheduled_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '09:00')
    );
    setShowScheduleModal(true);
  };

  const submitApproval = async () => {
    try {
      setActionLoading(true);
      const response = await consultationAPI.approve(selectedConsultation.id, {});

      if (response.success) {
        showToast('Consultation approved successfully', 'success');
        setShowApproveModal(false);
        loadedTabs.current.clear();
        fetchData(true);
      } else {
        showToast(response.message || 'Failed to approve', 'error');
      }
    } catch (error) {
      console.error('Error approving consultation:', error);
      showToast('Failed to approve consultation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const submitSchedule = async () => {
    try {
      setActionLoading(true);
const pad = (n) => String(n).padStart(2, '0');
      const localDateStr = `${scheduleDate.getFullYear()}-${pad(scheduleDate.getMonth() + 1)}-${pad(scheduleDate.getDate())}`;
      const response = await consultationAPI.approve(selectedConsultation.id, {
        scheduled_date: localDateStr,
        scheduled_time: scheduleTime,
      });

      if (response.success) {
        showToast('Appointment scheduled successfully', 'success');
        setShowScheduleModal(false);
        loadedTabs.current.clear();
        fetchData(true);
      } else {
        showToast(response.message || 'Failed to schedule', 'error');
      }
    } catch (error) {
      console.error('Error scheduling consultation:', error);
      showToast('Failed to schedule consultation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString, timeString) => {
    if (timeString) return timeString;
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Per-day appointment count and highest-priority status for calendar indicators
  const dayCountMap = {};
  const dayStatusMap = {};
  const STATUS_PRIORITY = { pending: 3, 'in-progress': 2, approved: 1, scheduled: 1, completed: 0 };
  consultations.forEach(c => {
    if (!c.scheduled_date) return;
    const d = new Date(c.scheduled_date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    dayCountMap[key] = (dayCountMap[key] || 0) + 1;
    const p = STATUS_PRIORITY[c.status] ?? -1;
    if (p > (STATUS_PRIORITY[dayStatusMap[key]] ?? -2)) dayStatusMap[key] = c.status;
  });
  const getDayCount = (day) => dayCountMap[`${calendarYear}-${calendarMonth}-${day}`] || 0;
  const getDayStatus = (day) => dayStatusMap[`${calendarYear}-${calendarMonth}-${day}`];

  // Appointments for the currently-selected day (calendar view)
  const dayAppointments = selectedDay
    ? consultations.filter(c => {
      if (!c.scheduled_date) return false;
      const d = new Date(c.scheduled_date);
      return (
        d.getFullYear() === calendarYear &&
        d.getMonth() === calendarMonth &&
        d.getDate() === selectedDay
      );
    })
    : [];

  const prevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
    setSelectedDay(null);
  };

  const isToday = (day) =>
    day === today.getDate() &&
    calendarMonth === today.getMonth() &&
    calendarYear === today.getFullYear();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.text, marginTop: 16 }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const upcomingConsultations = consultations.filter(
    (c) => c.status === 'approved' || c.status === 'scheduled'
  );
  const completedConsultations = consultations.filter(
    (c) => c.status === 'completed'
  );
  const cancelledConsultations = consultations.filter(
    (c) => c.status === 'cancelled' || c.status === 'rejected' || c.status === 'no-show'
  );

  const getTypeIcon = (type) => {
    return type === 'video' ? 'videocam' : 'chatbubble';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'approved':
      case 'scheduled':
        return theme.success;
      case 'pending':
        return theme.warning;
      case 'in-progress':
        return theme.primary;
      case 'completed':
        return theme.secondary;
      case 'rejected':
      case 'cancelled':
      case 'no-show':
        return theme.error;
      default:
        return theme.secondary;
    }
  };

  // ─── Render calendar grid ──────────────────────────────────────────────────
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
    const cells = [];

    // Empty leading cells
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.calCell} />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const selected = selectedDay === d;
      const todayCell = isToday(d);
      const count = getDayCount(d);
      const dotStatus = getDayStatus(d);
      const dotColor = selected ? '#fff' : getStatusColor(dotStatus);
      cells.push(
        <TouchableOpacity
          key={d}
          style={[
            styles.calCell,
            selected && { backgroundColor: theme.primary, borderRadius: 20 },
          ]}
          onPress={() => setSelectedDay(selected ? null : d)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.calDayText,
              { color: selected ? '#fff' : todayCell ? theme.primary : theme.text },
              todayCell && !selected && { fontWeight: 'bold' },
            ]}
          >
            {d}
          </Text>
          {count > 0 && (
            <View style={[styles.calBadge, { backgroundColor: selected ? 'rgba(255,255,255,0.28)' : dotColor + '22' }]}>
              <Text style={[styles.calBadgeText, { color: dotColor }]}>{count}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return cells;
  };

  // ─── Tab content: Calendar ─────────────────────────────────────────────────
  const renderCalendarTab = () => (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Mini calendar card */}
      <View style={[styles.calCard, { backgroundColor: theme.card, ...theme.shadow }]}>
        {/* Month navigator */}
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.calMonthTitle, { color: theme.text }]}>
            {MONTHS_LONG[calendarMonth]} {calendarYear}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
            <Ionicons name="chevron-forward" size={22} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Day-of-week headers */}
        <View style={styles.calDaysRow}>
          {DAYS_SHORT.map(d => (
            <Text key={d} style={[styles.calDayHeader, { color: theme.secondary }]}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
        <View style={styles.calGrid}>
          {renderCalendar()}
        </View>
      </View>

      {/* Day appointments (when a day is selected) */}
      {selectedDay !== null && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            Appointments on {MONTHS_LONG[calendarMonth]} {selectedDay}
          </Text>
          {dayAppointments.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
              <Ionicons name="calendar-outline" size={48} color={theme.secondary} />
              <Text style={[styles.emptyStateText, { color: theme.text }]}>No appointments</Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                No appointments scheduled for this day
              </Text>
            </View>
          ) : (
            dayAppointments.map(c => renderAppointmentCard(c))
          )}
        </View>
      )}

      {/* Upcoming appointments list */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>
          Upcoming Appointments{upcomingAppointments.length > 0 ? ` (${upcomingAppointments.length})` : ''}
        </Text>
        {upcomingAppointments.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
            <Ionicons name="calendar-outline" size={64} color={theme.secondary} />
            <Text style={[styles.emptyStateText, { color: theme.text }]}>No upcoming appointments</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
              Approved and pending appointments will appear here
            </Text>
          </View>
        ) : (
          upcomingAppointments.map((c, idx) => {
            const sColor = getStatusColor(c.status);
            const daysAway = Math.ceil(
              (new Date(c.scheduled_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            return (
              <View
                key={c.id}
                style={[
                  styles.upcomingCard,
                  { backgroundColor: theme.card, borderColor: theme.border, borderLeftWidth: 3, borderLeftColor: sColor, ...theme.shadow },
                ]}
              >
                {/* Rank indicator */}
                <View style={[styles.rankBadge, { backgroundColor: sColor }]}>
                  <Text style={styles.rankText}>#{idx + 1}</Text>
                </View>

                <View style={styles.upcomingRow}>
                  <View style={[styles.typeIconContainer, { backgroundColor: sColor + '20' }]}>
                    <Ionicons name={getTypeIcon(c.consultation_type)} size={22} color={sColor} />
                  </View>
                  <View style={styles.upcomingInfo}>
                    <Text style={[styles.patientName, { color: theme.text }]}>
                      {c.patient?.first_name} {c.patient?.last_name}
                    </Text>
                    <Text style={[styles.consultationReason, { color: theme.secondary }]}>
                      {c.reason || 'Consultation'}
                    </Text>
                  </View>
                  {/* Days away badge */}
                  <View style={[styles.daysAwayBadge, { backgroundColor: daysAway <= 1 ? theme.error + '20' : sColor + '18' }]}>
                    <Text style={[styles.daysAwayText, { color: daysAway <= 1 ? theme.error : sColor }]}>
                      {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway}d`}
                    </Text>
                  </View>
                </View>

                <View style={[styles.upcomingMeta, { borderTopColor: theme.border }]}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar" size={14} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {formatDateShort(c.scheduled_date)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={14} color={theme.secondary} />
                    <Text style={[styles.detailText, { color: theme.text }]}>
                      {formatTime(c.scheduled_date, c.scheduled_time)}
                    </Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: sColor + '18' }]}>
                    <Text style={[styles.statusChipText, { color: sColor }]}>
                      {(c.status || '').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  // ─── Compact appointment card (used in day-selection) ──────────────────────
  const renderAppointmentCard = (c) => {
    const statusColor = getStatusColor(c.status);
    return (
      <View
        key={c.id}
        style={[styles.apptCard, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: statusColor, ...theme.shadow }]}
      >
        <View style={styles.apptCardRow}>
          <View style={[styles.apptTypeIcon, { backgroundColor: statusColor + '18' }]}>
            <Ionicons name={getTypeIcon(c.consultation_type)} size={18} color={statusColor} />
          </View>
          <View style={styles.apptCardInfo}>
            <Text style={[styles.apptCardName, { color: theme.text }]} numberOfLines={1}>
              {c.patient?.first_name} {c.patient?.last_name}
            </Text>
            <View style={styles.apptCardMeta}>
              <Ionicons name="time-outline" size={11} color={theme.secondary} />
              <Text style={[styles.apptMetaText, { color: theme.secondary }]}>
                {formatTime(c.scheduled_date, c.scheduled_time)} · {c.duration_minutes} min
              </Text>
            </View>
            {c.reason ? (
              <Text style={[styles.apptMetaText, { color: theme.secondary, marginTop: 2 }]} numberOfLines={1}>
                {c.reason}
              </Text>
            ) : null}
          </View>
          <View style={[styles.statusChip, { backgroundColor: statusColor + '18' }]}>
            <Text style={[styles.statusChipText, { color: statusColor }]}>
              {(c.status || '').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>

        {/* ── Tab Selector ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer}>
          {[
            { id: 'calendar', label: 'Calendar' },
            { id: 'pending', label: `Pending (${pendingRequests.length})` },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                selectedTab === tab.id && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setSelectedTab(tab.id)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: selectedTab === tab.id ? theme.primary : theme.secondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Calendar Tab ── */}
        {selectedTab === 'calendar' && renderCalendarTab()}

        {/* ── Pending Tab ── */}
        {selectedTab === 'pending' && (
          <ScrollView
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.section}>
              {pendingRequests.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
                  <Ionicons name="hourglass-outline" size={64} color={theme.secondary} />
                  <Text style={[styles.emptyStateText, { color: theme.text }]}>No pending requests</Text>
                  <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                    Patient consultation requests will appear here
                  </Text>
                </View>
              ) : (
                pendingRequests.map((consultation) => (
                  <View
                    key={consultation.id}
                    style={[
                      styles.consultationCard,
                      { backgroundColor: theme.card, borderColor: theme.warning, borderWidth: 2, ...theme.shadow },
                    ]}
                  >
                    <View style={[styles.pendingBadge, { backgroundColor: theme.warning }]}>
                      <Text style={styles.pendingBadgeText}>PENDING REQUEST</Text>
                    </View>

                    <View style={styles.cardHeader}>
                      <View style={[styles.typeIconContainer, { backgroundColor: theme.warning + '20' }]}>
                        <Ionicons name={getTypeIcon(consultation.consultation_type)} size={24} color={theme.warning} />
                      </View>
                      <View style={styles.consultationInfo}>
                        <Text style={[styles.patientName, { color: theme.text }]}>
                          {consultation.patient?.first_name} {consultation.patient?.last_name}
                        </Text>
                        <Text style={[styles.consultationReason, { color: theme.secondary }]}>
                          {consultation.reason || 'No reason provided'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.consultationDetails}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar" size={16} color={theme.secondary} />
                        <Text style={[styles.detailText, { color: theme.text }]}>
                          {formatDate(consultation.scheduled_date)}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="time" size={16} color={theme.secondary} />
                        <Text style={[styles.detailText, { color: theme.text }]}>
                          {formatTime(consultation.scheduled_date, consultation.scheduled_time)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.approveButton, { backgroundColor: theme.success }]}
                        onPress={() => handleApprove(consultation)}
                      >
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.buttonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rejectButton, { backgroundColor: theme.primary }]}
                        onPress={() => handleSchedule(consultation)}
                      >
                        <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.buttonText}>Schedule</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* ── Upcoming Tab ── */}
        {selectedTab === 'upcoming' && (
          <ScrollView
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.section}>
              {upcomingConsultations.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
                  <Ionicons name="calendar-outline" size={64} color={theme.secondary} />
                  <Text style={[styles.emptyStateText, { color: theme.text }]}>No consultations</Text>
                  <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                    Approved consultations will appear here
                  </Text>
                </View>
              ) : (
                upcomingConsultations.map((consultation) => (
                  <TouchableOpacity
                    key={consultation.id}
                    style={[
                      styles.consultationCard,
                      { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={[styles.typeIconContainer, { backgroundColor: theme.primary + '20' }]}>
                        <Ionicons name={getTypeIcon(consultation.consultation_type)} size={24} color={theme.primary} />
                      </View>
                      <View style={styles.consultationInfo}>
                        <Text style={[styles.patientName, { color: theme.text }]}>
                          {consultation.patient?.first_name} {consultation.patient?.last_name}
                        </Text>
                        <Text style={[styles.consultationReason, { color: theme.secondary }]}>
                          {consultation.reason || 'Consultation'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.consultationDetails}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar" size={16} color={theme.secondary} />
                        <Text style={[styles.detailText, { color: theme.text }]}>
                          {formatDate(consultation.scheduled_date)}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="time" size={16} color={theme.secondary} />
                        <Text style={[styles.detailText, { color: theme.text }]}>
                          {formatTime(consultation.scheduled_date, consultation.scheduled_time)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* ── Completed Tab ── */}
        {selectedTab === 'completed' && (
          <ScrollView
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.section}>
              {completedConsultations.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
                  <Ionicons name="checkmark-done-outline" size={64} color={theme.secondary} />
                  <Text style={[styles.emptyStateText, { color: theme.text }]}>No consultations</Text>
                  <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                    Completed consultations will appear here
                  </Text>
                </View>
              ) : (
                completedConsultations.map((consultation) => (
                  <TouchableOpacity
                    key={consultation.id}
                    style={[
                      styles.consultationCard,
                      { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={[styles.typeIconContainer, { backgroundColor: theme.success + '20' }]}>
                        <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                      </View>
                      <View style={styles.consultationInfo}>
                        <Text style={[styles.patientName, { color: theme.text }]}>
                          {consultation.patient?.first_name} {consultation.patient?.last_name}
                        </Text>
                        <Text style={[styles.consultationReason, { color: theme.secondary }]}>
                          {consultation.reason || 'Appointment'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.consultationDetails}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar" size={16} color={theme.secondary} />
                        <Text style={[styles.detailText, { color: theme.text }]}>
                          {formatDate(consultation.scheduled_date)}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="time" size={16} color={theme.secondary} />
                        <Text style={[styles.detailText, { color: theme.text }]}>
                          {formatTime(consultation.scheduled_date, consultation.scheduled_time)}
                        </Text>
                      </View>
                    </View>

                    {consultation.notes && (
                      <View style={[styles.notesContainer, { backgroundColor: theme.surface }]}>
                        <Ionicons name="document-text" size={16} color={theme.secondary} />
                        <Text style={[styles.notesText, { color: theme.text }]}>{consultation.notes}</Text>
                      </View>
                    )}

                    <TouchableOpacity style={[styles.viewDetailsButton, { borderColor: theme.border }]}>
                      <Text style={[styles.viewDetailsText, { color: theme.primary }]}>View Details</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        )}


        {/* ── Cancelled Tab ── */}
        {selectedTab === 'cancelled' && (
          <ScrollView
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.section}>
              {cancelledConsultations.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
                  <Ionicons name="close-circle-outline" size={64} color={theme.secondary} />
                  <Text style={[styles.emptyStateText, { color: theme.text }]}>No cancelled appointments</Text>
                  <Text style={[styles.emptyStateSubtext, { color: theme.secondary }]}>
                    Cancelled, rejected, or no-show appointments will appear here
                  </Text>
                </View>
              ) : (
                cancelledConsultations.map((consultation) => {
                  const statusColor = getStatusColor(consultation.status);
                  return (
                    <View
                      key={consultation.id}
                      style={[
                        styles.consultationCard,
                        { backgroundColor: theme.card, borderColor: statusColor, borderWidth: 1, ...theme.shadow },
                      ]}
                    >
                      <View style={styles.cardHeader}>
                        <View style={[styles.typeIconContainer, { backgroundColor: statusColor + '20' }]}>
                          <Ionicons name="close-circle" size={24} color={statusColor} />
                        </View>
                        <View style={styles.consultationInfo}>
                          <Text style={[styles.patientName, { color: theme.text }]}>
                            {consultation.patient?.first_name} {consultation.patient?.last_name}
                          </Text>
                          <Text style={[styles.consultationReason, { color: theme.secondary }]}>
                            {consultation.reason || 'Appointment'}
                          </Text>
                        </View>
                        <View style={[styles.statusChip, { backgroundColor: statusColor + '18' }]}>
                          <Text style={[styles.statusChipText, { color: statusColor }]}>
                            {(consultation.status || '').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.consultationDetails}>
                        <View style={styles.detailItem}>
                          <Ionicons name="calendar" size={16} color={theme.secondary} />
                          <Text style={[styles.detailText, { color: theme.text }]}>
                            {formatDate(consultation.scheduled_date)}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Ionicons name="time" size={16} color={theme.secondary} />
                          <Text style={[styles.detailText, { color: theme.text }]}>
                            {formatTime(consultation.scheduled_date, consultation.scheduled_time)}
                          </Text>
                        </View>

                      </View>

                      {consultation.notes && (
                        <View style={[styles.notesContainer, { backgroundColor: theme.surface }]}>
                          <Ionicons name="document-text" size={16} color={theme.secondary} />
                          <Text style={[styles.notesText, { color: theme.text }]}>{consultation.notes}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}

        {/* ── Approve Modal ── */}
        <Modal
          visible={showApproveModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowApproveModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Approve Appointment</Text>
                <TouchableOpacity onPress={() => setShowApproveModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              {selectedConsultation && (
                <View style={styles.modalBody}>
                  {/* Confirmation info */}
                  <View style={[styles.approveInfoBox, { backgroundColor: theme.success + '12', borderColor: theme.success + '40' }]}>
                    <Ionicons name="checkmark-circle" size={32} color={theme.success} style={{ marginBottom: 8 }} />
                    <Text style={[styles.approveInfoText, { color: theme.text }]}>
                      You are about to approve the appointment request from
                    </Text>
                    <Text style={[styles.approvePatientName, { color: theme.text }]}>
                      {selectedConsultation.patient?.first_name} {selectedConsultation.patient?.last_name}
                    </Text>
                    <Text style={[styles.approveDate, { color: theme.secondary }]}>
                      {formatDate(selectedConsultation.scheduled_date)} at{' '}
                      {formatTime(selectedConsultation.scheduled_date, selectedConsultation.scheduled_time)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: theme.success }]}
                    onPress={submitApproval}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>Confirm Approval</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ── Schedule Modal ── */}
        <Modal
          visible={showScheduleModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowScheduleModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Schedule Appointment</Text>
                <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              {selectedConsultation && (
                <ScrollView style={styles.modalBody}>
                  <Text style={[styles.modalSubtitle, { color: theme.secondary }]}>
                    Patient: {selectedConsultation.patient?.first_name} {selectedConsultation.patient?.last_name}
                  </Text>
                  {selectedConsultation.reason ? (
                    <Text style={[styles.modalSubtitle, { color: theme.secondary }]}>
                      Reason: {selectedConsultation.reason}
                    </Text>
                  ) : null}

                  <View style={[styles.scheduleInfoBox, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '40', marginBottom: 16 }]}>
                    <Ionicons name="information-circle" size={18} color={theme.primary} />
                    <Text style={[styles.scheduleInfoText, { color: theme.text }]}>
                      Set a date and time to approve and schedule this appointment.
                    </Text>
                  </View>

                  <Text style={[styles.inputLabel, { color: theme.text }]}>Appointment Date</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 16 }]}
                    onPress={() => setShowScheduleDatePicker(true)}
                  >
                    <Ionicons name="calendar" size={20} color={theme.primary} />
                    <Text style={[styles.dateButtonText, { color: theme.text }]}>
                      {scheduleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.inputLabel, { color: theme.text }]}>Appointment Time</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 16 }]}
                    onPress={() => setShowScheduleTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color={theme.primary} />
                    <Text style={[styles.dateButtonText, { color: theme.text }]}>{scheduleTime}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: theme.primary }]}
                    onPress={submitSchedule}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Icon name="calendar-check" size={20} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>Confirm Schedule</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Date Picker for Schedule Modal */}
        <Modal
          visible={showScheduleDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowScheduleDatePicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Date</Text>
              <ScrollView style={styles.pickerScroll}>
                {Array.from({ length: 60 }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  date.setHours(12, 0, 0, 0);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.pickerItem, scheduleDate.toDateString() === date.toDateString() && { backgroundColor: theme.primary + '20' }]}
                      onPress={() => { setScheduleDate(date); setShowScheduleDatePicker(false); }}
                    >
                      <Text style={[styles.pickerItemText, { color: scheduleDate.toDateString() === date.toDateString() ? theme.primary : theme.text }]}>
                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={[styles.pickerCloseButton, { borderColor: theme.border }]} onPress={() => setShowScheduleDatePicker(false)}>
                <Text style={[styles.pickerCloseText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Time Picker for Schedule Modal */}
        <Modal
          visible={showScheduleTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowScheduleTimePicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Time</Text>
              <ScrollView style={styles.pickerScroll}>
                {['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'].map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[styles.pickerItem, scheduleTime === time && { backgroundColor: theme.primary + '20' }]}
                    onPress={() => { setScheduleTime(time); setShowScheduleTimePicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, { color: scheduleTime === time ? theme.primary : theme.text }]}>{time}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={[styles.pickerCloseButton, { borderColor: theme.border }]} onPress={() => setShowScheduleTimePicker(false)}>
                <Text style={[styles.pickerCloseText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    maxHeight: 50,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1 },
  section: { padding: 16 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },

  // ── Calendar styles ─────────────────────────────────────────────────────────
  calCard: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    padding: 6,
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  calDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  calDayHeader: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calCell: {
    width: '14.28%',
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
  },
  calDayText: {
    fontSize: 14,
    textAlign: 'center',
  },
  calDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
  },
  calBadge: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 16,
    alignItems: 'center',
  },
  calBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },

  // ── Compact day-appointment card ────────────────────────────────────────────
  apptCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  apptCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  apptTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  apptCardInfo: {
    flex: 1,
  },
  apptCardName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  apptCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  apptMetaText: {
    fontSize: 11,
  },
  statusChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
  },
  statusChipText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Upcoming card (first-7 list) ────────────────────────────────────────────
  upcomingCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  rankBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  rankText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingRight: 52,
  },
  upcomingInfo: { flex: 1, marginLeft: 12 },
  daysAwayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysAwayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  upcomingMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    paddingHorizontal: 14,
  },

  // ── Consultation / standard card ────────────────────────────────────────────
  consultationCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  pendingBadge: {
    position: 'absolute',
    top: -1,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  pendingBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  cardHeader: { flexDirection: 'row', marginBottom: 12, marginTop: 8 },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consultationInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  patientName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  consultationReason: { fontSize: 13 },
  consultationDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { fontSize: 12 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  notesContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  notesText: { flex: 1, fontSize: 13 },
  viewDetailsButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  viewDetailsText: { fontSize: 14, fontWeight: '600' },

  // ── Prescription card ───────────────────────────────────────────────────────
  prescriptionCard: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  prescriptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  prescriptionInfo: { flex: 1 },
  medicationName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  patientNameSmall: { fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  prescriptionDetails: { marginBottom: 12, gap: 8 },
  prescriptionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  prescriptionLabel: { fontSize: 13 },
  prescriptionValue: { fontSize: 13, fontWeight: '600' },
  editPrescriptionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  editPrescriptionText: { fontSize: 14, fontWeight: '600' },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyState: {
    padding: 20,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateText: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  emptyStateSubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // ── Modals ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalBody: { padding: 16 },
  modalSubtitle: { fontSize: 14, marginBottom: 8 },
  approveInfoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  approveInfoText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  approvePatientName: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  approveDate: {
    fontSize: 13,
    textAlign: 'center',
  },
  inputGroup: { marginTop: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  textInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14 },
  textArea: { height: 80, textAlignVertical: 'top' },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  // Schedule modal picker styles
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  dateButtonText: { fontSize: 15, flex: 1 },
  scheduleInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  scheduleInfoText: { fontSize: 13, flex: 1, lineHeight: 18 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: 400,
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  pickerScroll: { maxHeight: 280 },
  pickerItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 4 },
  pickerItemText: { fontSize: 15, textAlign: 'center' },
  pickerCloseButton: { marginTop: 8, paddingVertical: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  pickerCloseText: { fontSize: 15, fontWeight: '600' },
});
