"use client";

import { useActionState, useMemo, useState } from "react";

import { WOW_CLASSES, CLASS_NAMES } from "@/lib/wow";
import { submitApplication, type ApplyFormState } from "./actions";

const initialState: ApplyFormState = { ok: true };

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="stat-label mb-1.5 block">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-xs text-stripe-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-edge bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-papi-purple focus:outline-none";

export function ApplyForm() {
  const [state, formAction, pending] = useActionState(submitApplication, initialState);
  const [className, setClassName] = useState("");
  const specs = useMemo(
    () => (className ? (WOW_CLASSES[className]?.specs ?? []) : []),
    [className],
  );
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      {state.message && !state.ok ? (
        <p
          className="rounded-md border border-stripe-red/40 bg-stripe-red/10 px-4 py-3 text-sm text-stripe-red"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Discord" name="discordName" error={err.discordName} hint="fx frostmage">
          <input id="discordName" name="discordName" required maxLength={64} className={inputCls} />
        </Field>
        <Field label="Karakter" name="characterName" error={err.characterName}>
          <input id="characterName" name="characterName" required maxLength={24} className={inputCls} />
        </Field>
        <Field label="Realm" name="realm" error={err.realm}>
          <input id="realm" name="realm" required maxLength={64} className={inputCls} />
        </Field>
        <Field label="Klasse" name="className" error={err.className}>
          <select
            id="className"
            name="className"
            required
            className={inputCls}
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          >
            <option value="">Vælg klasse…</option>
            {CLASS_NAMES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hovedspec" name="specName" error={err.specName}>
          <select id="specName" name="specName" required className={inputCls} disabled={!className}>
            <option value="">{className ? "Vælg spec…" : "Vælg en klasse først"}</option>
            {specs.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.role.toLowerCase()})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Andre specs" name="altSpecs" error={err.altSpecs} hint="Valgfrit">
          <input id="altSpecs" name="altSpecs" maxLength={120} className={inputCls} />
        </Field>
        <Field
          label="Warcraft Logs"
          name="warcraftLogsUrl"
          error={err.warcraftLogsUrl}
          hint="Link til din karakter — valgfrit, men det hjælper"
        >
          <input
            id="warcraftLogsUrl"
            name="warcraftLogsUrl"
            type="url"
            placeholder="https://www.warcraftlogs.com/character/…"
            className={inputCls}
          />
        </Field>
        <Field label="Raider.IO" name="raiderIoUrl" error={err.raiderIoUrl} hint="Valgfrit">
          <input
            id="raiderIoUrl"
            name="raiderIoUrl"
            type="url"
            placeholder="https://raider.io/characters/…"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Tidligere guild" name="previousGuild" error={err.previousGuild} hint="Valgfrit">
        <input id="previousGuild" name="previousGuild" maxLength={100} className={inputCls} />
      </Field>
      <Field label="Raid-erfaring" name="raidExperience" error={err.raidExperience}>
        <textarea
          id="raidExperience"
          name="raidExperience"
          required
          rows={3}
          maxLength={2000}
          className={inputCls}
          placeholder="Hvad har du spillet, hvor længe, og hvad har du prøvet?"
        />
      </Field>
      <Field
        label="Hvornår kan du"
        name="availability"
        error={err.availability}
        hint="Vi raider onsdag og søndag, 19:30–22:30"
      >
        <input id="availability" name="availability" required maxLength={300} className={inputCls} />
      </Field>
      <Field label="Hvad forventer du af en guild?" name="expectations" error={err.expectations} hint="Valgfrit">
        <textarea id="expectations" name="expectations" rows={2} maxLength={2000} className={inputCls} />
      </Field>
      <Field label="Hvorfor PAPI?" name="whyPapi" error={err.whyPapi}>
        <textarea id="whyPapi" name="whyPapi" required rows={3} maxLength={2000} className={inputCls} />
      </Field>
      <Field label="Andet vi skal vide?" name="comment" error={err.comment} hint="Valgfrit">
        <textarea id="comment" name="comment" rows={2} maxLength={2000} className={inputCls} />
      </Field>

      {/* Honeypot — hidden from real users, irresistible to bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-papi-indigo px-8 py-3.5 font-display text-sm font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-papi-purple disabled:opacity-60"
        >
          {pending ? "Sender…" : "Send ansøgning"}
        </button>
      </div>
    </form>
  );
}
