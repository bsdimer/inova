import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseSignInIdentifier, type RecoveryStarted } from '@inova/shared';
import { requestRecovery } from '../../src/api/client';
import { recoveryRequestErrorMessage } from '../../src/auth/messages';
import { AppBackground } from '../../src/components/AppBackground';
import { GlassCircleButton } from '../../src/components/GlassCircleButton';
import { GlassView } from '../../src/components/GlassView';
import { GradientButton } from '../../src/components/GradientButton';
import { PressableScale } from '../../src/components/PressableScale';
import { TextField } from '../../src/components/TextField';
import { metrics, rs } from '../../src/theme/responsive';
import { glass, palette } from '../../src/theme/tokens';

type Channel = 'email' | 'phone';

const EMAIL_HINT = 'Въведете имейл адрес, например you@example.com.';
const PHONE_HINT = 'Въведете телефон (08… или +359…).';

/** What the sign-in screen already holds decides where recovery starts; e-mail by default (B13). */
function startFrom(prefill: string | undefined): { channel: Channel; value: string } {
  const who = prefill ? parseSignInIdentifier(prefill) : null;
  if (who?.kind === 'phone') return { channel: 'phone', value: prefill!.trim() };
  if (who?.kind === 'email') return { channel: 'email', value: who.email };
  return { channel: 'email', value: '' };
}

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const [start] = useState(() => startFrom(params.identifier));
  const [channel, setChannel] = useState<Channel>(start.channel);
  const [value, setValue] = useState(start.value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState<RecoveryStarted | null>(null);
  const hint = channel === 'email' ? EMAIL_HINT : PHONE_HINT;

  const switchChannel = () => {
    setChannel((current) => (current === 'email' ? 'phone' : 'email'));
    setValue('');
    setError(null);
    setLinkSent(null);
  };

  const submit = async () => {
    const who = parseSignInIdentifier(value);
    if (who?.kind !== channel) {
      setError(hint);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const started = await requestRecovery(who);
      if (who.kind === 'phone') {
        router.push({
          pathname: '/reset',
          params: { phone: who.phone, minutes: String(started.expiresInMinutes) },
        });
      } else {
        // Nothing left to type; the answer card sits where the keyboard was.
        Keyboard.dismiss();
        setLinkSent(started);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(recoveryRequestErrorMessage(e, hint));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppBackground variant="blur" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + rs(16, 8) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backRow}>
            <GlassCircleButton
              icon="arrow-back"
              onPress={() => router.back()}
              accessibilityLabel="Назад"
            />
          </View>

          <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.header}>
            <Text style={styles.title}>Забравена{'\n'}парола</Text>
            <View style={styles.titleDash} />
            <Text style={styles.subtitle}>
              {channel === 'email'
                ? 'Въведете имейла на профила си. Ще ви изпратим линк, с който да зададете нова парола.'
                : 'Въведете телефона на профила си. Ще ви изпратим код по SMS, с който да зададете нова парола.'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.form}>
            {channel === 'email' ? (
              <TextField
                key="email"
                label="Имейл"
                icon="mail-outline"
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (value.trim() && !loading) void submit();
                }}
                value={value}
                onChangeText={(next) => {
                  setValue(next);
                  if (error) setError(null);
                  if (linkSent) setLinkSent(null);
                }}
              />
            ) : (
              <TextField
                key="phone"
                label="Телефон"
                icon="call-outline"
                placeholder="0888 123 456"
                autoComplete="tel"
                textContentType="telephoneNumber"
                keyboardType="phone-pad"
                value={value}
                onChangeText={(next) => {
                  setValue(next);
                  if (error) setError(null);
                }}
              />
            )}

            <PressableScale
              haptic={false}
              onPress={switchChannel}
              style={styles.switch}
              accessibilityRole="button"
            >
              <Text style={styles.switchText}>
                {channel === 'email' ? 'Възстановяване с телефон' : 'Възстановяване с имейл'}
              </Text>
            </PressableScale>

            {error ? (
              <Animated.Text
                entering={FadeIn.duration(200)}
                style={styles.error}
                accessibilityLiveRegion="polite"
              >
                {error}
              </Animated.Text>
            ) : null}

            {linkSent ? (
              <Animated.View entering={FadeIn.duration(240)}>
                <GlassView contentStyle={styles.sentCard}>
                  <Text style={styles.sentTitle}>Проверете пощата си</Text>
                  <Text style={styles.sentText} accessibilityLiveRegion="polite">
                    Ако има профил с този имейл, изпратихме линк за нова парола. Линкът важи{' '}
                    {linkSent.expiresInMinutes} минути. Отворете го на този телефон и изберете
                    «Отвори в приложението».
                  </Text>
                </GlassView>
              </Animated.View>
            ) : null}
          </Animated.View>
        </ScrollView>

        <Animated.View
          entering={FadeInUp.duration(450).delay(320)}
          style={[styles.cta, { paddingBottom: insets.bottom + rs(20, 14) }]}
        >
          <GradientButton
            label={linkSent ? 'Към входа' : channel === 'email' ? 'Изпрати линк' : 'Изпрати код'}
            variant="dark"
            trailingIcon={linkSent ? 'checkmark' : 'arrow-forward'}
            onPress={linkSent ? () => router.back() : submit}
            loading={loading}
            disabled={!linkSent && value.trim().length === 0}
          />
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
  backRow: {
    alignSelf: 'flex-start',
  },
  header: {
    gap: rs(16, 12),
  },
  title: {
    fontSize: rs(36, 31),
    lineHeight: rs(42, 37),
    fontWeight: '800',
    letterSpacing: -0.5,
    color: glass.textPrimary,
  },
  titleDash: {
    width: rs(38, 32),
    height: rs(4, 4),
    borderRadius: 2,
    backgroundColor: palette.orange,
  },
  subtitle: {
    fontSize: metrics.subtitleSize,
    lineHeight: rs(24, 21),
    color: glass.textSecondary,
  },
  form: {
    gap: rs(18, 14),
  },
  switch: {
    alignSelf: 'flex-end',
  },
  switchText: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
    color: glass.textPrimary,
  },
  error: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
    textAlign: 'center',
    color: glass.danger,
  },
  sentCard: {
    padding: rs(18, 15),
    gap: rs(8, 6),
  },
  sentTitle: {
    fontSize: rs(17, 16),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  sentText: {
    fontSize: metrics.bodySize,
    lineHeight: rs(22, 20),
    color: glass.textSecondary,
  },
  cta: {
    paddingHorizontal: metrics.screenPadding,
    paddingTop: rs(12, 8),
  },
});
