import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { rs } from '../theme/responsive';
import { glass } from '../theme/tokens';
import { GlassView } from './GlassView';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
}

/** Placeholder card for screens that are not built yet. */
export function ComingSoon({ icon }: Props) {
  return (
    <Animated.View entering={FadeInUp.duration(420).delay(120)} style={styles.wrap}>
      <GlassView contentStyle={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={rs(30, 26)} color={glass.textPrimary} />
        </View>
        <Text style={styles.title}>Очаквайте скоро</Text>
        <Text style={styles.body}>Работим по тази част от приложението.</Text>
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: rs(24, 18),
  },
  card: {
    alignItems: 'center',
    gap: rs(10, 8),
    paddingVertical: rs(40, 32),
    paddingHorizontal: rs(24, 18),
  },
  iconCircle: {
    width: rs(72, 62),
    height: rs(72, 62),
    borderRadius: 999,
    backgroundColor: glass.fillStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(8, 6),
  },
  title: {
    fontSize: rs(22, 19),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  body: {
    fontSize: rs(15, 14),
    color: glass.textSecondary,
    textAlign: 'center',
  },
});
