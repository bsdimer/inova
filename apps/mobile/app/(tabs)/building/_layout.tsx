import { Stack } from 'expo-router';
import React from 'react';

/** Building tab stack: overview → apartments / documents (wheel screens). */
export default function BuildingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
