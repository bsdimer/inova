import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_PASSWORD_LENGTH, newPasswordProblem, recoveryFailure } from '@inova/shared';
import {
  ApiError,
  confirmRecovery,
  requestRecovery,
  type RecoveryProof,
} from '../../src/api/client';
import {
  newPasswordMessage,
  recoveryConfirmErrorMessage,
  recoveryRequestErrorMessage,
} from '../../src/auth/messages';
import { AppBackground } from '../../src/components/AppBackground';
import { CodeInput } from '../../src/components/CodeInput';
import { GlassCircleButton } from '../../src/components/GlassCircleButton';
import { GlassView } from '../../src/components/GlassView';
import { GradientButton } from '../../src/components/GradientButton';
import { PressableScale } from '../../src/components/PressableScale';
import { TextField } from '../../src/components/TextField';
import { metrics, rs } from '../../src/theme/responsive';
import { glass, palette } from '../../src/theme/tokens';

const CODE_LENGTH = 6;

/**
 * The new password after a recovery request (B13). Reached two ways: the
 * recovery e-mail's web page opens `inova://reset?token=…`, or the phone path
 * of «Забравена парола» pushes `phone` and the code's lifetime in `minutes`.
 */
export default function Reset() {
  const params = useLocalSearchParams<{ token?: string; phone?: string; minutes?: string }>();
  const token = params.token || undefined;
  const phone = token ? undefined : params.phone || undefined;
  // A second link opened over this screen reuses it with new params; start that one clean.
  return (
    <ResetForm
      key={token ?? phone ?? 'none'}
      token={token}
      phone={phone}
      minutes={params.minutes}
    />
  );
}

