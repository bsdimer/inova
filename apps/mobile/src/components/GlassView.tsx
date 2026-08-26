import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { glass, radius } from '../theme/tokens';

interface Props {
  children?: React.ReactNode;
  /** Outer layout style (size, margins, flex). */
  style?: StyleProp<ViewStyle>;
  /** Inner style for padding/gap around the children. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Blur strength (iOS/Android real blur). */
  intensity?: number;
  /** Corner radius; defaults to the large brand radius. */
  rounded?: number;
  /** Translucent tint painted over the blur (defaults to frosted white). */
  overlayColor?: string;
  /** Hairline highlight border color. */
  borderColor?: string;
}

/**
 * "Liquid glass" surface over the photographic app background: real blur with
 * a translucent white frost and a hairline highlight border, sized for white
 * typography. Android uses the same BlurView via the dimezis render path; the
 * translucent overlay keeps both platforms looking identical even where blur
 * quality differs.
 */
export function GlassView({
  children,
  style,
  contentStyle,
  intensity = 40,
  rounded = radius.lg,
  overlayColor = glass.fill,
  borderColor = glass.stroke,
}: Props) {
  return (
    <View style={[styles.clip, { borderRadius: rounded, borderColor }, style]}>
      <BlurView
        intensity={intensity}
        tint="light"
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    // Content stacks above the blur + tint layers.
    position: 'relative',
  },
});
