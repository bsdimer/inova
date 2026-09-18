import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, setPassword } from '../../src/api/client';
import { useRequireAuth } from '../../src/auth/AuthProvider';
import { AppBackground } from '../../src/components/AppBackground';
import { GlassCircleButton } from '../../src/components/GlassCircleButton';
import { GradientButton } from '../../src/components/GradientButton';
import { TextField } from '../../src/components/TextField';
import { metrics, rs } from '../../src/theme/responsive';
import { glass, palette } from '../../src/theme/tokens';

const MIN_PASSWORD_LENGTH = 8;

export default function SetPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, session, signOut } = useRequireAuth('/');
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session && !session.user.mustSetPassword) {
      router.replace('/home');
    }
  }, [status, session, router]);

  if (status !== 'authenticated') {
    return <View style={styles.container} />;
  }

  const canSubmit =
    password.length >= MIN_PASSWORD_LENGTH && confirm.length >= MIN_PASSWORD_LENGTH && !loading;

  const submit = async () => {
    if (password !== confirm) {
      setError('Паролите не съвпадат.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Паролата трябва да е поне ${MIN_PASSWORD_LENGTH} символа.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await setPassword(password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/home');
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Сесията изтече. Влезте отново.'
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
              onPress={() => {
                void signOut().finally(() => router.replace('/'));
              }}
              accessibilityLabel="Изход"
            />
          </View>

          <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.header}>
            <Text style={styles.title}>Създайте{'\n'}парола</Text>
            <View style={styles.titleDash} />
            <Text style={styles.subtitle}>
              Изберете парола с поне {MIN_PASSWORD_LENGTH} символа, за да влизате в приложението.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.form}>
            <TextField
              label="Парола"
              icon="lock-closed-outline"
              placeholder="Нова парола"
              secure
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={(next) => {
                setPasswordValue(next);
                if (error) setError(null);
              }}
            />
            <TextField
              label="Потвърдете паролата"
              icon="lock-closed-outline"
              placeholder="Повторете паролата"
              secure
              autoComplete="new-password"
              textContentType="newPassword"
              value={confirm}
              onChangeText={(next) => {
                setConfirm(next);
                if (error) setError(null);
              }}
            />
            {error ? (
              <Animated.Text entering={FadeIn.duration(200)} style={styles.error}>
                {error}
              </Animated.Text>
            ) : null}
          </Animated.View>
        </ScrollView>

        <Animated.View
          entering={FadeInUp.duration(450).delay(320)}
          style={[styles.cta, { paddingBottom: insets.bottom + rs(20, 14) }]}
        >
          <GradientButton
            label="Запази и продължи"
            variant="dark"
            trailingIcon="arrow-forward"
            onPress={submit}
            loading={loading}
            disabled={!canSubmit}
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
  cta: {
    paddingHorizontal: metrics.screenPadding,
    paddingTop: rs(12, 8),
  },
});
