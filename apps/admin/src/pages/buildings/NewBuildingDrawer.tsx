import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { AssessmentBasis, BuildingDetail } from '@inova/shared';
import { CaretDown, Check, Plus, X } from '../../components/icons';
import { ConfirmDialog, Drawer } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import {
  ASSESSMENT_LABELS,
  ASSESSMENT_ORDER,
  DRAFT_MAX_LENGTH,
  EMPTY_DRAFT,
  draftErrors,
  entranceName,
  type BuildingDraft,
  type DraftField,
} from './model';

const inputClass =
  'text-body-14 h-11 w-full rounded-xl border bg-panel-control px-3.5 text-panel-ink outline-none placeholder:text-panel-ink-faint focus-visible:border-panel-ink';

/**
 * «Нова сграда» (2564:2, 402 2566:2): the building is created as a draft
 * (POST /buildings); its properties come after, one by one or by import.
 * The photo is drawn too but waits for M6 (#51).
 */
export function NewBuildingDrawer({
  open,
  onClose,
  onCreated,
  tenantId,
  cities,
  districts,
}: {
  open: boolean;
  onClose: () => void;
  /** After the panel has closed on a created building. */
  onCreated: () => void;
  tenantId: string | null;
  /** The values the organisation already uses, offered while typing (D24). */
  cities: string[];
  districts: string[];
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BuildingDraft>(EMPTY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);
  // Each refused «Създай» counts once, so the first wrong field takes the focus
  // even when the same fields stay wrong.
  const [refusals, setRefusals] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const errors = draftErrors(draft);
  const invalid = Object.keys(errors).length > 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(EMPTY_DRAFT);

  const leave = () => {
    setDraft(EMPTY_DRAFT);
    setShowErrors(false);
    setRefusals(0);
    setAsking(false);
    setFailure(null);
    onClose();
  };

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<BuildingDetail>('/buildings', { method: 'POST', tenantId: tenantId!, body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['buildings', tenantId] });
      leave();
      onCreated();
    },
    onError: (e) => setFailure(failureText(e)),
  });

  useEffect(() => {
    if (refusals > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [refusals]);

  const save = () => {
    setAsking(false);
    setShowErrors(true);
    if (invalid) {
      setRefusals((n) => n + 1);
      return;
    }
    if (create.isPending) return;
    setFailure(null);
    create.mutate({
      name: draft.name.trim(),
      address: draft.address.trim(),
      city: draft.city.trim(),
      district: draft.district.trim(),
      entrances: draft.entrances,
      floors: Number(draft.floors),
      hasElevator: draft.hasElevator,
      assessmentBasis: draft.assessmentBasis,
    });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };
  const close = () => {
    if (create.isPending) return;
    if (dirty) setAsking(true);
    else leave();
  };

  const set = <K extends keyof BuildingDraft>(key: K, value: BuildingDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));
  const errorOf = (field: DraftField) => (showErrors ? errors[field] : undefined);

  const formId = useId();

  return (
    <>
      <Drawer
        open={open}
        onClose={close}
        label="Нова сграда"
        phoneFullScreen
        header={
          <div className="flex items-center gap-3.5">
            <div className="min-w-0 flex-1">
              <h2 className="text-title-16-tight font-semibold">Нова сграда</h2>
              <p className="text-body-13 mt-0.5 text-panel-ink-muted">
                Сградата се създава като чернова. Активирате я, щом има поне един имот.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              data-dialog-close
              aria-label="Затвори"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel-row text-panel-ink transition-colors hover:bg-panel-row-strong"
            >
              <X size="1.125rem" />
            </button>
          </div>
        }
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={close}
              disabled={create.isPending}
              className="text-body-14 h-11 flex-1 rounded-full border border-panel-border bg-panel-row px-6 font-semibold text-panel-ink disabled:opacity-40 sm:w-[11.25rem] sm:flex-none"
            >
              Отказ
            </button>
            <button
              type="submit"
              form={formId}
              disabled={create.isPending}
              className="text-body-14 h-11 flex-1 rounded-full bg-panel-ink px-6 font-semibold text-panel-ink-inverse disabled:opacity-40 sm:w-[11.25rem] sm:flex-none"
            >
              {create.isPending ? 'Създава…' : 'Създай'}
            </button>
          </div>
        }
      >
        <form ref={form} id={formId} onSubmit={submit} noValidate>
          <fieldset disabled={create.isPending} className="space-y-[1.375rem]">
            {/* One announcement for all the wrong fields; each field names its own. */}
            {showErrors && invalid && (
              <p role="alert" className="sr-only">
                {wrongFields(Object.keys(errors).length)}
              </p>
            )}
            {failure && (
              <p
                role="alert"
                className="text-body-13 rounded-xl bg-panel-row px-3.5 py-2.5 font-medium text-panel-status-urgent"
              >
                {failure}
              </p>
            )}

            <Section title="Сграда" hint="Градът и кварталът са за филтъра в „Сгради“.">
              <TextField
                label="Име"
                maxLength={DRAFT_MAX_LENGTH.name}
                value={draft.name}
                onChange={(v) => set('name', v)}
                error={errorOf('name')}
                autoFocus
              />
              <TextField
                label="Адрес"
                maxLength={DRAFT_MAX_LENGTH.address}
                value={draft.address}
                onChange={(v) => set('address', v)}
                error={errorOf('address')}
                autoComplete="street-address"
              />
              <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                <TextField
                  label="Град"
                  maxLength={DRAFT_MAX_LENGTH.city}
                  value={draft.city}
                  onChange={(v) => set('city', v)}
                  error={errorOf('city')}
                  suggestions={cities}
                  autoComplete="address-level2"
                />
                <TextField
                  label="Квартал"
                  maxLength={DRAFT_MAX_LENGTH.district}
                  value={draft.district}
                  onChange={(v) => set('district', v)}
                  error={errorOf('district')}
                  suggestions={districts}
                />
              </div>
            </Section>

            <Section
              title="Входове"
              hint="Имотите се добавят след това — един по един или с импорт."
            >
              <Entrances value={draft.entrances} onChange={(v) => set('entrances', v)} />
            </Section>

            <Section title="Етажи и асансьор">
              {/* The option sits level with the input (2564:354: 20 lower, 48 tall). */}
              <div className="flex items-start gap-3">
                <div className="w-[8.75rem] shrink-0">
                  <TextField
                    label="Етажи"
                    value={draft.floors}
                    onChange={(v) => set('floors', v.replace(/\D/g, ''))}
                    error={errorOf('floors')}
                    inputMode="numeric"
                  />
                </div>
                <label
                  className={`mt-5 flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl border border-panel-border px-4 py-3 transition-colors ${
                    draft.hasElevator
                      ? 'bg-panel-row-strong'
                      : 'bg-panel-row hover:bg-panel-row-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={draft.hasElevator}
                    onChange={(e) => set('hasElevator', e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-panel-ink ${
                      draft.hasElevator
                        ? 'bg-panel-ink text-panel-ink-inverse'
                        : 'border border-panel-check-edge'
                    }`}
                  >
                    {draft.hasElevator && <Check size="0.875rem" weight="bold" />}
                  </span>
                  <span className="text-body-14 font-semibold text-panel-ink">Има асансьор</span>
                </label>
              </div>
            </Section>

            <Section
              title="Входни такси"
              hint="Как се разпределят входните такси между имотите. Може да се смени по‑късно — вече начисленото не се променя."
            >
              <BasisField
                value={draft.assessmentBasis}
                onChange={(v) => set('assessmentBasis', v)}
                error={errorOf('assessmentBasis')}
              />
            </Section>
          </fieldset>
        </form>
      </Drawer>
      <ConfirmDialog
        open={asking}
        title="Да се запазят ли промените?"
        primary={{ label: 'Запази', onClick: save }}
        danger={{ label: 'Не запазвай', onClick: leave }}
        onDismiss={() => setAsking(false)}
      >
        Промените още не са запазени.
      </ConfirmDialog>
    </>
  );
}

