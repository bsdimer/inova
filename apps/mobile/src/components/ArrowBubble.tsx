import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { rs } from '../theme/responsive';
import { palette } from '../theme/tokens';

interface Props {
  size?: number;
}

/** Small white disc with a dark forward arrow — the card affordance from the mockups. */
export function ArrowBubble({ size = rs(34, 30) }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="arrow-forward" size={size * 0.5} color={palette.goldBlack} />
    </View>
  );
}
