import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { rs } from '../theme/responsive';
import { glass } from '../theme/tokens';
import { GlassView } from './GlassView';
import { PressableScale } from './PressableScale';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}

/** Round frosted icon button used in screen headers (menu, back, help). */
export function GlassCircleButton({
  icon,
  onPress,
  accessibilityLabel,
  size = rs(46, 42),
}: Props) {
  return (
    <GlassView rounded={999} overlayColor={glass.fillStrong}>
      <PressableScale
        haptic={false}
        onPress={onPress}
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name={icon} size={size * 0.48} color={glass.textPrimary} />
      </PressableScale>
    </GlassView>
  );
}
