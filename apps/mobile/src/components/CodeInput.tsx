import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { rs } from '../theme/responsive';
import { radius } from '../theme/tokens';

interface Props {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  /** Fires once when all digits are filled. */
  onFilled?: (code: string) => void;
}

/**
 * One-time-code input rendered as digit boxes over a single hidden TextInput,
 * so the system keyboard, paste and SMS autofill all behave natively.
 */
export function CodeInput({ length = 6, value, onChange, onFilled }: Props) {
  const { colors } = useTheme();
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
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Invite code">
      <View style={styles.row}>
        {Array.from({ length }).map((_, i) => {
          const digit = value[i] ?? '';
          const isActive = focused && i === activeIndex && value.length < length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: colors.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                  borderWidth: isActive ? 2 : 1.5,
                },
              ]}
            >
              {digit ? (
                <Animated.Text
                  entering={FadeIn.duration(120)}
                  style={[styles.digit, { color: colors.textPrimary }]}
                >
                  {digit}
                </Animated.Text>
              ) : isActive ? (
                <Text style={[styles.cursor, { color: colors.primary }]}>|</Text>
              ) : null}
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
    gap: rs(10, 8),
  },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxHeight: rs(64, 56),
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: rs(26, 22),
    fontWeight: '700',
  },
  cursor: {
    fontSize: rs(24, 20),
    fontWeight: '300',
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
