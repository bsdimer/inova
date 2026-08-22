import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { metrics, rs } from '../theme/responsive';
import { radius } from '../theme/tokens';

interface Props extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
}

/** Input with an animated focus ring and optional secure-text toggle. */
export function TextField({ label, icon, secure = false, ...inputProps }: Props) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(secure);
  const focus = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [colors.border, colors.primary]),
    shadowOpacity: focus.value * 0.12,
  }));

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Animated.View
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            shadowColor: colors.primary,
          },
          borderStyle,
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={rs(20, 18)} color={colors.textSecondary} />
        ) : null}
        <TextInput
          {...inputProps}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textSecondary}
          onFocus={(e) => {
            focus.value = withTiming(1, { duration: 180 });
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, { duration: 180 });
            inputProps.onBlur?.(e);
          }}
          style={[styles.input, { color: colors.textPrimary }]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={12}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={rs(20, 18)}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: rs(8, 6),
  },
  label: {
    fontSize: metrics.captionSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10, 8),
    height: metrics.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: rs(16, 14),
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: metrics.bodySize,
    fontWeight: '500',
  },
});
