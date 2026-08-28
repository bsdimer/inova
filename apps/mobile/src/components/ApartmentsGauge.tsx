import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { rs } from '../theme/responsive';
import { glass } from '../theme/tokens';

interface Props {
  total: number;
  paid: number;
  unpaid: number;
  labels: { total: string; paid: string; unpaid: string };
  /** Rendered width; height follows the arc geometry. */
  width: number;
}

const STROKE = 5;
// Arc opens at the bottom: from 225° to 135°, angles clockwise from 12 o'clock.
const START_ANGLE = 225;
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arcPath(cx: number, cy: number, r: number, fromDeg: number, sweepDeg: number) {
  const from = polar(cx, cy, r, fromDeg);
  const to = polar(cx, cy, r, fromDeg + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} 1 ${to.x} ${to.y}`;
}

/** Open-bottom arc gauge showing paid vs. unpaid apartments (building screen). */
export function ApartmentsGauge({ total, paid, unpaid, labels, width }: Props) {
  const dotRadius = rs(7, 6);
  const margin = STROKE + dotRadius;
  const r = (width - margin * 2) / 2;
  const cx = width / 2;
  const cy = margin + r;
  // The arc's lowest points sit at cos(45°) below center; leave room for the stats row.
  const height = cy + r * Math.SQRT1_2 + rs(26, 22);

  const progressSweep = SWEEP * Math.min(paid / total, 1);
  const dot = polar(cx, cy, r, START_ANGLE + progressSweep);
  // The arc's open ends sit at ±45° off bottom; keep the side stats just
  // inside them so text never collides with the stroke.
  const sideInset = cx - r * Math.SQRT1_2 + rs(18, 14);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} pointerEvents="none">
        <Path
          d={arcPath(cx, cy, r, START_ANGLE, SWEEP)}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={arcPath(cx, cy, r, START_ANGLE, progressSweep)}
          stroke={glass.textPrimary}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={dot.x} cy={dot.y} r={dotRadius} fill={glass.textPrimary} />
      </Svg>

      <View style={styles.centerBlock} pointerEvents="none">
        <Text style={styles.total}>{total}</Text>
        <Text style={styles.caption}>{labels.total}</Text>
      </View>

      <View style={[styles.sideStat, { left: sideInset }]} pointerEvents="none">
        <Text style={styles.caption}>{labels.paid}</Text>
        <Text style={styles.sideValue}>{paid}</Text>
      </View>
      <View style={[styles.sideStat, { right: sideInset }]} pointerEvents="none">
        <Text style={styles.caption}>{labels.unpaid}</Text>
        <Text style={styles.sideValue}>{unpaid}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerBlock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: rs(56, 44),
    gap: rs(6, 5),
  },
  total: {
    fontSize: rs(64, 54),
    fontWeight: '700',
    letterSpacing: -1,
    color: glass.textPrimary,
  },
  caption: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
  },
  sideStat: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    gap: rs(4, 3),
  },
  sideValue: {
    fontSize: rs(22, 19),
    fontWeight: '700',
    color: glass.textPrimary,
  },
});
