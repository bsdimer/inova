import React from 'react';
import { ComingSoon } from '../src/components/ComingSoon';
import { SubScreen } from '../src/components/SubScreen';

// TODO(M2): building documents — protocols, contracts, reports.
export default function Documents() {
  return (
    <SubScreen title="Документи">
      <ComingSoon icon="folder-outline" />
    </SubScreen>
  );
}
