import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Linking,
  StatusBar,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import chatHub from '../services/ChatHubService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeInUp,
  Layout,
  ZoomIn,
  SlideInRight,
  SlideInLeft,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Header from '../components/Header';

const { width: SCREEN_W } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/* ─── Premium Brand Colors ─── */
const BRAND = {
  primary: '#FF991C',
  primaryLight: '#FFF2E0',
  primaryDark: '#E88500',
  gradient1: '#FF991C',
  gradient2: '#FFAF47',
  bg: '#F6F8FF',
  surface: '#FFFFFF',
  text: '#101828',
  textSecondary: '#475569',
  online: '#10B981', // Premium green
};

/* ────────────── Typing dots ────────────── */
const TypingIndicator = ({ dotColor }: { dotColor: string }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      dot1.value = withTiming(1, { duration: 400 });
      setTimeout(() => { dot2.value = withTiming(1, { duration: 400 }); }, 200);
      setTimeout(() => { dot3.value = withTiming(1, { duration: 400 }); }, 400);
      setTimeout(() => {
        dot1.value = withTiming(0, { duration: 400 });
        dot2.value = withTiming(0, { duration: 400 });
        dot3.value = withTiming(0, { duration: 400 });
      }, 800);
    };
    animate();
    const interval = setInterval(animate, 1600);
    return () => clearInterval(interval);
  }, []);

  const s1 = useAnimatedStyle(() => ({
    opacity: interpolate(dot1.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot1.value, [0, 1], [0, -4]) }]
  }));
  const s2 = useAnimatedStyle(() => ({
    opacity: interpolate(dot2.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot2.value, [0, 1], [0, -4]) }]
  }));
  const s3 = useAnimatedStyle(() => ({
    opacity: interpolate(dot3.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot3.value, [0, 1], [0, -4]) }]
  }));

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.typingRow}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, s1]} />
        <Animated.View style={[styles.typingDot, s2]} />
        <Animated.View style={[styles.typingDot, s3]} />
      </View>
    </Animated.View>
  );
};

/* ────────────── Empty state ────────────── */
const EmptyState = ({ customerName, t, brandPrimary }: { customerName: string; t: any; brandPrimary: string }) => (
  <View style={styles.emptyContainer}>
    <View style={[styles.emptyIconCircle, { backgroundColor: `${brandPrimary}15` }]}>
      <Ionicons name="chatbubbles-outline" size={44} color={brandPrimary} />
    </View>
    <Text style={styles.emptyTitle}>{t('start_conversation') || 'Start a conversation'}</Text>
    <Text style={styles.emptySubtitle}>
      {t('send_first_message') || `Send a message to ${customerName || 'your customer'}!`}
    </Text>
  </View>
);

