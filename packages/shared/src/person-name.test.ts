import { describe, expect, it } from 'vitest';
import { splitFullName } from './person-name';

describe('splitFullName', () => {
  it.each([
    ['Мария Иванова', 'Мария', 'Иванова'],
    ['Мария Петрова Иванова', 'Мария', 'Петрова Иванова'],
    ['  Nikol   Petrova ', 'Nikol', 'Petrova'],
    ['Пламен', 'Пламен', ''],
    ['', '', ''],
  ])('%j → %j + %j', (input, firstName, lastName) => {
    expect(splitFullName(input)).toEqual({ firstName, lastName });
  });
});
