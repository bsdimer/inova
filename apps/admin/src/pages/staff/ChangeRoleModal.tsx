import { useState } from 'react';
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from '../../components/ui';
import type { Role, StaffMember } from '../../lib/api';

/**
 * Interim role change. The M1 design replaces this with the roles-and-scope
 * drawer (impact summary, validation, scope section); the drawer is the next
 * change set, so this modal only keeps the action reachable meanwhile.
 */
export function ChangeRoleModal({
  member,
  roles,
  onClose,
  onSave,
}: {
  member: StaffMember | null;
  roles: Role[];
  onClose: () => void;
  onSave: (roleKey: string) => void;
}) {
  const [roleKey, setRoleKey] = useState<string | null>(null);
  const current = roleKey ?? member?.roleKey ?? '';
  const close = () => {
    setRoleKey(null);
    onClose();
  };

  return (
    <Modal open={member !== null} title="Change role" onClose={close}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(current);
          setRoleKey(null);
        }}
      >
        <p className="text-sm text-landmark">
          <strong className="text-gold-black">{member?.fullName}</strong> keeps their status; only
          the role changes. Building scope arrives with M2.
        </p>
        <Field label="Role">
          <select
            className={inputClass}
            value={current}
            onChange={(e) => setRoleKey(e.target.value)}
          >
            {roles.map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={close}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={!member || current === member.roleKey}>
            Save
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
