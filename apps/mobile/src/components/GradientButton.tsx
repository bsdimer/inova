import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { metrics, rs } from '../theme/responsive';
import { gradients, palette, radius } from '../theme/tokens';
import { PressableScale } from './PressableScale';

type Variant = 'gradient' | 'ghost' | 'surface';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Light label/border for use on dark hero backgrounds. */
  onDark?: boolean;
}

export function GradientButton({
  label,
  onPress,
  variant = 'gradient',
  loading = false,
  disabled = false,
  style,
  onDark = false,
}: Props) {
  const { colors } = useTheme();

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={variant === 'gradient' ? palette.white : colors.primary} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'gradient' && { color: palette.white },
            variant === 'ghost' && { color: onDark ? palette.white : colors.primary },
            variant === 'surface' && { color: colors.textPrimary },
          ]}
        >
          {label}
        </Text>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.base, { opacity: disabled ? 0.6 : 1 }, style ?? {}]}
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
          ]}
        >
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
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: rs(17, 16),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
