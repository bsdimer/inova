import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, activate } from '../../src/api/client';
import { CodeInput } from '../../src/components/CodeInput';
import { GradientButton } from '../../src/components/GradientButton';
import { PressableScale } from '../../src/components/PressableScale';
import { useTheme } from '../../src/theme/ThemeContext';
import { metrics, rs } from '../../src/theme/responsive';
import { palette } from '../../src/theme/tokens';

const CODE_LENGTH = 6;

export default function Activate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await activate(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/home');
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Invalid or expired code. Ask your house manager for a new one.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong',
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = () => {
    if (resent) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResent(true);
    // TODO(M1): needs a phone-entry step — POST /v1/auth/resend-code is live but
    // requires the phone number the manager registered. UI-only for now.
    setTimeout(() => setResent(false), 4000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + rs(16, 8) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PressableScale
            haptic={false}
            onPress={() => router.back()}
            style={[styles.back, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </PressableScale>

          <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Enter your invite code
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your house manager has registered your apartment. We sent a {CODE_LENGTH}-digit
              code to your phone by SMS or Viber.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(420).delay(200)}>
            <CodeInput
              length={CODE_LENGTH}
              value={code}
              onChange={(next) => {
                setCode(next);
                if (error) setError(null);
              }}
            />
          </Animated.View>

          {error ? (
            <Animated.Text
              entering={FadeIn.duration(200)}
              style={[styles.error, { color: colors.danger }]}
            >
              {error}
            </Animated.Text>
          ) : null}

          <Animated.View entering={FadeInUp.duration(420).delay(280)} style={styles.resendRow}>
            <Text style={[styles.resendHint, { color: colors.textSecondary }]}>
              Didn't get a code?
            </Text>
            <PressableScale haptic={false} onPress={resend} accessibilityRole="button">
              <Text
                style={[
                  styles.resendAction,
                  { color: resent ? colors.success : colors.primary },
                ]}
              >
                {resent ? 'Code sent again ✓' : 'Resend code'}
              </Text>
            </PressableScale>
          </Animated.View>
        </ScrollView>

        <Animated.View
          entering={FadeInUp.duration(450).delay(320)}
          style={[styles.cta, { paddingBottom: insets.bottom + rs(20, 14) }]}
        >
          <GradientButton
            label="Activate account"
            onPress={submit}
            loading={loading}
            disabled={code.length !== CODE_LENGTH}
          />
          <PressableScale
            haptic={false}
            onPress={() => router.replace('/home')}
            style={styles.skip}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
          </PressableScale>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: metrics.screenPadding,
    gap: rs(28, 20),
  },
  back: {
    width: rs(44, 40),
    height: rs(44, 40),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.navy,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    gap: rs(12, 8),
  },
  title: {
    fontSize: metrics.titleSize,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: metrics.subtitleSize,
    lineHeight: rs(24, 21),
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(8, 6),
  },
  resendHint: {
    fontSize: metrics.bodySize,
  },
  resendAction: {
    fontSize: metrics.bodySize,
    fontWeight: '700',
  },
  error: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
    textAlign: 'center',
  },
  cta: {
    paddingHorizontal: metrics.screenPadding,
    paddingTop: rs(12, 8),
    gap: rs(14, 10),
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: rs(6, 4),
    paddingHorizontal: rs(12, 10),
  },
  skipText: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
  },
});
