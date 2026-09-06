import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, Path } from 'react-native-svg';
import { rs } from '../theme/responsive';
import { glass } from '../theme/tokens';

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Clockwise arc on the same circle as the track. 0deg = 12 o'clock. */
function progressArc(cx: number, cy: number, r: number, pct: number) {
  const sweep = (Math.max(0, Math.min(100, pct)) / 100) * 360;
  if (sweep <= 0) return '';
  const start = polar(cx, cy, r, 0);
  if (sweep >= 359.9) {
    const mid = polar(cx, cy, r, 180);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${mid.x} ${mid.y} A ${r} ${r} 0 1 1 ${start.x} ${start.y}`;
  }
  const end = polar(cx, cy, r, sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

interface Props {
  pct: number;
  size: number;
  /** Unique per instance so SVG filter ids never collide on one screen. */
  filterId: string;
  /** Percentage text size; caption scales with it. */
  pctFontSize?: number;
}

/** Circular vote-progress ring with a glowing white arc (Анкети screens). */
export function VoteRing({ pct, size, filterId, pctFontSize }: Props) {
  const stroke = rs(5, 4.5);
  // Room for the blurred bloom so it isn't clipped at the SVG edge.
  const pad = rs(16, 14);
  const box = size + pad * 2;
  const r = (size - stroke) / 2;
  const cx = box / 2;
  const cy = box / 2;
  const clamped = Math.max(0, Math.min(100, pct));
  const d = progressArc(cx, cy, r, clamped);
  const pctSize = pctFontSize ?? rs(22, 19);

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        <Defs>
          <Filter id={filterId} x={0} y={0} width={box} height={box} filterUnits="userSpaceOnUse">
            <FeGaussianBlur in="SourceGraphic" stdDeviation="3.5" />
          </Filter>
        </Defs>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={stroke}
          fill="none"
        />
        {d ? (
          <>
            <Path
              d={d}
              stroke="#FFFFFF"
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              opacity={0.7}
              filter={`url(#${filterId})`}
            />
            <Path d={d} stroke="#FFFFFF" strokeWidth={stroke} fill="none" strokeLinecap="round" />
          </>
        ) : null}
      </Svg>
      <Text style={[styles.pct, { fontSize: pctSize }]}>{clamped}%</Text>
      <Text style={styles.caption}>гласували</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pct: {
    fontWeight: '800',
    letterSpacing: -0.3,
    color: glass.textPrimary,
  },
  caption: {
    marginTop: rs(1, 0),
    fontSize: rs(11, 10),
    fontWeight: '500',
    color: glass.textSecondary,
  },
});
