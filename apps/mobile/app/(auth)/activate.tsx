import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import { parseSignInIdentifier } from '@inova/shared';
import { activate, postAuthRoute } from '../../src/api/client';
import { activationErrorMessage, IDENTIFIER_HINT } from '../../src/auth/messages';
import { AppBackground } from '../../src/components/AppBackground';
import { CodeInput, type CodeInputHandle } from '../../src/components/CodeInput';
import { GlassCircleButton } from '../../src/components/GlassCircleButton';
import { GlassView } from '../../src/components/GlassView';
import { GradientButton } from '../../src/components/GradientButton';
import { PressableScale } from '../../src/components/PressableScale';
import { BrandLockup } from '../../src/components/InovaLogo';
import { TextField } from '../../src/components/TextField';
import { metrics, rs } from '../../src/theme/responsive';
import { glass, palette } from '../../src/theme/tokens';

const CODE_LENGTH = 6;

export default function Activate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<CodeInputHandle>(null);
  const scrollRef = useRef<ScrollView>(null);

  // The code boxes sit at the bottom of the form; the OS only scrolls a focused
  // input into view on iOS, and here that input is a hidden 1pt field.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (error) scrollRef.current?.scrollToEnd({ animated: true });
  }, [error]);

  const submit = async () => {
    const who = parseSignInIdentifier(identifier);
    if (!who) {
      setError(IDENTIFIER_HINT);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await activate(who, code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(postAuthRoute(session));
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(activationErrorMessage(e));
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
          ref={scrollRef}
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
            <View style={styles.topBarSpacer} />
          </View>

          <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.header}>
            <Text style={styles.title}>Въведете код{'\n'}за покана</Text>
            <View style={styles.titleDash} />
            <Text style={styles.subtitle}>
              Вашият домоуправител е регистрирал апартамента ви. Изпратихме {CODE_LENGTH}-цифрен код
              чрез SMS или Viber. Въведете телефона или имейла, на който го получихте, и кода.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.form}>
            <TextField
              label="Телефон или имейл"
              icon="person-outline"
              placeholder="0888 123 456 или you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              keyboardType="email-address"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => codeRef.current?.focus()}
              value={identifier}
              onChangeText={(next) => {
                setIdentifier(next);
                if (error) setError(null);
              }}
            />
            <GlassView contentStyle={styles.codeCard}>
              <Text style={styles.codeLabel}>Код за покана</Text>
              <CodeInput
                ref={codeRef}
                length={CODE_LENGTH}
                value={code}
                onChange={(next) => {
                  setCode(next);
                  if (error) setError(null);
                }}
              />
              <View style={styles.resendRow}>
                <Text style={styles.resendHint}>Не получихте код?</Text>
                <PressableScale
                  haptic={false}
                  onPress={() => router.push('/resend-code')}
                  accessibilityRole="button"
                  accessibilityLabel="Изпрати код отново"
                >
                  <Text style={styles.resendAction}>Изпрати отново</Text>
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
            disabled={identifier.trim().length === 0 || code.length !== CODE_LENGTH}
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
  topBarSpacer: {
    width: rs(46, 42),
    height: rs(46, 42),
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
  form: {
    gap: rs(18, 14),
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
