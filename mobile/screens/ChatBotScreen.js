import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ChatBotScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    // Initial greeting message
    const greeting = {
      id: Date.now().toString(),
      text: `Hi ${user?.first_name || 'there'}! 👋 I'm your GlycoFit health assistant. How can I help you today?`,
      isBot: true,
      timestamp: new Date(),
    };
    setMessages([greeting]);
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isBot: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = inputText.trim();
    setInputText('');
    setIsTyping(true);

    try {
      // Call the backend chatbot API
      const response = await api.sendChatbotMessage(messageText);
      
      if (response.success) {
        const botMessage = {
          id: (Date.now() + 1).toString(),
          text: response.response,
          isBot: true,
          timestamp: new Date(response.timestamp),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        // Fallback response on error
        const botMessage = {
          id: (Date.now() + 1).toString(),
          text: "I'm having trouble connecting right now. Please try again in a moment.",
          isBot: true,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Error sending message to chatbot:', error);
      // Fallback response on error
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting right now. Please try again in a moment.",
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const getBotResponse = (message) => {
    const lowerMessage = message.toLowerCase();

    // Health-related responses
    if (lowerMessage.includes('blood sugar') || lowerMessage.includes('glucose')) {
      return "To help manage your blood sugar levels, I recommend:\n\n• Monitor your carb intake\n• Stay physically active\n• Check your glucose regularly\n• Stay hydrated\n\nWould you like me to show you your recent glucose data?";
    }
    
    if (lowerMessage.includes('meal') || lowerMessage.includes('food')) {
      return "Great question about meals! Here's what I can help with:\n\n• Log new meals with photo scanning\n• View your meal history\n• Track your daily nutrition\n• Get meal recommendations\n\nWhat would you like to do?";
    }

    if (lowerMessage.includes('exercise') || lowerMessage.includes('activity') || lowerMessage.includes('steps')) {
      return "Physical activity is crucial for managing diabetes! 🏃‍♂️\n\nYour recent stats show you're doing great! Keep aiming for:\n• 10,000 steps daily\n• 30 minutes of moderate activity\n• Regular movement throughout the day\n\nWant to see your activity history?";
    }

    if (lowerMessage.includes('doctor') || lowerMessage.includes('physician')) {
      return "I can help you connect with healthcare professionals:\n\n• Find nearby physicians\n• Schedule consultations\n• View your appointments\n• Message your doctor\n\nWould you like to find a physician?";
    }

    if (lowerMessage.includes('help')) {
      return "I'm here to assist you with:\n\n🍽️ Meal tracking & nutrition\n📊 Health data monitoring\n💊 Medication reminders\n👨‍⚕️ Doctor consultations\n📈 Glucose predictions\n\nJust ask me anything about your health!";
    }

    // Default response
    return "I understand you're asking about: \"" + message + "\"\n\nI'm here to help with your diabetes management, nutrition tracking, and health monitoring. Could you provide more details or try asking about meals, glucose levels, or finding a doctor?";
  };

  const quickReplies = [
    { id: '1', text: '📊 My glucose levels', icon: 'chart-line' },
    { id: '2', text: '🍽️ Log a meal', icon: 'food' },
    { id: '3', text: '🏃 Activity stats', icon: 'walk' },
    { id: '4', text: '👨‍⚕️ Find doctor', icon: 'doctor' },
  ];

  const handleQuickReply = (text) => {
    setInputText(text);
  };

  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageContainer,
        item.isBot ? styles.botMessageContainer : styles.userMessageContainer,
      ]}
    >
      {item.isBot && (
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
          <Icon name="robot" size={20} color="#fff" />
        </View>
      )}
      
      <View
        style={[
          styles.messageBubble,
          item.isBot
            ? { backgroundColor: colors.card, borderColor: colors.border }
            : { backgroundColor: colors.primary },
        ]}
      >
        <Text
          style={[
            styles.messageText,
            { color: item.isBot ? colors.text : '#fff' },
          ]}
        >
          {item.text}
        </Text>
        <Text
          style={[
            styles.timestamp,
            { color: item.isBot ? colors.secondary : 'rgba(255,255,255,0.7)' },
          ]}
        >
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {!item.isBot && (
        <View style={[styles.avatarContainer, { backgroundColor: colors.secondary }]}>
          <Icon name="account" size={20} color="#fff" />
        </View>
      )}
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      marginRight: 16,
    },
    headerContent: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.secondary,
      marginTop: 2,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${colors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    messagesContainer: {
      flex: 1,
    },
    messagesList: {
      padding: 16,
    },
    messageContainer: {
      flexDirection: 'row',
      marginBottom: 16,
      alignItems: 'flex-end',
    },
    botMessageContainer: {
      justifyContent: 'flex-start',
    },
    userMessageContainer: {
      justifyContent: 'flex-end',
    },
    avatarContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 8,
    },
    messageBubble: {
      maxWidth: '70%',
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    timestamp: {
      fontSize: 10,
      marginTop: 4,
    },
    typingContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    typingBubble: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginLeft: 8,
    },
    typingText: {
      fontSize: 14,
      color: colors.secondary,
    },
    quickRepliesContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    quickRepliesTitle: {
      fontSize: 12,
      color: colors.secondary,
      marginBottom: 8,
      fontWeight: '600',
    },
    quickRepliesScroll: {
      flexDirection: 'row',
      gap: 8,
    },
    quickReplyButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    quickReplyText: {
      fontSize: 14,
      color: colors.text,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      paddingBottom: 20,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    sendButtonDisabled: {
      backgroundColor: colors.border,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Health Assistant</Text>
          <Text style={styles.headerSubtitle}>
            {isTyping ? 'Typing...' : 'Always here to help'}
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Icon name="robot" size={24} color={colors.primary} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
        />

        {/* Typing Indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
              <Icon name="robot" size={20} color="#fff" />
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </View>
        )}

        {/* Quick Replies */}
        {messages.length <= 1 && (
          <View style={styles.quickRepliesContainer}>
            <Text style={styles.quickRepliesTitle}>Quick Actions</Text>
            <View style={styles.quickRepliesScroll}>
              {quickReplies.map((reply) => (
                <TouchableOpacity
                  key={reply.id}
                  style={styles.quickReplyButton}
                  onPress={() => handleQuickReply(reply.text)}
                >
                  <Text style={styles.quickReplyText}>{reply.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor={colors.secondary}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Icon
              name="send"
              size={20}
              color={inputText.trim() ? '#fff' : colors.secondary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatBotScreen;
