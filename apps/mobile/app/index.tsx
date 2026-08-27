import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bootstrapSession } from '../src/api/client';
import { AppBackground } from '../src/components/AppBackground';
import { GradientButton } from '../src/components/GradientButton';
import { BrandLockup } from '../src/components/SosedoLogo';
import { metrics, rs, screen } from '../src/theme/responsive';

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
      <AppBackground variant="welcome" />

      <Animated.View
        entering={FadeInDown.duration(600).delay(150)}
        style={[styles.lockup, { top: insets.top + screen.height * 0.055 }]}
      >
        <BrandLockup size={rs(44, 38)} stacked />
      </Animated.View>

      {needsAuth && (
        <Animated.View
          entering={FadeInUp.duration(500).delay(250)}
          style={[styles.actions, { paddingBottom: insets.bottom + rs(24, 18) }]}
        >
          <GradientButton label="Вход" variant="dark" onPress={() => router.push('/login')} />
          {/* Residents onboard via manager-issued invite codes (B7). */}
          <GradientButton
            label="Регистрация"
            variant="glass"
            onPress={() => router.push('/activate')}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  lockup: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: metrics.screenPadding,
    gap: rs(14, 11),
  },
});
