import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSession, logout } from '../src/api/client';
import { GradientButton } from '../src/components/GradientButton';
import { PressableScale } from '../src/components/PressableScale';
import { useTheme } from '../src/theme/ThemeContext';
import { metrics, rs } from '../src/theme/responsive';
import { gradients, palette, radius } from '../src/theme/tokens';

// Mock data until the billing/notices APIs land (M3/M7).
const MOCK = {
  residentName: 'Maria',
  apartment: 'Apt 12 · Entrance B · Iztok 24',
  outstanding: '86.40',
  currency: 'BGN',
  dueDate: 'Sep 5',
  iban: 'BG80 BNBG 9661 1020 3456 78',
  reference: 'SOS-0012-2026-08',
  notices: [
    {
      id: '1',
      category: 'Maintenance',
      color: palette.blue,
      title: 'Elevator inspection on Tuesday',
      time: '2h ago',
      icon: 'construct-outline' as const,
    },
    {
      id: '2',
      category: 'Community',
      color: palette.green,
      title: 'Courtyard cleanup this Saturday',
      time: 'Yesterday',
      icon: 'leaf-outline' as const,
    },
    {
      id: '3',
      category: 'Finance',
      color: palette.purple,
      title: 'August building report is ready',
      time: '2d ago',
      icon: 'document-text-outline' as const,
    },
  ],
};

