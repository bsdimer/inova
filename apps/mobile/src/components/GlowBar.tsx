import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, FeGaussianBlur, Filter, Line } from 'react-native-svg';
import { rs } from '../theme/responsive';

interface Props {
  /** 0–100. */
  pct: number;
  /** Unique per instance so SVG filter ids never collide on one screen. */
  filterId: string;
  height?: number;
}

/**
 * Standard glowing linear progress bar (same bloom as VoteRing): one white
 * line blurred under itself — no View shadows, identical on iOS and Android.
 */
export function GlowBar({ pct, filterId, height = rs(10, 9) }: Props) {
  const [width, setWidth] = useState(0);
  const clamped = Math.max(0, Math.min(100, pct));
  // Vertical padding so the bloom isn't clipped by the SVG bounds.
  const pad = rs(8, 7);
  const box = height + pad * 2;
  const r = height / 2;
  const y = box / 2;
  const x2 = r + ((width - height) * clamped) / 100;

  return (
    <View
      style={[styles.track, { height, borderRadius: r }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && clamped > 0 ? (
        <Svg
          width={width}
          height={box}
          style={{ position: 'absolute', left: 0, top: (height - box) / 2 }}
        >
          <Defs>
            <Filter
              id={filterId}
              x={0}
              y={0}
              width={width}
              height={box}
              filterUnits="userSpaceOnUse"
            >
              <FeGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </Filter>
          </Defs>
          <Line
            x1={r}
            y1={y}
            x2={x2}
            y2={y}
            stroke="#FFFFFF"
            strokeWidth={height}
            strokeLinecap="round"
            opacity={0.7}
            filter={`url(#${filterId})`}
          />
          <Line
            x1={r}
            y1={y}
            x2={x2}
            y2={y}
            stroke="#FFFFFF"
            strokeWidth={height}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
  },
});
