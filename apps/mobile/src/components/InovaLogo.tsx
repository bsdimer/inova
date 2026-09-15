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
  /**
   * stacked — hero lockup: the gold rule runs under the full wordmark width,
   * dot at its right end, byline centered below (welcome screen).
   * Default (inline) puts the rule + dot to the right of the wordmark.
   */
  stacked?: boolean;
}

/**
 * "inova — by WhiteNova Technology" lockup (client brand): lowercase
 * letterspaced wordmark with a thin gold rule ending in a dot, tiny caps
 * byline underneath.
 */
export function BrandLockup({
  size = rs(24, 21),
  color = glass.textPrimary,
  align = 'flex-start',
  stacked = false,
}: Props) {
  const dot = (
    <View
      style={{
        width: size * 0.18,
        height: size * 0.18,
        borderRadius: size * 0.09,
        backgroundColor: LOGO_GOLD,
      }}
    />
  );

  const wordmark = (
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
  );

  const byline = (marginTop: number) => (
    <Text
      style={{
        fontSize: size * 0.3,
        fontWeight: '500',
        letterSpacing: size * 0.1,
        color,
        opacity: 0.85,
        marginTop,
      }}
    >
      BY WHITENOVA TECHNOLOGY
    </Text>
  );

  if (stacked) {
    return (
      <View style={{ alignItems: 'center' }}>
        {wordmark}
        <View style={[styles.underlineRow, { marginTop: size * 0.3 }]}>
          <View style={styles.underline} />
          {dot}
        </View>
        {byline(size * 0.5)}
      </View>
    );
  }

  return (
    <View style={{ alignItems: align }}>
      <View style={styles.row}>
        {wordmark}
        <View style={[styles.rule, { width: size * 1.05, marginLeft: size * 0.1 }]} />
        {dot}
      </View>
      {byline(size * 0.3)}
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
  underlineRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
  },
  underline: {
    flex: 1,
    height: 1.5,
    backgroundColor: LOGO_GOLD,
  },
});
