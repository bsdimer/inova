import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { rs, screen } from '../theme/responsive';
import { glass } from '../theme/tokens';

export interface WheelItem {
  id: string;
  label: string;
  sub?: string;
}

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface Props {
  items: WheelItem[];
  /** Measured height is preferred; this is the fallback before layout. */
  fallbackHeight?: number;
  /** Left icon on each card. Defaults to the apartment door. */
  icon?: IconName;
  /** Show a trailing chevron (documents mock). */
  showChevron?: boolean;
  /** Wider cards for longer labels (documents). */
  cardWidth?: number;
  emptyText?: string;
}

// Angular distance between neighboring cards on the arc.
const STEP = 0.3;
// Drag pixels that move the wheel by one item.
const PX_PER_ITEM = 84;
const CARD_H = rs(66, 58);
const DEFAULT_CARD_W = rs(224, 196);
// Gap between a card's right edge and its dot on the arc.
const GAP = rs(22, 18);

const SPRING = { damping: 20, stiffness: 160, mass: 0.6 };

function selectionTick() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
}

/**
 * "Spinning wheel" list: cards fan out along a circular arc whose center sits
 * off-screen to the right; each card has a glowing dot on the arc. Vertical
 * drags rotate the wheel and it snaps to the nearest item.
 */