function wrongFields(count: number): string {
  return count === 1 ? 'Проверете едно поле.' : `Проверете ${count} полета.`;
}

function failureText(error: Error): string {
  if (error instanceof ApiError && error.status === 403) {
    return 'Ролята ви не може да създава сгради.';
  }
  // The form checks what the server checks; a refusal it missed is still about the fields.
  if (error instanceof ApiError && error.status === 400) {
    return 'Сървърът не прие данните. Проверете полетата и опитайте отново.';
  }
  return 'Сградата не беше създадена. Проверете връзката и опитайте отново.';
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-label-14 font-semibold">{title}</h3>
      {children}
      {hint && <p className="text-body-13 text-panel-ink-muted">{hint}</p>}
    </section>
  );
}

function FieldShell({
  id,
  label,
  error,
  errorId,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <label htmlFor={id} className="text-body-13 block font-medium text-panel-ink-muted">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} className="text-body-13 font-medium text-panel-status-urgent">
          {error}
        </p>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  suggestions,
  autoFocus = false,
  autoComplete = 'off',
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
  /** Values offered under the field; anything else may still be typed. */
  suggestions?: string[];
  autoFocus?: boolean;
  autoComplete?: string;
  inputMode?: 'numeric';
  maxLength?: number;
}) {
  const id = useId();
  const listId = useId();
  const errorId = useId();
  return (
    <FieldShell id={id} label={label} error={error} errorId={errorId}>
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          list={suggestions ? listId : undefined}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          data-autofocus={autoFocus ? '' : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClass} ${suggestions ? 'pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0' : ''} ${
            error ? 'border-panel-status-urgent' : 'border-panel-border'
          }`}
        />
        {suggestions && (
          <>
            <CaretDown
              aria-hidden
              size="1.25rem"
              className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-panel-ink-muted"
            />
            <datalist id={listId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </>
        )}
      </div>
    </FieldShell>
  );
}

function BasisField({
  value,
  onChange,
  error,
}: {
  value: AssessmentBasis | '';
  onChange: (value: AssessmentBasis) => void;
  error: string | undefined;
}) {
  const id = useId();
  const errorId = useId();
  return (
    <FieldShell id={id} label="Разпределение на таксите" error={error} errorId={errorId}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => {
            const picked = ASSESSMENT_ORDER.find((basis) => basis === e.target.value);
            if (picked) onChange(picked);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClass} appearance-none pr-10 ${value ? '' : 'text-panel-ink-faint'} ${
            error ? 'border-panel-status-urgent' : 'border-panel-border'
          }`}
        >
          <option value="" disabled>
            Изберете
          </option>
          {ASSESSMENT_ORDER.map((basis) => (
            <option key={basis} value={basis} className="text-panel-ink">
              {ASSESSMENT_LABELS[basis]}
            </option>
          ))}
        </select>
        <CaretDown
          aria-hidden
          size="1.25rem"
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-panel-ink-muted"
        />
      </div>
    </FieldShell>
  );
}

