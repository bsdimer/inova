import React from 'react';
import { ComingSoon } from '../src/components/ComingSoon';
import { SubScreen } from '../src/components/SubScreen';

// TODO(M2): building contacts (manager, cashier, emergency numbers).
export default function Contacts() {
  return (
    <SubScreen title="Контакти">
      <ComingSoon icon="headset-outline" />
    </SubScreen>
  );
}
