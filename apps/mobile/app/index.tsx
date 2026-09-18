import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRedirectIfAuthenticated } from '../src/auth/AuthProvider';
import { AppBackground } from '../src/components/AppBackground';
import { GradientButton } from '../src/components/GradientButton';
import { metrics, rs } from '../src/theme/responsive';

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useRedirectIfAuthenticated();

  // CTAs only after we know the user must authenticate.
  const showActions = status === 'guest';

  return (
    <View style={styles.container}>
      {/* The welcome artwork already carries the inova wordmark. */}
      <AppBackground variant="welcome" />

      {showActions && (
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
