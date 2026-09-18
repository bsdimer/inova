import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, resendCode, toE164Phone } from '../../src/api/client';
import { AppBackground } from '../../src/components/AppBackground';
import { GlassCircleButton } from '../../src/components/GlassCircleButton';
import { GradientButton } from '../../src/components/GradientButton';
import { TextField } from '../../src/components/TextField';
import { metrics, rs } from '../../src/theme/responsive';
import { glass, palette } from '../../src/theme/tokens';

export default function ResendCode() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const e164 = toE164Phone(phone);
    if (!e164) {
      setError('Въведете телефон в формат +359… или 08…');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Always show the same success copy — the API never discloses whether the
      // phone exists (enumeration-safe).
      await resendCode(e164);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        e instanceof ApiError && e.status === 0
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Нещо се обърка',
      );
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
            <Text style={styles.title}>Изпрати код{'\n'}отново</Text>
            <View style={styles.titleDash} />
            <Text style={styles.subtitle}>
              Въведете телефона, с който домоуправителят е регистрирал апартамента. Ако има активна
              покана, ще получите нов код по SMS или Viber.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.form}>
            <TextField
              label="Телефон"
              icon="call-outline"
              placeholder="+359 88 100 0001"
              autoCapitalize="none"
              autoComplete="tel"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              value={phone}
              onChangeText={(next) => {
                setPhone(next);
                if (error) setError(null);
                if (sent) setSent(false);
              }}
            />
            {error ? (
              <Animated.Text entering={FadeIn.duration(200)} style={styles.error}>
                {error}
              </Animated.Text>
            ) : null}
            {sent ? (
              <Animated.Text entering={FadeIn.duration(200)} style={styles.success}>
                Ако номерът е регистриран, новият код е изпратен.
              </Animated.Text>
            ) : null}
          </Animated.View>
        </ScrollView>

        <Animated.View
          entering={FadeInUp.duration(450).delay(320)}
          style={[styles.cta, { paddingBottom: insets.bottom + rs(20, 14) }]}
        >
          <GradientButton
            label={sent ? 'Готово' : 'Изпрати код'}
            variant="dark"
            trailingIcon={sent ? 'checkmark' : 'arrow-forward'}
            onPress={sent ? () => router.back() : submit}
            loading={loading}
            disabled={!sent && phone.trim().length === 0}
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
    height: 4,
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
  error: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
    textAlign: 'center',
    color: glass.danger,
  },
  success: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
    textAlign: 'center',
    color: palette.orangeBright,
  },
  cta: {
    paddingHorizontal: metrics.screenPadding,
    paddingTop: rs(12, 8),
  },
});
