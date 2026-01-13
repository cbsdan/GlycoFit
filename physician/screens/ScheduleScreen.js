import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    RefreshControl,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { appointmentAPI, consultationAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ScheduleScreen() {
    const { colors: theme } = useTheme();
    const { showToast } = useToast();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [consultations, setConsultations] = useState([]);

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Get start and end of the selected month for consultations
            const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
            
            // Fetch both appointments and consultations
            const [appointmentsRes, consultationsRes] = await Promise.all([
                appointmentAPI.getAll({ date: selectedDate.toISOString() }),
                consultationAPI.getSchedule(startOfMonth.toISOString(), endOfMonth.toISOString())
            ]);
            
            if (appointmentsRes.success) {
                setAppointments(appointmentsRes.data);
            }
            if (consultationsRes.success) {
                setConsultations(consultationsRes.data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            showToast('Failed to load schedule', 'error');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleConfirmAppointment = async (appointmentId) => {
        try {
            const response = await appointmentAPI.confirm(appointmentId);
            if (response.success) {
                showToast('Appointment confirmed', 'success');
                fetchData();
            }
        } catch (error) {
            console.error('Error confirming appointment:', error);
            showToast('Failed to confirm appointment', 'error');
        }
    };

    const handleCancelAppointment = async (appointmentId) => {
        try {
            const response = await appointmentAPI.cancel(appointmentId);
            if (response.success) {
                showToast('Appointment cancelled', 'success');
                fetchData();
            }
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            showToast('Failed to cancel appointment', 'error');
        }
    };

    const openMeetingLink = (link) => {
        if (link) {
            Linking.openURL(link);
        }
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

    // Get consultations for a specific day
    const getConsultationsForDay = (day) => {
        if (!day) return [];
        const targetDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
        return consultations.filter(c => {
            const consultDate = new Date(c.scheduled_date);
            return consultDate.getDate() === day && 
                   consultDate.getMonth() === selectedDate.getMonth() &&
                   consultDate.getFullYear() === selectedDate.getFullYear();
        });
    };

    // Get today's consultations
    const getTodayConsultations = () => {
        const today = new Date();
        return consultations.filter(c => {
            const consultDate = new Date(c.scheduled_date);
            return consultDate.toDateString() === today.toDateString();
        });
    };

    // Check if a day has consultations
    const dayHasConsultations = (day) => {
        return getConsultationsForDay(day).length > 0;
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ color: theme.text, marginTop: 16 }}>Loading schedule...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const medicationReminders = [];

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed':
            case 'approved':
                return theme.success;
            case 'pending':
                return theme.warning;
            case 'cancelled':
            case 'rejected':
                return theme.error;
            default:
                return theme.secondary;
        }
    };

    const getDaysInMonth = () => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }
        return days;
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            <ScrollView
                style={[styles.container, { backgroundColor: theme.background }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Calendar Header */}
                <View
                    style={[
                        styles.calendarHeader,
                        { backgroundColor: theme.card, borderBottomColor: theme.border },
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setMonth(newDate.getMonth() - 1);
                            setSelectedDate(newDate);
                        }}
                    >
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>

                    <Text style={[styles.monthYear, { color: theme.text }]}>
                        {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                    </Text>

                    <TouchableOpacity
                        onPress={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setMonth(newDate.getMonth() + 1);
                            setSelectedDate(newDate);
                        }}
                    >
                        <Ionicons name="chevron-forward" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {/* Calendar Grid */}
                <View style={[styles.calendar, { backgroundColor: theme.card }]}>
                    <View style={styles.dayNamesRow}>
                        {dayNames.map((day) => (
                            <View key={day} style={styles.dayNameCell}>
                                <Text style={[styles.dayName, { color: theme.secondary }]}>
                                    {day}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.daysGrid}>
                        {getDaysInMonth().map((day, index) => {
                            const isToday = day === new Date().getDate() &&
                                selectedDate.getMonth() === new Date().getMonth() &&
                                selectedDate.getFullYear() === new Date().getFullYear();
                            const hasConsultation = dayHasConsultations(day);
                            
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.dayCell,
                                        isToday && {
                                            backgroundColor: theme.primary,
                                        },
                                    ]}
                                    disabled={!day}
                                >
                                    {day && (
                                        <>
                                            <Text
                                                style={[
                                                    styles.dayNumber,
                                                    {
                                                        color: isToday ? '#FFFFFF' : theme.text,
                                                    },
                                                ]}
                                            >
                                                {day}
                                            </Text>
                                            {hasConsultation && (
                                                <View
                                                    style={[
                                                        styles.dayDot,
                                                        { backgroundColor: isToday ? '#FFFFFF' : theme.success },
                                                    ]}
                                                />
                                            )}
                                        </>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Today's Consultations */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Today's Consultations
                    </Text>

                    {getTodayConsultations().length > 0 ? (
                        getTodayConsultations().map((consultation) => (
                            <TouchableOpacity
                                key={consultation.id}
                                style={[
                                    styles.appointmentCard,
                                    {
                                        backgroundColor: theme.card,
                                        borderColor: theme.success,
                                        borderWidth: 1,
                                        ...theme.shadow,
                                    },
                                ]}
                                onPress={() => openMeetingLink(consultation.meeting_link)}
                            >
                                <View style={styles.timeIndicator}>
                                    <Ionicons name="time" size={20} color={theme.primary} />
                                    <Text style={[styles.appointmentTime, { color: theme.text }]}>
                                        {formatTime(consultation.scheduled_date, consultation.scheduled_time)}
                                    </Text>
                                </View>

                                <View style={styles.appointmentInfo}>
                                    <View style={styles.appointmentHeader}>
                                        <Text style={[styles.appointmentPatient, { color: theme.text }]}>
                                            {consultation.patient?.first_name} {consultation.patient?.last_name}
                                        </Text>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                {
                                                    backgroundColor: theme.success + '20',
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusText,
                                                    { color: theme.success },
                                                ]}
                                            >
                                                APPROVED
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.appointmentDetails}>
                                        <Ionicons
                                            name="videocam"
                                            size={14}
                                            color={theme.secondary}
                                        />
                                        <Text
                                            style={[styles.appointmentType, { color: theme.secondary }]}
                                        >
                                            Google Meet
                                        </Text>
                                        <Text style={[styles.separator, { color: theme.secondary }]}>
                                            •
                                        </Text>
                                        <Ionicons
                                            name="hourglass-outline"
                                            size={14}
                                            color={theme.secondary}
                                        />
                                        <Text
                                            style={[styles.appointmentDuration, { color: theme.secondary }]}
                                        >
                                            {consultation.duration_minutes} min
                                        </Text>
                                    </View>

                                    {consultation.meeting_link && (
                                        <View style={[styles.meetingLinkContainer, { backgroundColor: theme.primary + '10' }]}>
                                            <Ionicons name="link" size={14} color={theme.primary} />
                                            <Text 
                                                style={[styles.meetingLinkText, { color: theme.primary }]}
                                                numberOfLines={1}
                                            >
                                                {consultation.meeting_link}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity 
                                    style={[styles.joinButton, { backgroundColor: theme.success }]}
                                    onPress={() => openMeetingLink(consultation.meeting_link)}
                                >
                                    <Ionicons name="videocam" size={16} color="#FFFFFF" />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View
                            style={[
                                styles.emptyCard,
                                { backgroundColor: theme.card, borderColor: theme.border }
                            ]}
                        >
                            <Ionicons name="calendar-outline" size={40} color={theme.secondary} />
                            <Text style={[styles.emptyStateText, { color: theme.secondary }]}>
                                No consultations scheduled for today
                            </Text>
                        </View>
                    )}
                </View>

                {/* Today's Appointments (Legacy) */}
                {appointments.length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Today's Appointments
                    </Text>

                    {appointments.map((appointment) => (
                            <TouchableOpacity
                                key={appointment.id}
                                style={[
                                    styles.appointmentCard,
                                    {
                                        backgroundColor: theme.card,
                                        borderColor: theme.border,
                                        ...theme.shadow,
                                    },
                                ]}
                            >
                                <View style={styles.timeIndicator}>
                                    <Ionicons name="time" size={20} color={theme.primary} />
                                    <Text style={[styles.appointmentTime, { color: theme.text }]}>
                                        {appointment.time}
                                    </Text>
                                </View>

                                <View style={styles.appointmentInfo}>
                                    <View style={styles.appointmentHeader}>
                                        <Text style={[styles.appointmentPatient, { color: theme.text }]}>
                                            {appointment.patientName}
                                        </Text>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                {
                                                    backgroundColor:
                                                        getStatusColor(appointment.status) + '20',
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusText,
                                                    { color: getStatusColor(appointment.status) },
                                                ]}
                                            >
                                                {appointment.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.appointmentDetails}>
                                        <Ionicons
                                            name="medical"
                                            size={14}
                                            color={theme.secondary}
                                        />
                                        <Text
                                            style={[styles.appointmentType, { color: theme.secondary }]}
                                        >
                                            {appointment.type}
                                        </Text>
                                        <Text style={[styles.separator, { color: theme.secondary }]}>
                                            •
                                        </Text>
                                        <Ionicons
                                            name="hourglass-outline"
                                            size={14}
                                            color={theme.secondary}
                                        />
                                        <Text
                                            style={[styles.appointmentDuration, { color: theme.secondary }]}
                                        >
                                            {appointment.duration}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.moreButton}>
                                    <Ionicons
                                        name="ellipsis-vertical"
                                        size={20}
                                        color={theme.secondary}
                                    />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))
                    }
                </View>
                )}

                {/* Medication Reminders */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>
                            Medication Reminders
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowReminderModal(true)}
                            style={[
                                styles.addButton,
                                { backgroundColor: theme.primary },
                            ]}
                        >
                            <Ionicons name="add" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {medicationReminders.length > 0 ? (
                        medicationReminders.map((reminder) => (
                            <View
                                key={reminder.id}
                                style={[
                                    styles.reminderCard,
                                    {
                                        backgroundColor: theme.card,
                                        borderColor: theme.border,
                                        ...theme.shadow,
                                    },
                                ]}
                            >
                                <View style={styles.reminderHeader}>
                                    <View
                                        style={[
                                            styles.medicationIcon,
                                            { backgroundColor: theme.info + '20' },
                                        ]}
                                    >
                                        <Ionicons name="medical" size={20} color={theme.info} />
                                    </View>
                                    <View style={styles.reminderInfo}>
                                        <Text style={[styles.medicationName, { color: theme.text }]}>
                                            {reminder.medication}
                                        </Text>
                                        <Text style={[styles.reminderPatient, { color: theme.secondary }]}>
                                            {reminder.patientName}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.reminderDetails}>
                                    <View style={styles.reminderRow}>
                                        <Ionicons name="time" size={16} color={theme.secondary} />
                                        <Text style={[styles.reminderText, { color: theme.text }]}>
                                            {reminder.time} • {reminder.frequency}
                                        </Text>
                                    </View>
                                    <Text style={[styles.nextDose, { color: theme.primary }]}>
                                        Next dose: {reminder.nextDose}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={[
                                        styles.notifyButton,
                                        { backgroundColor: theme.primary },
                                    ]}
                                >
                                    <Ionicons name="notifications" size={16} color="#FFFFFF" />
                                    <Text style={styles.notifyButtonText}>Send Reminder</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    ) : (
                        <View
                            style={[
                                { backgroundColor: theme.card },   // your theme style
                                { alignItems: "center", justifyContent: "center" } // centering
                            ]}
                        >
                            <Text style={[styles.emptyStateText, { color: theme.secondary }]}>
                                No medication reminders
                            </Text>
                        </View>

                    )}
                </View>

                {/* Add Reminder Modal Placeholder */}
                <Modal
                    visible={showReminderModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowReminderModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View
                            style={[
                                styles.modalContent,
                                { backgroundColor: theme.card },
                            ]}
                        >
                            <Text style={[styles.modalTitle, { color: theme.text }]}>
                                Add Medication Reminder
                            </Text>
                            <Text style={[styles.modalMessage, { color: theme.secondary }]}>
                                This feature will be available soon. You'll be able to set up
                                automated medication reminders for your patients.
                            </Text>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                                onPress={() => setShowReminderModal(false)}
                            >
                                <Text style={styles.modalButtonText}>Got it</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    monthYear: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    calendar: {
        padding: 16,
    },
    dayNamesRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    dayNameCell: {
        flex: 1,
        alignItems: 'center',
    },
    dayName: {
        fontSize: 12,
        fontWeight: '600',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    dayNumber: {
        fontSize: 14,
    },
    dayDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 2,
    },
    section: {
        padding: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    appointmentCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    timeIndicator: {
        alignItems: 'center',
        marginRight: 16,
        minWidth: 60,
    },
    appointmentTime: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 4,
    },
    appointmentInfo: {
        flex: 1,
    },
    appointmentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    appointmentPatient: {
        fontSize: 16,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    appointmentDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    appointmentType: {
        fontSize: 13,
    },
    separator: {
        fontSize: 13,
    },
    appointmentDuration: {
        fontSize: 13,
    },
    meetingLinkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 8,
        borderRadius: 6,
        gap: 6,
    },
    meetingLinkText: {
        flex: 1,
        fontSize: 12,
    },
    joinButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    emptyCard: {
        padding: 32,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moreButton: {
        padding: 4,
    },
    reminderCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
    },
    reminderHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    medicationIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reminderInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    medicationName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    reminderPatient: {
        fontSize: 13,
    },
    reminderDetails: {
        marginBottom: 12,
    },
    reminderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    reminderText: {
        fontSize: 13,
    },
    nextDose: {
        fontSize: 12,
        fontWeight: '600',
    },
    notifyButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    notifyButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        padding: 24,
        borderRadius: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    modalMessage: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 20,
    },
    modalButton: {
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyState: {
        padding: 48,
        marginTop: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
