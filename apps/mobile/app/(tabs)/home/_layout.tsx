import { Stack } from 'expo-router';
import React from 'react';

/** Home tab stack: dashboard → history (and other home-pushed screens). */
export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
