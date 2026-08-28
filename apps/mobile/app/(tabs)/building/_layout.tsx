import { Stack } from 'expo-router';
import React from 'react';

/** Building tab hosts its own stack: overview (gauge) → apartments (wheel). */
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
