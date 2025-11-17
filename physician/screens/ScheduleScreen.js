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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { appointmentAPI } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ScheduleScreen() {
    const { colors: theme } = useTheme();
    const { showToast } = useToast();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [appointments, setAppointments] = useState([]);

    useEffect(() => {
        fetchAppointments();
    }, [selectedDate]);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const dateStr = selectedDate.toISOString();
            const response = await appointmentAPI.getAll({ date: dateStr });
            if (response.success) {
                setAppointments(response.data);
            }
        } catch (error) {
            console.error('Error fetching appointments:', error);
            showToast('Failed to load appointments', 'error');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchAppointments();
        setRefreshing(false);
    };

    const handleConfirmAppointment = async (appointmentId) => {
        try {
            const response = await appointmentAPI.confirm(appointmentId);
            if (response.success) {
                showToast('Appointment confirmed', 'success');
                fetchAppointments();
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
                fetchAppointments();
            }
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            showToast('Failed to cancel appointment', 'error');
        }
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

    // Placeholder data kept for structure
    const oldAppointments = [
        {
            id: 1,
            patientName: 'Sarah Williams',
            time: '09:00 AM',
            duration: '30 min',
            type: 'Follow-up',
            status: 'confirmed',
        },
        {
            id: 2,
            patientName: 'Robert Brown',
            time: '10:30 AM',
            duration: '45 min',
            type: 'Initial Consultation',
            status: 'confirmed',
        },
        {
            id: 3,
            patientName: 'Emily Davis',
            time: '02:00 PM',
            duration: '30 min',
            type: 'Prescription Renewal',
            status: 'pending',
        },
        {
            id: 4,
            patientName: 'Michael Johnson',
            time: '03:30 PM',
            duration: '40 min',
            type: 'Blood Sugar Review',
            status: 'confirmed',
        },
    ];

    const medicationReminders = [];

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed':
                return theme.success;
            case 'pending':
                return theme.warning;
            case 'cancelled':
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
                        {getDaysInMonth().map((day, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.dayCell,
                                    day === new Date().getDate() &&
                                    selectedDate.getMonth() === new Date().getMonth() && {
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
                                                    color:
                                                        day === new Date().getDate() &&
                                                            selectedDate.getMonth() === new Date().getMonth()
                                                            ? '#FFFFFF'
                                                            : theme.text,
                                                },
                                            ]}
                                        >
                                            {day}
                                        </Text>
                                        {day === new Date().getDate() && (
                                            <View
                                                style={[
                                                    styles.dayDot,
                                                    { backgroundColor: '#FFFFFF' },
                                                ]}
                                            />
                                        )}
                                    </>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Today's Appointments */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Today's Appointments
                    </Text>

                    {appointments.length > 0 ? (
                        appointments.map((appointment) => (
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
                    ) : (
                        <View
                            style={[
                                { backgroundColor: theme.card },
                                { alignItems: "center", justifyContent: "center" }
                            ]}
                        >
                            <Text style={[styles.emptyStateText, { color: theme.secondary }]}>
                                No appointments
                            </Text>
                        </View>
                    )}
                </View>

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
