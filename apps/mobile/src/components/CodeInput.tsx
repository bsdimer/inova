import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { rs } from '../theme/responsive';
import { glass } from '../theme/tokens';

interface Props {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  /** Fires once when all digits are filled. */
  onFilled?: (code: string) => void;
}

/**
 * One-time-code input rendered as frosted glass digit boxes over a single
 * hidden TextInput, so the system keyboard, paste and SMS autofill all behave
 * natively. Empty boxes show the mockup's underscore placeholder.
 */
export function CodeInput({ length = 6, value, onChange, onFilled }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) {
      onFilled?.(digits);
    }
  };

  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Код за покана">
      <View style={styles.row}>
        {Array.from({ length }).map((_, i) => {
          const digit = value[i] ?? '';
          const isActive = focused && i === activeIndex && value.length < length;
          return (
            <View key={i} style={[styles.box, isActive && styles.boxActive]}>
              {digit ? (
                <Animated.Text entering={FadeIn.duration(120)} style={styles.digit}>
                  {digit}
                </Animated.Text>
              ) : (
                <View style={styles.underscore} />
              )}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hidden}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: rs(9, 7),
  },
  box: {
    flex: 1,
    aspectRatio: 0.78,
    maxHeight: rs(72, 62),
    borderRadius: rs(16, 14),
    borderWidth: 1.2,
    borderColor: glass.stroke,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: 'rgba(255,255,255,0.9)',
  },
  digit: {
    fontSize: rs(26, 22),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  underscore: {
    position: 'absolute',
    bottom: rs(10, 8),
    width: rs(14, 12),
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
