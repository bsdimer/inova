import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bootstrapSession } from '../src/api/client';
import { AppBackground } from '../src/components/AppBackground';
import { GlassView } from '../src/components/GlassView';
import { GradientButton } from '../src/components/GradientButton';
import { BrandLockup } from '../src/components/SosedoLogo';
import { metrics, rs } from '../src/theme/responsive';
import { glass } from '../src/theme/tokens';

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The hero doubles as a splash while we restore a persisted session; the
  // CTAs only appear once we know the user actually has to log in.
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    let mounted = true;
    void bootstrapSession().then((session) => {
      if (!mounted) return;
      if (session) router.replace('/home');
      else setNeedsAuth(true);
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <AppBackground variant="hero" />

      <View style={[styles.content, { paddingTop: insets.top + rs(72, 52) }]}>
        <Animated.View entering={FadeInDown.springify().damping(15).delay(120)}>
          <BrandLockup size={rs(38, 32)} align="center" />
        </Animated.View>

        <Animated.Text entering={FadeInUp.duration(500).delay(500)} style={styles.subtitle}>
          Вашата сграда, вашите съседи, вашите плащания — на едно спокойно място.
        </Animated.Text>
      </View>

      {/* Bottom action panel — liquid glass */}
      {needsAuth && (
        <Animated.View
          entering={FadeInUp.duration(500).delay(200)}
          style={[styles.actionsWrap, { paddingBottom: insets.bottom + rs(20, 14) }]}
        >
          <GlassView contentStyle={styles.actions}>
            <GradientButton
              label="Имам код за покана"
              variant="dark"
              trailingIcon="arrow-forward"
              onPress={() => router.push('/activate')}
            />
            <GradientButton
              label="Вече имам акаунт"
              variant="glass"
              onPress={() => router.push('/login')}
            />
          </GlassView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    gap: rs(24, 18),
    paddingHorizontal: metrics.screenPadding,
  },
  subtitle: {
    color: glass.textSecondary,
    fontSize: metrics.subtitleSize,
    lineHeight: rs(26, 22),
    textAlign: 'center',
    maxWidth: 320,
  },
  actionsWrap: {
    paddingHorizontal: metrics.screenPadding,
  },
  actions: {
    padding: rs(16, 12),
    gap: rs(12, 10),
  },
});
