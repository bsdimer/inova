import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, activate } from '../../src/api/client';
import { AppBackground } from '../../src/components/AppBackground';
import { CodeInput } from '../../src/components/CodeInput';
import { GlassCircleButton } from '../../src/components/GlassCircleButton';
import { GlassView } from '../../src/components/GlassView';
import { GradientButton } from '../../src/components/GradientButton';
import { PressableScale } from '../../src/components/PressableScale';
import { BrandLockup } from '../../src/components/SosedoLogo';
import { metrics, rs } from '../../src/theme/responsive';
import { glass, palette } from '../../src/theme/tokens';

const CODE_LENGTH = 6;

export default function Activate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
          ? 'Невалиден или изтекъл код. Поискайте нов от домоуправителя си.'
          : e instanceof Error
            ? e.message
            : 'Нещо се обърка',
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
          <View style={styles.topBar}>
            <GlassCircleButton
              icon="arrow-back"
              onPress={() => router.back()}
              accessibilityLabel="Назад"
            />
            <BrandLockup align="center" />
            <GlassCircleButton
              icon="help"
              onPress={() => router.push('/how-to-pay')}
              accessibilityLabel="Помощ"
            />
          </View>

          <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.header}>
            <Text style={styles.title}>Въведете код{'\n'}за покана</Text>
            <View style={styles.titleDash} />
            <Text style={styles.subtitle}>
              Вашият домоуправител е регистрирал апартамента ви. Изпратихме {CODE_LENGTH}-цифрен код
              на телефона ви чрез SMS или Viber.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(420).delay(200)}>
            <GlassView contentStyle={styles.codeCard}>
              <Text style={styles.codeLabel}>Код за покана</Text>
              <CodeInput
                length={CODE_LENGTH}
                value={code}
                onChange={(next) => {
                  setCode(next);
                  if (error) setError(null);
                }}
              />
              <View style={styles.resendRow}>
                <Text style={styles.resendHint}>Не получихте код?</Text>
                <PressableScale haptic={false} onPress={resend} accessibilityRole="button">
                  <Text style={[styles.resendAction, resent && styles.resendDone]}>
                    {resent ? 'Кодът е изпратен ✓' : 'Изпрати отново'}
                  </Text>
                </PressableScale>
              </View>
            </GlassView>
          </Animated.View>

          {error ? (
            <Animated.Text entering={FadeIn.duration(200)} style={styles.error}>
              {error}
            </Animated.Text>
          ) : null}
        </ScrollView>

        <Animated.View
          entering={FadeInUp.duration(450).delay(320)}
          style={[styles.cta, { paddingBottom: insets.bottom + rs(20, 14) }]}
        >
          <GradientButton
            label="Активирай акаунта"
            variant="dark"
            trailingIcon="arrow-forward"
            onPress={submit}
            loading={loading}
            disabled={code.length !== CODE_LENGTH}
          />
          <GradientButton
            label="Пропусни засега"
            variant="glass"
            onPress={() => router.replace('/home')}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    marginTop: rs(28, 18),
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
    lineHeight: rs(25, 22),
    color: glass.textSecondary,
  },
  codeCard: {
    padding: rs(18, 15),
    gap: rs(16, 12),
  },
  codeLabel: {
    fontSize: rs(15, 14),
    color: glass.textSecondary,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(8, 6),
    paddingVertical: rs(2, 1),
  },
  resendHint: {
    fontSize: metrics.bodySize,
    color: glass.textSecondary,
  },
  resendAction: {
    fontSize: metrics.bodySize,
    fontWeight: '700',
    color: glass.textPrimary,
  },
  resendDone: {
    color: palette.orangeBright,
  },
  error: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
    textAlign: 'center',
    color: glass.danger,
  },
  cta: {
    paddingHorizontal: metrics.screenPadding,
    paddingTop: rs(12, 8),
    gap: rs(12, 9),
  },
});
