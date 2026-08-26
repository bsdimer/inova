import React from 'react';
import { ComingSoon } from '../src/components/ComingSoon';
import { SubScreen } from '../src/components/SubScreen';

// TODO(M7+): surveys API with server-side vote tallies.
export default function Surveys() {
  return (
    <SubScreen title="Анкети">
      <ComingSoon icon="stats-chart-outline" />
    </SubScreen>
  );
}
