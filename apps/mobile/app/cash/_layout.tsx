import { Stack } from 'expo-router';
import React from 'react';

/** Standalone cash stack: monthly list → expense detail (no tab bar). */
export default function CashLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    />
  );
}
