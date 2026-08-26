import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { screen } from '../theme/responsive';
import { glass } from '../theme/tokens';

type Variant = 'hero' | 'blur';

interface Props {
  /**
   * hero — the building photo stays recognizable at the top and dissolves
   * into warm haze below (home / building tabs).
   * blur — the same photo fully blurred into a warm glow (auth, menu,
   * secondary screens).
   */
  variant?: Variant;
}

const PHOTO = require('../../assets/images/building-photo.jpg');
// Vertical stops where the photo dissolves into the flat haze color.
const HAZE_TRANSPARENT = 'rgba(138,129,119,0)';

/**
 * Full-screen photographic backdrop shared by every screen: the brand
 * building shot over a warm haze, with a dark scrim so white text stays
 * legible. Render as the first child of a flex:1 container.
 */
export function AppBackground({ variant = 'hero' }: Props) {
  return (
    <View style={styles.fill} pointerEvents="none">
      {variant === 'hero' ? (
        <>
          <Image
            source={PHOTO}
            style={styles.heroImage}
            resizeMode="cover"
            blurRadius={3}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={[HAZE_TRANSPARENT, HAZE_TRANSPARENT, glass.haze]}
            locations={[0, 0.38, 0.62]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(29,29,31,0.44)', 'rgba(29,29,31,0.08)', 'rgba(29,29,31,0.26)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          <Image
            source={PHOTO}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={45}
            accessibilityIgnoresInvertColors
          />
          <View style={[StyleSheet.absoluteFill, styles.blurVeil]} />
          <LinearGradient
            colors={['rgba(29,29,31,0.32)', 'rgba(29,29,31,0.1)', 'rgba(29,29,31,0.24)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: glass.haze,
  },
  heroImage: {
    width: '100%',
    height: Math.round(screen.height * 0.66),
  },
  blurVeil: {
    backgroundColor: 'rgba(178,166,151,0.28)',
  },
});