export function ApartmentWheel({
  items,
  fallbackHeight = rs(430, 360),
  icon = 'door',
  showChevron = false,
  cardWidth = DEFAULT_CARD_W,
  emptyText = 'Няма апартаменти със задължения',
}: Props) {
  const [height, setHeight] = useState(fallbackHeight);
  const progress = useSharedValue(Math.min(2, Math.max(items.length - 1, 0)));
  const dragStart = useSharedValue(0);

  // Changing the filter swaps the item list — re-center on a valid index.
  useEffect(() => {
    progress.value = withSpring(Math.min(2, Math.max(items.length - 1, 0)), SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (previous !== null && current !== previous) runOnJS(selectionTick)();
    },
  );

  const radius = Math.min(Math.max(height * 0.62, 240), 330);
  const cy = height / 2;
  // Leftmost point of the arc — the "selection" point the cards align to.
  const arcLeft = screen.width * 0.76;
  const cx = arcLeft + radius;
  const maxIndex = items.length - 1;

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStart.value = progress.value;
    })
    .onUpdate((e) => {
      const raw = dragStart.value - e.translationY / PX_PER_ITEM;
      // Soft rubber-banding beyond the ends.
      if (raw < 0) progress.value = raw / 3;
      else if (raw > maxIndex) progress.value = maxIndex + (raw - maxIndex) / 3;
      else progress.value = raw;
    })
    .onEnd((e) => {
      const flick = -e.velocityY / PX_PER_ITEM / 4;
      const target = Math.min(Math.max(Math.round(progress.value + flick), 0), maxIndex);
      progress.value = withSpring(target, SPRING);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.wrap} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        <Svg width={screen.width} height={height} style={StyleSheet.absoluteFill}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={1}
            fill="none"
          />
        </Svg>
        {items.map((item, i) => (
          <WheelCard
            key={item.id}
            item={item}
            index={i}
            progress={progress}
            cx={cx}
            cy={cy}
            radius={radius}
            icon={icon}
            showChevron={showChevron}
            cardWidth={cardWidth}
          />
        ))}
        {items.length === 0 && (
          <View style={[styles.emptyWrap, { height }]}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

interface CardProps {
  item: WheelItem;
  index: number;
  progress: SharedValue<number>;
  cx: number;
  cy: number;
  radius: number;
  icon: IconName;
  showChevron: boolean;
  cardWidth: number;
}

function WheelCard({
  item,
  index,
  progress,
  cx,
  cy,
  radius,
  icon,
  showChevron,
  cardWidth,
}: CardProps) {
  const cardStyle = useAnimatedStyle(() => {
    const theta = (index - progress.value) * STEP;
    const abs = Math.abs(theta);
    const dotX = cx - radius * Math.cos(theta);
    const dotY = cy + radius * Math.sin(theta);
    const scale = interpolate(abs, [0, STEP, STEP * 3], [1, 0.84, 0.66], 'clamp');
    return {
      opacity: interpolate(abs, [0, STEP, STEP * 2.6, STEP * 3.4], [1, 0.72, 0.34, 0], 'clamp'),
      backgroundColor: interpolateColor(
        abs,
        [0, STEP],
        ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)'],
      ),
      borderColor: interpolateColor(
        abs,
        [0, STEP],
        ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.22)'],
      ),
      transform: [
        // Keep the card's right edge anchored to its dot while it scales.
        { translateX: dotX - GAP - (cardWidth / 2) * scale },
        { translateY: dotY },
        { scale },
      ],
    };
  });

  const dotStyle = useAnimatedStyle(() => {
    const theta = (index - progress.value) * STEP;
    const abs = Math.abs(theta);
    return {
      opacity: interpolate(abs, [0, STEP * 3, STEP * 3.6], [1, 0.75, 0], 'clamp'),
      transform: [
        { translateX: cx - radius * Math.cos(theta) },
        { translateY: cy + radius * Math.sin(theta) },
        { scale: interpolate(abs, [0, STEP, STEP * 3], [1.25, 0.9, 0.7], 'clamp') },
      ],
    };
  });

  return (
    <>
      <Animated.View
        style={[styles.card, { width: cardWidth, marginLeft: -cardWidth / 2 }, cardStyle]}
        pointerEvents="none"
      >
        <MaterialCommunityIcons
          name={icon}
          size={rs(28, 24)}
          color="rgba(255,255,255,0.92)"
          style={styles.leadingIcon}
        />
        <View style={styles.cardTexts}>
          <Text style={styles.cardLabel} numberOfLines={item.sub ? 1 : 2}>
            {item.label}
          </Text>
          {item.sub ? (
            <Text style={styles.cardSub} numberOfLines={1}>
              {item.sub}
            </Text>
          ) : null}
        </View>
        {showChevron ? (
          <Ionicons name="chevron-forward" size={rs(18, 16)} color="rgba(255,255,255,0.7)" />
        ) : null}
      </Animated.View>
      <Animated.View style={[styles.dotWrap, dotStyle]} pointerEvents="none">
        {/* Real radial-gradient glow: bright warm center dissolving to nothing.
            View shadows can't emit this much light from a 10px dot. */}
        <Svg width={DOT_WRAP} height={DOT_WRAP} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={`glow-${item.id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFD9A8" stopOpacity="0.95" />
              <Stop offset="35%" stopColor="#FFB46B" stopOpacity="0.55" />
              <Stop offset="70%" stopColor="#FF9C4A" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#FF9C4A" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={DOT_WRAP / 2}
            cy={DOT_WRAP / 2}
            r={DOT_WRAP / 2}
            fill={`url(#glow-${item.id})`}
          />
        </Svg>
        <View style={styles.dotCore} />
      </Animated.View>
    </>
  );
}

const DOT_WRAP = 52;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
  },
  card: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: CARD_H,
    marginTop: -CARD_H / 2,
    borderRadius: CARD_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(16, 13),
    gap: rs(10, 8),
  },
  leadingIcon: {
    opacity: 0.95,
  },
  cardTexts: {
    flex: 1,
    gap: rs(2, 1),
  },
  cardLabel: {
    fontSize: rs(16, 14),
    fontWeight: '700',
    letterSpacing: 0.1,
    color: glass.textPrimary,
  },
  cardSub: {
    fontSize: rs(12, 11),
    color: glass.textSecondary,
  },
  dotWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DOT_WRAP,
    height: DOT_WRAP,
    marginLeft: -DOT_WRAP / 2,
    marginTop: -DOT_WRAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF7EA',
    shadowColor: '#FFB46B',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: rs(15, 14),
    color: glass.textSecondary,
  },
});
