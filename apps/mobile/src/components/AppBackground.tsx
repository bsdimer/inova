import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { screen } from '../theme/responsive';
import { glass } from '../theme/tokens';

type Variant = 'hero' | 'blur' | 'welcome';

interface Props {
  /**
   * hero — the building photo stays recognizable at the top and dissolves
   * into warm haze below (home / building tabs).
   * blur — the same photo fully blurred into a warm glow (auth, menu,
   * secondary screens).
   * welcome — the dedicated hero artwork (wordmark included) full-screen
   * with a soft bottom scrim (entry screen).
   */
  variant?: Variant;
}

const PHOTO = require('../../assets/images/building-photo.jpg');
// Dedicated welcome artwork with the inova wordmark already composited in.
// Laid out width-fit (never cropped) and bottom-anchored; taller screens get
// the sky color extended above the photo's top edge.
const WELCOME_PHOTO = require('../../assets/images/welcome-hero.jpg');
const WELCOME_SKY = '#51555D';
const WELCOME_SKY_CLEAR = 'rgba(81,85,93,0)';
const WELCOME_FOG = '#7D7572';
const WELCOME_FOG_CLEAR = 'rgba(125,117,114,0)';
const WELCOME_IMG_HEIGHT = Math.ceil(screen.width * (2347 / 1320));
// Sit the artwork near the top of the leftover space (wordmark higher on the
// screen); the remaining gap below is filled with the photo's own fog color.
const WELCOME_IMG_TOP = Math.max(0, Math.round((screen.height - WELCOME_IMG_HEIGHT) * 0.1));
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
      ) : variant === 'welcome' ? (
        <>
          <View style={[StyleSheet.absoluteFill, styles.welcomeSky]} />
          <Image
            source={WELCOME_PHOTO}
            style={styles.welcomeImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          {/* Dissolve the photo's edges into the extended sky/fog fills. */}
          <LinearGradient
            colors={[WELCOME_SKY, WELCOME_SKY_CLEAR]}
            style={styles.welcomeTopBlend}
          />
          <View style={styles.welcomeFogFill} />
          <LinearGradient
            colors={[WELCOME_FOG_CLEAR, WELCOME_FOG]}
            style={styles.welcomeBottomBlend}
          />
          {/* Soft bottom scrim so the CTAs stay legible over the fog. */}
          <LinearGradient
            colors={['rgba(8,8,10,0)', 'rgba(8,8,10,0.35)']}
            locations={[0.62, 1]}
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
  welcomeSky: {
    backgroundColor: WELCOME_SKY,
  },
  // Explicit width/height (not left+right constraints): RN's Fabric Image can
  // fall back to the bitmap's intrinsic size when width is only implied.
  welcomeImage: {
    position: 'absolute',
    top: WELCOME_IMG_TOP,
    left: 0,
    width: screen.width,
    height: WELCOME_IMG_HEIGHT,
  },
  welcomeTopBlend: {
    position: 'absolute',
    top: WELCOME_IMG_TOP,
    left: 0,
    right: 0,
    height: 150,
  },
  welcomeFogFill: {
    position: 'absolute',
    top: WELCOME_IMG_TOP + WELCOME_IMG_HEIGHT,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WELCOME_FOG,
  },
  welcomeBottomBlend: {
    position: 'absolute',
    top: WELCOME_IMG_TOP + WELCOME_IMG_HEIGHT - 110,
    left: 0,
    right: 0,
    height: 110,
  },
  blurVeil: {
    backgroundColor: 'rgba(178,166,151,0.28)',
  },
});
