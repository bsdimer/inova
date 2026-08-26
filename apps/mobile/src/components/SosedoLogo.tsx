import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rs } from '../theme/responsive';
import { glass } from '../theme/tokens';

// Logo lockups carry their own fixed colors (client-provided mark).
const LOGO_GOLD = '#C9A26B';

interface Props {
  /** Wordmark letter size. */
  size?: number;
  color?: string;
  align?: 'flex-start' | 'center';
}

/**
 * "inova — by White Nova Technology" lockup (client brand): lowercase
 * letterspaced wordmark with a thin gold rule ending in a dot, tiny caps
 * byline underneath.
 */
export function BrandLockup({
  size = rs(24, 21),
  color = glass.textPrimary,
  align = 'flex-start',
}: Props) {
  return (
    <View style={{ alignItems: align }}>
      <View style={styles.row}>
        <Text
          style={{
            fontSize: size,
            fontWeight: '400',
            letterSpacing: size * 0.42,
            color,
          }}
        >
          inova
        </Text>
        <View style={[styles.rule, { width: size * 1.05, marginLeft: size * 0.1 }]} />
        <View
          style={{
            width: size * 0.18,
            height: size * 0.18,
            borderRadius: size * 0.09,
            backgroundColor: LOGO_GOLD,
          }}
        />
      </View>
      <Text
        style={{
          fontSize: size * 0.3,
          fontWeight: '500',
          letterSpacing: size * 0.1,
          color,
          opacity: 0.85,
          marginTop: size * 0.3,
        }}
      >
        BY WHITE NOVA TECHNOLOGY
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rule: {
    height: 1,
    backgroundColor: LOGO_GOLD,
  },
});
