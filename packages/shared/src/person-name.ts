/** A person's name as the account stores it (D36): the parts, never the whole. */
export interface PersonName {
  firstName: string;
  /** Empty when only one name was given. */
  lastName: string;
}

/**
 * Splits a name typed as one field: the first word is the first name, the rest
 * the last name («Мария Петрова Иванова» → «Мария» + «Петрова Иванова»). For
 * forms that still ask for one field; a form that asks for the parts sends them.
 */
export function splitFullName(fullName: string): PersonName {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}
