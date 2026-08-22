import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rs } from '../theme/responsive';
import { gradients, palette } from '../theme/tokens';

interface MarkProps {
  size?: number;
  /** Inner disc color — navy on dark hero, white on light surfaces. */
  discColor?: string;
  iconColor?: string;
}

/** Circular gradient-ring mark with the "home" glyph, echoing the brand lockup. */
export function SosedoMark({
  size = rs(112, 96),
  discColor = palette.navy,
  iconColor = palette.white,
}: MarkProps) {
  const ring = size * 0.055;
  return (
    <LinearGradient
      colors={gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size - ring * 2,
          height: size - ring * 2,
          borderRadius: (size - ring * 2) / 2,
          backgroundColor: discColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="home" size={size * 0.42} color={iconColor} />
        <View
          style={{
            position: 'absolute',
            top: size * 0.16,
            right: size * 0.18,
            width: size * 0.09,
            height: size * 0.09,
            borderRadius: size * 0.05,
            backgroundColor: palette.green,
          }}
        />
      </View>
    </LinearGradient>
  );
}

interface WordmarkProps {
  size?: number;
  color?: string;
}

/** "SOSEDO" wordmark — the E carries the brand green, as in the primary lockup. */
export function SosedoWordmark({ size = rs(40, 34), color = palette.white }: WordmarkProps) {
  return (
    <View style={styles.row}>
      {['S', 'O', 'S', 'E', 'D', 'O'].map((letter, i) => (
        <Text
          key={`${letter}-${i}`}
          style={{
            fontSize: size,
            fontWeight: '800',
            letterSpacing: size * 0.14,
            color: letter === 'E' ? palette.green : color,
          }}
        >
          {letter}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
