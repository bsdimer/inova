import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, login } from '../../src/api/client';
import { AppBackground } from '../../src/components/AppBackground';
import { GlassCircleButton } from '../../src/components/GlassCircleButton';
import { GradientButton } from '../../src/components/GradientButton';
import { PressableScale } from '../../src/components/PressableScale';
import { TextField } from '../../src/components/TextField';
import { metrics, rs } from '../../src/theme/responsive';
import { glass, palette } from '../../src/theme/tokens';

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/home');
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Грешен имейл или парола.'
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
            <Text style={styles.title}>Добре дошли{'\n'}отново</Text>
            <View style={styles.titleDash} />
            <Text style={styles.subtitle}>Влезте, за да видите своята сграда, такси и съседи.</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.form}>
            <TextField
              label="Имейл"
              icon="mail-outline"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label="Парола"
              icon="lock-closed-outline"
              placeholder="Вашата парола"
              secure
              value={password}
              onChangeText={setPassword}
            />
            <PressableScale haptic={false} onPress={() => {}} style={styles.forgot}>
              <Text style={styles.forgotText}>Забравена парола?</Text>
            </PressableScale>
            {error ? (
              <Animated.Text entering={FadeIn.duration(200)} style={styles.error}>
                {error}
              </Animated.Text>
            ) : null}
          </Animated.View>
        </ScrollView>

        {/* CTA fades up gently and stays above the keyboard */}
        <Animated.View
          entering={FadeInUp.duration(450).delay(320)}
          style={[styles.cta, { paddingBottom: insets.bottom + rs(20, 14) }]}
        >
          <GradientButton
            label="Вход"
            variant="dark"
            trailingIcon="arrow-forward"
            onPress={submit}
            loading={loading}
            disabled={email.length === 0 || password.length === 0}
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
  forgot: {
    alignSelf: 'flex-end',
  },
  forgotText: {
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
  cta: {
    paddingHorizontal: metrics.screenPadding,
    paddingTop: rs(12, 8),
  },
});