function ResetForm({
  token,
  phone,
  minutes,
}: {
  token?: string;
  phone?: string;
  minutes?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const via = token ? 'link' : phone ? 'code' : null;

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkRefused, setLinkRefused] = useState(false);
  const [resent, setResent] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const repeatRef = useRef<TextInput>(null);

  useEffect(() => {
    if (error) scrollRef.current?.scrollToEnd({ animated: true });
  }, [error]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const askAgain = () => router.replace('/forgot-password');
  const toLogin = () => router.dismissTo('/login');

  const clearError = () => {
    if (error) setError(null);
    setLinkRefused(false);
  };

  const resend = async () => {
    if (!phone) return;
    setError(null);
    setResent(false);
    try {
      await requestRecovery({ kind: 'phone', phone });
      setCode('');
      setResent(true);
    } catch (e) {
      setError(recoveryRequestErrorMessage(e, 'Въведете телефон (08… или +359…).'));
    }
  };

  const submit = async () => {
    const problem = newPasswordProblem(password, repeat);
    if (problem) {
      setError(newPasswordMessage(problem));
      return;
    }
    const proof: RecoveryProof | null = token ? { token } : phone ? { phone, code } : null;
    if (!proof || !via) return;
    setLoading(true);
    setError(null);
    try {
      await confirmRecovery(proof, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(recoveryConfirmErrorMessage(e, via));
      const failure = e instanceof ApiError && e.status > 0 ? recoveryFailure(e.status) : null;
      setLinkRefused(
        via === 'link' && (failure === 'invalid-proof' || failure === 'invalid-input'),
      );
    } finally {
      setLoading(false);
    }
  };

  const heading = headingFor({ done, via, phone, minutes });
  const canSubmit =
    password.length > 0 && repeat.length > 0 && (via !== 'code' || code.length === CODE_LENGTH);

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
          <View style={styles.backRow}>
            <GlassCircleButton
              icon={done ? 'close' : 'arrow-back'}
              onPress={done ? toLogin : leave}
              accessibilityLabel={done ? 'Затвори' : 'Назад'}
            />
          </View>

          <Animated.View
            key={done ? 'done' : 'form'}
            entering={FadeInDown.duration(420).delay(80)}
            style={styles.header}
          >
            <Text style={styles.title}>{heading.title}</Text>
            <View style={styles.titleDash} />
            <Text style={styles.subtitle}>{heading.text}</Text>
          </Animated.View>

          {via && !done ? (
            <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.form}>
              {via === 'code' ? (
                <GlassView contentStyle={styles.codeCard}>
                  <Text style={styles.codeLabel}>Код от SMS</Text>
                  <CodeInput
                    length={CODE_LENGTH}
                    value={code}
                    onChange={(next) => {
                      setCode(next);
                      clearError();
                    }}
                  />
                  <View style={styles.resendRow}>
                    <Text style={styles.resendHint}>
                      {resent ? 'Изпратихме нов код.' : 'Не получихте код?'}
                    </Text>
                    <PressableScale
                      haptic={false}
                      onPress={resend}
                      accessibilityRole="button"
                      accessibilityLabel="Изпрати код отново"
                    >
                      <Text style={styles.resendAction}>Изпрати отново</Text>
                    </PressableScale>
                  </View>
                </GlassView>
              ) : null}

              <TextField
                label="Нова парола"
                icon="lock-closed-outline"
                placeholder={`Поне ${MIN_PASSWORD_LENGTH} символа`}
                secure
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => repeatRef.current?.focus()}
                value={password}
                onChangeText={(next) => {
                  setPassword(next);
                  clearError();
                }}
              />
              <TextField
                ref={repeatRef}
                label="Повторете паролата"
                icon="lock-closed-outline"
                placeholder="Същата парола"
                secure
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (canSubmit && !loading) void submit();
                }}
                value={repeat}
                onChangeText={(next) => {
                  setRepeat(next);
                  clearError();
                }}
              />

              {error ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.errorBlock}>
                  <Text style={styles.error} accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                  {linkRefused ? (
                    <PressableScale haptic={false} onPress={askAgain} accessibilityRole="button">
                      <Text style={styles.errorAction}>Поискай нов линк</Text>
                    </PressableScale>
                  ) : null}
                </Animated.View>
              ) : null}
            </Animated.View>
          ) : null}
        </ScrollView>

        <Animated.View
          entering={FadeInUp.duration(450).delay(320)}
          style={[styles.cta, { paddingBottom: insets.bottom + rs(20, 14) }]}
        >
          {done ? (
            <GradientButton
              label="Към входа"
              variant="dark"
              trailingIcon="arrow-forward"
              onPress={toLogin}
            />
          ) : via === null ? (
            <GradientButton
              label="Поискай нов линк"
              variant="dark"
              trailingIcon="arrow-forward"
              onPress={askAgain}
            />
          ) : (
            <GradientButton
              label="Запази паролата"
              variant="dark"
              trailingIcon="arrow-forward"
              onPress={submit}
              loading={loading}
              disabled={!canSubmit}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function headingFor(state: {
  done: boolean;
  via: 'link' | 'code' | null;
  phone?: string;
  minutes?: string;
}): { title: string; text: string } {
  if (state.done) {
    return {
      title: 'Паролата\nе сменена',
      text: 'Влезте с новата парола. Всички стари влизания на всички устройства са прекратени.',
    };
  }
  if (state.via === null) {
    return {
      title: 'Линкът\nне важи',
      text: 'Линкът е непълен. Поискайте нов от «Забравена парола».',
    };
  }
  if (state.via === 'link') {
    return {
      title: 'Нова\nпарола',
      text: `Изберете нова парола с поне ${MIN_PASSWORD_LENGTH} символа.`,
    };
  }
  const lifetime = state.minutes ? ` Кодът важи ${state.minutes} минути.` : '';
  return {
    title: 'Нова\nпарола',
    text: `Изпратихме ${CODE_LENGTH}-цифрен код по SMS на ${state.phone}.${lifetime} Въведете го и изберете нова парола.`,
  };
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
  errorBlock: {
    alignItems: 'center',
    gap: rs(8, 6),
  },
  error: {
    fontSize: metrics.bodySize,
    fontWeight: '600',
    textAlign: 'center',
    color: glass.danger,
  },
  errorAction: {
    fontSize: metrics.bodySize,
    fontWeight: '700',
    color: glass.textPrimary,
  },
  cta: {
    paddingHorizontal: metrics.screenPadding,
    paddingTop: rs(12, 8),
  },
});