/** The entrance chips (2564:330): × removes one, «Добави вход» opens a short field. */
function Entrances({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const problemId = useId();

  const add = () => {
    const name = entranceName(typed);
    if (!name) {
      setAdding(false);
      return;
    }
    if (value.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      setProblem(`Вход ${name} вече е добавен.`);
      return;
    }
    onChange([...value, name]);
    setTyped('');
    setProblem(null);
    field.current?.focus();
  };
  const cancel = () => {
    setAdding(false);
    setTyped('');
    setProblem(null);
  };

  const chip = 'text-label-12 inline-flex h-7 items-center gap-1 rounded-full border font-semibold';

  return (
    <div className="space-y-1.5">
      <ul className="flex flex-wrap items-center gap-2 pt-0.5" aria-label="Входове">
        {value.map((name) => (
          <li
            key={name}
            className={`${chip} border-panel-border bg-panel-row pr-1 pl-3 text-panel-ink`}
          >
            Вход {name}
            <button
              type="button"
              onClick={() => onChange(value.filter((other) => other !== name))}
              aria-label={`Премахни вход ${name}`}
              className="flex h-5 w-5 items-center justify-center rounded-full text-panel-ink-muted hover:bg-panel-row-strong hover:text-panel-ink"
            >
              <X size="0.875rem" />
            </button>
          </li>
        ))}
        <li>
          {adding ? (
            <input
              ref={field}
              autoFocus
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                } else if (e.key === 'Escape') {
                  // The field closes, not the panel.
                  e.preventDefault();
                  e.stopPropagation();
                  cancel();
                }
              }}
              onBlur={add}
              aria-label="Име на входа"
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? problemId : undefined}
              placeholder="Б"
              maxLength={20}
              className={`${chip} w-28 border-panel-border bg-panel-control px-3 text-panel-ink outline-none placeholder:text-panel-ink-faint focus-visible:border-panel-ink`}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={value.length >= 50}
              className={`${chip} border-dashed border-panel-border pr-3 pl-2.5 text-panel-ink-muted hover:text-panel-ink disabled:opacity-40`}
            >
              <Plus size="0.875rem" />
              Добави вход
            </button>
          )}
        </li>
      </ul>
      {problem && (
        <p
          id={problemId}
          role="alert"
          className="text-body-13 font-medium text-panel-status-urgent"
        >
          {problem}
        </p>
      )}
    </div>
  );
}
