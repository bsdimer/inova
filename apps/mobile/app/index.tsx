import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bootstrapSession } from '../src/api/client';
import { GradientButton } from '../src/components/GradientButton';
import { SosedoMark, SosedoWordmark } from '../src/components/SosedoLogo';
import { metrics, rs, screen } from '../src/theme/responsive';
import { brand, gradients, palette } from '../src/theme/tokens';

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const float = useSharedValue(0);
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

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * -10 }],
  }));

  return (
    <LinearGradient colors={gradients.hero} style={styles.container}>
      <StatusBar style="light" />

      {/* Ambient gradient orbs */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View entering={FadeIn.duration(1200)} style={[styles.orb, styles.orbBlue]} />
        <Animated.View
          entering={FadeIn.duration(1200).delay(200)}
          style={[styles.orb, styles.orbPurple]}
        />
        <Animated.View
          entering={FadeIn.duration(1200).delay(350)}
          style={[styles.orb, styles.orbGreen]}
        />
      </View>

      <View style={[styles.content, { paddingTop: insets.top + rs(48, 32) }]}>
        <Animated.View
          entering={FadeInDown.springify().damping(14).delay(100)}
          style={floatStyle}
        >
          <SosedoMark />
        </Animated.View>

        <Animated.View entering={FadeInDown.springify().damping(15).delay(280)}>
          <SosedoWordmark />
        </Animated.View>

        <View style={styles.taglineRow}>
          {brand.tagline.map((word, i) => (
            <Animated.View
              key={word}
              entering={FadeInUp.duration(420).delay(520 + i * 140)}
              style={styles.taglineWord}
            >
              <Text style={styles.taglineText}>{word}</Text>
              <Text style={[styles.taglineDot, { color: brand.taglineAccents[i] }]}>.</Text>
            </Animated.View>
          ))}
        </View>

        <Animated.Text entering={FadeInUp.duration(500).delay(1000)} style={styles.subtitle}>
          Your building, your neighbors, your payments — one calm, organized place.
        </Animated.Text>
      </View>

      {/* Bottom action panel — subtle fade-up, no full-screen slide */}
      {needsAuth && (
        <Animated.View
          entering={FadeInUp.duration(500).delay(200)}
          style={[styles.actions, { paddingBottom: insets.bottom + rs(24, 16) }]}
        >
          <GradientButton
            label="I have an invite code"
            onPress={() => router.push('/activate')}
          />
          <GradientButton
            label="I already have an account"
            variant="ghost"
            onDark
            onPress={() => router.push('/login')}
          />
        </Animated.View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    gap: rs(28, 20),
    paddingHorizontal: metrics.screenPadding,
  },
  taglineRow: {
    flexDirection: 'row',
    gap: rs(10, 8),
  },
  taglineWord: {
    flexDirection: 'row',
  },
  taglineText: {
    color: palette.white,
    fontSize: rs(22, 19),
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  taglineDot: {
    fontSize: rs(22, 19),
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(242,246,252,0.72)',
    fontSize: metrics.subtitleSize,
    lineHeight: rs(26, 22),
    textAlign: 'center',
    maxWidth: 320,
  },
  actions: {
    paddingHorizontal: metrics.screenPadding,
    gap: rs(14, 10),
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.22,
  },
  orbBlue: {
    width: screen.width * 0.9,
    height: screen.width * 0.9,
    backgroundColor: palette.blue,
    top: -screen.width * 0.35,
    right: -screen.width * 0.3,
  },
  orbPurple: {
    width: screen.width * 0.7,
    height: screen.width * 0.7,
    backgroundColor: palette.purple,
    bottom: screen.height * 0.12,
    left: -screen.width * 0.35,
  },
  orbGreen: {
    width: screen.width * 0.5,
    height: screen.width * 0.5,
    backgroundColor: palette.green,
    bottom: -screen.width * 0.2,
    right: -screen.width * 0.15,
  },
});
