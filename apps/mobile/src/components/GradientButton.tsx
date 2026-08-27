import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { metrics, rs } from '../theme/responsive';
import { glass, gradients, palette, radius } from '../theme/tokens';
import { PressableScale } from './PressableScale';

type Variant = 'gradient' | 'ghost' | 'surface' | 'dark' | 'glass';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Light label/border for use on dark hero backgrounds. */
  onDark?: boolean;
  /** Leading icon shown next to the label. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Trailing icon pinned to the right edge (e.g. a chevron). */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
}

export function GradientButton({
  label,
  onPress,
  variant = 'gradient',
  loading = false,
  disabled = false,
  style,
  onDark = false,
  icon,
  trailingIcon,
}: Props) {
  const { colors } = useTheme();

  const contentColor =
    variant === 'gradient' || variant === 'dark' || variant === 'glass'
      ? palette.white
      : variant === 'ghost'
        ? onDark
          ? palette.white
          : colors.primary
        : colors.textPrimary;

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'gradient' || variant === 'dark' || variant === 'glass'
              ? palette.white
              : colors.primary
          }
        />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={rs(20, 18)} color={contentColor} /> : null}
          <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
        </>
      )}
      {trailingIcon && !loading ? (
        <View style={styles.trailing}>
          <Ionicons name={trailingIcon} size={rs(18, 16)} color={contentColor} />
        </View>
      ) : null}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        // Soft drop shadows need a backing color on the shadow-casting view.
        variant === 'dark' ? styles.darkShadow : variant === 'glass' ? styles.glassShadow : {},
        { opacity: disabled ? 0.6 : 1 },
        style ?? {},
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {variant === 'gradient' ? (
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.fill}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.fill,
            variant === 'ghost' && {
              borderWidth: 1.5,
              borderColor: onDark ? 'rgba(255,255,255,0.35)' : colors.border,
              backgroundColor: 'transparent',
            },
            variant === 'surface' && { backgroundColor: colors.surface },
            variant === 'dark' && {
              backgroundColor: 'rgba(24,24,26,0.94)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.12)',
            },
            variant === 'glass' && {
              backgroundColor: 'rgba(255,255,255,0.16)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: glass.stroke,
            },
          ]}
        >
          {variant === 'glass' && (
            <BlurView
              intensity={35}
              tint="light"
              blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
              style={StyleSheet.absoluteFill}
            />
          )}
          {content}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: metrics.buttonHeight,
    borderRadius: radius.pill,
    // No overflow:'hidden' here — it would clip caller-provided iOS shadows.
    // The inner fill clips the gradient to the pill shape instead.
  },
  darkShadow: {
    backgroundColor: palette.goldBlack,
    shadowColor: '#000000',
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 9,
  },
  glassShadow: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fill: {
    flex: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: rs(17, 16),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  trailing: {
    position: 'absolute',
    right: rs(20, 16),
  },
});
