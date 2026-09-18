import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { metrics } from '../theme/responsive';
import { radius } from '../theme/tokens';
import { GlassView } from './GlassView';
import { PressableScale } from './PressableScale';

interface Props {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  /** Fixed frost height so wrapped copy cannot make one tile taller than the next. */
  height?: number;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Frosted tile that fills its grid cell at a fixed height, so wrapped copy
 * cannot make one tile taller than the one beside it.
 */
export function GridTile({
  children,
  onPress,
  accessibilityLabel,
  height = metrics.homeTileHeight,
  contentStyle,
}: Props) {
  return (
    <PressableScale
      haptic={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.press}
    >
      <GlassView
        rounded={radius.lg}
        style={{ height }}
        contentStyle={[styles.content, contentStyle]}
      >
        {children}
      </GlassView>
    </PressableScale>
  );
}

/** Row + cell styles for a wrapping two-column grid. Use with `GridTile`. */
export const tileGrid = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: metrics.gridGap,
  },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
    flexShrink: 1,
  },
});

const styles = StyleSheet.create({
  press: {
    flex: 1,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: metrics.cardPadding,
  },
});
