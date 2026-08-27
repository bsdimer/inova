import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bootstrapSession } from '../src/api/client';
import { AppBackground } from '../src/components/AppBackground';
import { GradientButton } from '../src/components/GradientButton';
import { metrics, rs } from '../src/theme/responsive';

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
      {/* The welcome artwork already carries the inova wordmark. */}
      <AppBackground variant="welcome" />

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
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: metrics.screenPadding,
    gap: rs(14, 11),
  },
});
