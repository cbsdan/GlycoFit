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
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [skip, setSkip] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const flatListRef = useRef(null);

  // Initial load of chat history
  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await api.getChatbotHistory(0, 20);
      
      if (response.success && response.messages) {
        // Convert API messages to component format and reverse for display (oldest first)
        const formattedMessages = response.messages.reverse().map((msg) => ({
          id: msg._id,
          userText: msg.user_message,
          botText: msg.bot_response,
          timestamp: new Date(msg.created_at),
        }));
        
        setMessages(formattedMessages);
        setTotalMessages(response.total);
        setSkip(response.limit);
        setHasMoreMessages(response.limit + 20 < response.total);
        
        // Scroll to bottom after loading
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // Show greeting if history load fails
      const greeting = {
        id: Date.now().toString(),
        userText: null,
        botText: `Hi ${user?.first_name || 'there'}! 👋 I'm your GlycoFit health assistant. How can I help you today?`,
        timestamp: new Date(),
      };
      setMessages([greeting]);
      
      // Scroll to bottom after loading
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMoreMessages || isLoadingHistory) return;

    try {
      setIsLoadingHistory(true);
      const response = await api.getChatbotHistory(skip, 20);
      
      if (response.success && response.messages && response.messages.length > 0) {
        // Convert API messages and reverse them
        const formattedMessages = response.messages.reverse().map((msg) => ({
          id: msg._id,
          userText: msg.user_message,
          botText: msg.bot_response,
          timestamp: new Date(msg.created_at),
        }));
        
        setMessages((prev) => [...formattedMessages, ...prev]);
        setSkip(skip + response.limit);
        setHasMoreMessages(skip + 20 < response.total);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      userText: inputText.trim(),
      botText: null,
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
          userText: null,
          botText: response.response,
          timestamp: new Date(response.timestamp),
        };
        setMessages((prev) => [...prev, botMessage]);
        setTotalMessages(totalMessages + 1);
        
        // Scroll to bottom after API response
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        // Fallback response on error
        const botMessage = {
          id: (Date.now() + 1).toString(),
          userText: null,
          botText: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        
        // Scroll to bottom after response
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message to chatbot:', error);
      // Fallback response on error
      const botMessage = {
        id: (Date.now() + 1).toString(),
        userText: null,
        botText: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
      
      // Scroll to bottom after response
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } finally {
      setIsTyping(false);
    }
  };

  const quickReplies = [
    { id: '1', text: 'What is a good breakfast meal plan?', icon: 'food' },
  ];

  const handleQuickReply = (text) => {
    setInputText(text);
  };

  const renderMessage = ({ item }) => (
    <View>
      {/* User Message */}
      {item.userText && (
        <View style={styles.messageContainer}>
          <View
            style={[
              styles.messageBubble,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: '#fff' },
              ]}
            >
              {item.userText}
            </Text>
            <Text
              style={[
                styles.timestamp,
                { color: 'rgba(255,255,255,0.7)' },
              ]}
            >
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={[styles.avatarContainer, { backgroundColor: colors.secondary }]}>
            <Icon name="account" size={20} color="#fff" />
          </View>
        </View>
      )}

      {/* Bot Message */}
      {item.botText && (
        <View style={[styles.messageContainer, { justifyContent: 'flex-start' }]}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
            <Icon name="robot" size={20} color="#fff" />
          </View>
          
          <View
            style={[
              styles.messageBubble,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: colors.text },
              ]}
            >
              {item.botText}
            </Text>
            <Text
              style={[
                styles.timestamp,
                { color: colors.secondary },
              ]}
            >
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const handleEndReached = () => {
    if (hasMoreMessages && !isLoadingHistory) {
      loadMoreMessages();
    }
  };

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
      marginTop: 4,
    },
    headerIcon: {
      marginLeft: 12,
    },
    messagesList: {
      paddingVertical: 16,
    },
    messageContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginHorizontal: 12,
      marginVertical: 8,
      justifyContent: 'flex-end',
    },
    avatarContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 8,
    },
    messageBubble: {
      maxWidth: '75%',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    timestamp: {
      fontSize: 12,
      marginTop: 4,
    },
    typingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 12,
      marginVertical: 8,
    },
    typingBubble: {
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickRepliesContainer: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    quickRepliesTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.secondary,
      marginBottom: 8,
    },
    quickRepliesScroll: {
      flexDirection: 'row',
      gap: 8,
    },
    quickReplyButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      borderRadius: 20,
    },
    quickReplyText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '500',
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
    loadingContainer: {
      padding: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    paginationText: {
      textAlign: 'center',
      color: colors.secondary,
      fontSize: 12,
      marginVertical: 12,
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
            {isTyping ? 'Typing...' : totalMessages > 0 ? `${totalMessages} messages` : 'Always here to help'}
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
        {isLoadingHistory && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.paginationText, { marginTop: 12 }]}>Loading chat history...</Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              ListHeaderComponent={
                hasMoreMessages && messages.length > 0 ? (
                  <TouchableOpacity
                    onPress={loadMoreMessages}
                    style={styles.loadingContainer}
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Icon name="chevron-up" size={24} color={colors.primary} />
                        <Text style={styles.paginationText}>Load earlier messages</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null
              }
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
            {messages.length === 0 && (
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
          </>
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
