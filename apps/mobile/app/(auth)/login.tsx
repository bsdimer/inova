import { Ionicons } from '@expo/vector-icons';
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
import { ApiError, login } from '../../src/api/client';
import { GradientButton } from '../../src/components/GradientButton';
import { PressableScale } from '../../src/components/PressableScale';
import { SosedoMark } from '../../src/components/SosedoLogo';
import { TextField } from '../../src/components/TextField';
import { useTheme } from '../../src/theme/ThemeContext';
import { metrics, rs } from '../../src/theme/responsive';
import { palette } from '../../src/theme/tokens';

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
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
          ? 'Wrong email or password.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + rs(16, 8) },
          ]}
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
            <SosedoMark size={rs(72, 60)} discColor={colors.surface} iconColor={colors.primary} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in to see your building, fees and neighbors.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.form}>
            <TextField
              label="Email"
              icon="mail-outline"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label="Password"
              icon="lock-closed-outline"
              placeholder="Your password"
              secure
              value={password}
              onChangeText={setPassword}
            />
            <PressableScale haptic={false} onPress={() => {}} style={styles.forgot}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>
                Forgot password?
              </Text>
            </PressableScale>
            {error ? (
              <Animated.Text
                entering={FadeIn.duration(200)}
                style={[styles.error, { color: colors.danger }]}
              >
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
            label="Sign in"
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
    alignItems: 'flex-start',
    gap: rs(14, 10),
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
  form: {
    gap: rs(18, 14),
  },
  forgot: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
  },
  error: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
    textAlign: 'center',
  },
  cta: {
    paddingHorizontal: metrics.screenPadding,
    paddingTop: rs(12, 8),
  },
});
