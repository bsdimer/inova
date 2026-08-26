import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { metrics, rs } from '../theme/responsive';
import { glass, palette, radius } from '../theme/tokens';

interface Props extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
}

/** Frosted glass input with an animated focus ring and optional secure-text toggle. */
export function TextField({ label, icon, secure = false, ...inputProps }: Props) {
  const [hidden, setHidden] = useState(secure);
  const focus = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [glass.stroke, palette.orangeBright]),
    shadowOpacity: focus.value * 0.2,
  }));

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.field, borderStyle]}>
        {icon ? <Ionicons name={icon} size={rs(20, 18)} color={glass.textSecondary} /> : null}
        <TextInput
          {...inputProps}
          secureTextEntry={hidden}
          placeholderTextColor={glass.textMuted}
          onFocus={(e) => {
            focus.value = withTiming(1, { duration: 180 });
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, { duration: 180 });
            inputProps.onBlur?.(e);
          }}
          style={styles.input}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={12}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={rs(20, 18)}
              color={glass.textSecondary}
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
    color: glass.textSecondary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10, 8),
    height: metrics.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: glass.fill,
    paddingHorizontal: rs(16, 14),
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: metrics.bodySize,
    fontWeight: '500',
    color: glass.textPrimary,
  },
});