/* ────────────── Main screen ────────────── */
const ChatScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { showError } = useUI();
  const { rideId, customerName, profilePicUrl, phoneNumber } = route.params as any;
  const { t } = useTranslation();
  const { isFemale } = useTheme();

  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  const currentUserId = user?.id;
  const chatPrimary = isFemale ? '#FF69B4' : BRAND.primary;
  const chatPrimaryLight = isFemale ? '#FFE1F1' : BRAND.primaryLight;
  const chatGradientEnd = isFemale ? '#FFAFD6' : BRAND.gradient2;

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const sendScale = useSharedValue(1);

  /* ── init ── */
  useEffect(() => {
    const init = async () => {
      // Non-blocking hub start
      chatHub.start().then(() => chatHub.joinRideChat(rideId));

      try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.tezride.pk';
        const endpoint = `${apiUrl}/api/conversation/history/${rideId}`;
        console.log(`[ChatScreen] Loading history from: ${endpoint}`);

        const token = await AsyncStorage.getItem('token');
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const text = await res.text();
          if (text) {
            const json = JSON.parse(text);
            if (json.succeeded && json.data) {
              setMessages(json.data.reverse());
            }
          }
        }
      } catch (e) {
        console.error('[ChatScreen] history error', e);
      } finally {
        setLoading(false);
      }
    };
    init();

    const onMsg = (p: any) => {
      const pRideId = p.rideId || p.RideId;
      if (String(pRideId) === String(rideId)) {
        setMessages(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          senderId: p.senderId || p.SenderId || p.userId || p.UserId,
          content: p.content || p.Content || p.text || p.Text,
          timestamp: p.timestamp || p.Timestamp || new Date().toISOString()
        }]);
        setIsTyping(false);
      }
    };

    const onTyping = (p: any) => {
      const pRideId = p.rideId || p.RideId;
      const pUserId = p.userId || p.UserId;
      if (String(pRideId) === String(rideId) && String(pUserId) !== String(currentUserId)) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    };

    chatHub.on('ReceiveMessage', onMsg);
    chatHub.on('UserTyping', onTyping);
    return () => {
      chatHub.off('ReceiveMessage', onMsg);
      chatHub.off('UserTyping', onTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [rideId, currentUserId]);

  /* ── actions ── */
  const sendMessage = useCallback(async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');

    sendScale.value = withSpring(0.85, {}, () => {
      sendScale.value = withSpring(1);
    });

    await chatHub.sendMessage(rideId, text);
  }, [inputText, rideId]);

  const onTextChange = useCallback((text: string) => {
    setInputText(text);
    chatHub.typing(rideId);
  }, [rideId]);

  const handleCall = () => {
    if (phoneNumber) {
      let dialNum = phoneNumber.toString();
      if (dialNum.startsWith('92')) {
        dialNum = '0' + dialNum.substring(2);
      }
      Linking.openURL(`tel:${dialNum}`).catch(err => {
        console.warn("Dial error", err);
      });
    } else {
      showError("Not Available", "Customer phone number is not available.");
    }
  };

  /* ── helpers ── */
  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const shouldShowTimestamp = (index: number) => {
    if (index === 0) return true;
    return new Date(messages[index].timestamp).getTime()
      - new Date(messages[index - 1].timestamp).getTime() > 600000;
  };

  const isConsecutive = (index: number) => {
    if (index === 0) return false;
    return String(messages[index].senderId).toLowerCase() === String(messages[index - 1].senderId).toLowerCase()
      && !shouldShowTimestamp(index);
  };

  /* ── render message ── */
  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const isMe = String(item.senderId).toLowerCase() === String(currentUserId).toLowerCase();
    const consecutive = isConsecutive(index);
    const showTime = shouldShowTimestamp(index);

    // Premium Spring entering animation springing up from input box
    const entering = isMe
      ? FadeInUp.springify().damping(15).mass(0.8)
      : SlideInLeft.delay(30).springify().damping(18);

    return (
      <View key={item.id}>
        {showTime && (
          <View style={styles.timeChipRow}>
            <View style={styles.timeChip}>
              <Text style={styles.timeChipText}>{formatTime(item.timestamp)}</Text>
            </View>
          </View>
        )}
        <Animated.View
          entering={entering}
          layout={Layout.springify().damping(20)}
          style={[
            styles.msgRow,
            isMe ? styles.msgRowRight : styles.msgRowLeft,
            consecutive && { marginTop: -2 }
          ]}
        >
          <View style={[
            styles.bubble,
            isMe ? [styles.bubbleMine, { backgroundColor: chatPrimary }] : styles.bubbleOther,
            consecutive && isMe && { borderTopRightRadius: 20 },
            consecutive && !isMe && { borderTopLeftRadius: 20 }
          ]}>
            <Text style={[styles.msgText, isMe && styles.msgTextMine]}>
              {item.content}
            </Text>
            <View style={styles.bubbleFooter}>
              <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMine]}>
                {formatTime(item.timestamp)}
              </Text>
              {isMe && (
                <Ionicons
                  name="checkmark-done"
                  size={15}
                  color="rgba(255,255,255,0.75)"
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }, [currentUserId, messages]);

  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }]
  }));

  const hasText = inputText.trim().length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <Header 
        title={customerName || (t('customer') === 'customer' ? 'Customer' : t('customer'))} 
        showBack={true} 
      />

      {/* ── Messages ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={styles.loadingLabel}>{t('loading') || 'Loading messages'}...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && { flex: 1 }
          ]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState customerName={customerName} t={t} brandPrimary={chatPrimary} />}
          ListFooterComponent={isTyping ? <TypingIndicator dotColor={chatPrimary} /> : null}
        />
      )}

      {/* ── Input Bar ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.inputBarOuter}>
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder={t('type_message') === 'type_message' ? 'Type a message...' : t('type_message')}
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={onTextChange}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity style={styles.emojiBtn} activeOpacity={0.6}>
              <Ionicons name="happy-outline" size={24} color="#64748B" />
            </TouchableOpacity>

            <AnimatedTouchable
              style={[styles.sendBtn, sendBtnStyle]}
              onPress={sendMessage}
              disabled={!hasText}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={hasText ? [chatPrimary, chatGradientEnd] : ['#E2E8F0', '#CBD5E1']}
                style={styles.sendGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="send" size={16} color="#FFF" style={{ marginLeft: 2 }} />
              </LinearGradient>
            </AnimatedTouchable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

/* ════════════════════════════ STYLES ════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  safeHeader: { backgroundColor: '#FFFFFF', zIndex: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCallBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF2E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#FFF' },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center' },
  statusDot: { position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: BRAND.online, borderWidth: 2.5, borderColor: '#FFF' },
  statusDotTyping: { backgroundColor: BRAND.primary },
  headerTextWrap: { marginLeft: 12, flex: 1 },
  headerName: { fontWeight: '800', fontSize: 17, color: BRAND.text },
  headerStatusText: { fontWeight: '600', fontSize: 12, color: BRAND.online, marginTop: 1 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingLabel: { fontWeight: '600', fontSize: 14, color: '#94A3B8', marginTop: 12 },
  listContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  emptyIconCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFF2E0', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontWeight: '800', fontSize: 20, color: BRAND.text, marginBottom: 8 },
  emptySubtitle: { fontWeight: '500', fontSize: 14, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 40 },
  timeChipRow: { alignItems: 'center', marginVertical: 20 },
  timeChip: { backgroundColor: 'rgba(15,23,42,0.06)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12 },
  timeChipText: { fontWeight: '700', fontSize: 11, color: '#64748B' },
  msgRow: { flexDirection: 'row', marginBottom: 14 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: SCREEN_W * 0.8, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 26, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  bubbleMine: { backgroundColor: BRAND.primary, borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  msgText: { fontWeight: '600', fontSize: 15, lineHeight: 22, color: BRAND.text },
  msgTextMine: { color: '#FFFFFF' },
  bubbleFooter: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', marginTop: 4 },
  bubbleTime: { fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.8)' },
  typingRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND.primary, marginHorizontal: 2 },
  inputBarOuter: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  inputBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 30, paddingLeft: 20, paddingRight: 6, paddingVertical: 6, borderWidth: 1.5, borderColor: '#E2E8F0' },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: BRAND.text, maxHeight: 120, minHeight: 40 },
  emojiBtn: { padding: 10, marginRight: 4 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
});

export default ChatScreen;