const QUICK_ACTIONS = [
  { id: 'pay', label: 'Payments', icon: 'card-outline' as const, tint: palette.blue },
  { id: 'issue', label: 'Report issue', icon: 'camera-outline' as const, tint: palette.green },
  { id: 'notices', label: 'Notices', icon: 'notifications-outline' as const, tint: palette.purple },
  { id: 'building', label: 'My building', icon: 'business-outline' as const, tint: palette.navy },
];

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const copyIban = async () => {
    await Clipboard.setStringAsync(MOCK.iban.replaceAll(' ', ''));
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + rs(20, 12), paddingBottom: insets.bottom + rs(32, 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.headerRow}>
          <View>
            <Text style={[styles.hello, { color: colors.textSecondary }]}>Good afternoon,</Text>
            <Text style={[styles.name, { color: colors.textPrimary }]}>
              {getSession()?.user.fullName.split(' ')[0] ?? MOCK.residentName}
            </Text>
            <Text style={[styles.apartment, { color: colors.textSecondary }]}>
              {MOCK.apartment}
            </Text>
          </View>
          <PressableScale
            haptic={false}
            onPress={() => {
              // TODO(M5): profile screen — for now this signs out.
              void logout().finally(() => router.replace('/'));
            }}
            style={[styles.avatar, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Ionicons name="log-out-outline" size={rs(22, 20)} color={colors.primary} />
          </PressableScale>
        </Animated.View>

        {/* Balance card */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)}>
          <LinearGradient
            colors={isDark ? gradients.card : gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <View style={styles.balanceTop}>
              <Text style={styles.balanceLabel}>Outstanding balance</Text>
              <View style={styles.dueChip}>
                <Ionicons name="time-outline" size={13} color={palette.white} />
                <Text style={styles.dueChipText}>Due {MOCK.dueDate}</Text>
              </View>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceValue}>{MOCK.outstanding}</Text>
              <Text style={styles.balanceCurrency}>{MOCK.currency}</Text>
            </View>

            <PressableScale
              onPress={copyIban}
              style={styles.ibanRow}
              accessibilityRole="button"
              accessibilityLabel="Copy IBAN"
            >
              <View style={styles.ibanText}>
                <Text style={styles.ibanLabel}>IBAN · ref {MOCK.reference}</Text>
                <Text style={styles.ibanValue}>{MOCK.iban}</Text>
              </View>
              <View style={[styles.copyBadge, copied && { backgroundColor: palette.green }]}>
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={15}
                  color={palette.white}
                />
                <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
              </View>
            </PressableScale>

            <GradientButton label="Pay now" onPress={() => {}} style={styles.payButton} />
          </LinearGradient>
        </Animated.View>

        {/* Quick actions */}
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action, i) => (
            <Animated.View
              key={action.id}
              entering={FadeInUp.duration(380).delay(260 + i * 90)}
              style={styles.actionCell}
            >
              <PressableScale
                onPress={() => {}}
                style={[styles.actionCard, { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${action.tint}1A` }]}>
                  <Ionicons name={action.icon} size={rs(24, 22)} color={action.tint} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
                  {action.label}
                </Text>
              </PressableScale>
            </Animated.View>
          ))}
        </View>

        {/* Notices */}
        <Animated.View entering={FadeInUp.duration(400).delay(600)} style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notices</Text>
          <PressableScale haptic={false} onPress={() => {}}>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>See all</Text>
          </PressableScale>
        </Animated.View>

        <View style={styles.noticeList}>
          {MOCK.notices.map((notice, i) => (
            <Animated.View key={notice.id} entering={FadeInUp.duration(380).delay(680 + i * 100)}>
              <PressableScale
                haptic={false}
                onPress={() => {}}
                style={[styles.noticeCard, { backgroundColor: colors.surface }]}
              >
                <View style={[styles.noticeIcon, { backgroundColor: `${notice.color}1A` }]}>
                  <Ionicons name={notice.icon} size={rs(20, 18)} color={notice.color} />
                </View>
                <View style={styles.noticeBody}>
                  <Text style={[styles.noticeCategory, { color: notice.color }]}>
                    {notice.category}
                  </Text>
                  <Text
                    style={[styles.noticeTitle, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {notice.title}
                  </Text>
                </View>
                <Text style={[styles.noticeTime, { color: colors.textSecondary }]}>
                  {notice.time}
                </Text>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: metrics.screenPadding,
    gap: rs(22, 16),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hello: {
    fontSize: metrics.bodySize,
  },
  name: {
    fontSize: rs(28, 24),
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  apartment: {
    fontSize: metrics.captionSize,
    marginTop: 2,
  },
  avatar: {
    width: rs(48, 42),
    height: rs(48, 42),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.navy,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  balanceCard: {
    borderRadius: radius.lg,
    padding: rs(22, 18),
    gap: rs(16, 12),
    // Solid fallback so the card never flashes white before the gradient paints
    // during the entering animation.
    backgroundColor: palette.navy,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceLabel: {
    color: 'rgba(242,246,252,0.75)',
    fontSize: metrics.captionSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dueChipText: {
    color: palette.white,
    fontSize: rs(12, 11),
    fontWeight: '600',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  balanceValue: {
    color: palette.white,
    fontSize: rs(44, 38),
    fontWeight: '800',
    letterSpacing: -1,
  },
  balanceCurrency: {
    color: 'rgba(242,246,252,0.75)',
    fontSize: rs(18, 16),
    fontWeight: '600',
    marginBottom: rs(8, 6),
  },
  ibanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: rs(14, 12),
    gap: 10,
  },
  ibanText: {
    flex: 1,
    gap: 2,
  },
  ibanLabel: {
    color: 'rgba(242,246,252,0.6)',
    fontSize: rs(11, 10),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ibanValue: {
    color: palette.white,
    fontSize: rs(14, 12.5),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.blue,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  copyText: {
    color: palette.white,
    fontSize: rs(13, 12),
    fontWeight: '700',
  },
  payButton: {
    marginTop: rs(4, 2),
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(14, 10),
  },
  actionCell: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  actionCard: {
    borderRadius: radius.md,
    padding: rs(16, 13),
    gap: rs(12, 10),
    shadowColor: palette.navy,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  actionIcon: {
    width: rs(46, 40),
    height: rs(46, 40),
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: metrics.bodySize,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: rs(6, 2),
  },
  sectionTitle: {
    fontSize: rs(20, 18),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
  },
  noticeList: {
    gap: rs(12, 9),
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12, 10),
    borderRadius: radius.md,
    padding: rs(14, 12),
    shadowColor: palette.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  noticeIcon: {
    width: rs(40, 36),
    height: rs(40, 36),
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBody: {
    flex: 1,
    gap: 2,
  },
  noticeCategory: {
    fontSize: rs(11, 10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noticeTitle: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
  },
  noticeTime: {
    fontSize: metrics.captionSize,
  },
});
