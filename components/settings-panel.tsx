"use client";

import { MODES, TENSES, THEMES, VERB_TYPES, WORD_TYPES } from "@/lib/options";
import { settingApplies, type Settings } from "@/lib/settings";

type Props = {
  settings: Settings;
  onChange: (settings: Settings) => void;
};

export function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <ChipGroup
        label="Modes"
        options={MODES}
        selected={settings.modes ?? []}
        onChange={(modes) => onChange({ ...settings, modes })}
      />
      {/* Mode-specific settings only show when a selected mode uses them. */}
      {settingApplies(settings, "wordType") && (
        <ChipGroup
          label="Word types"
          options={WORD_TYPES}
          selected={settings.wordTypes ?? []}
          onChange={(wordTypes) => onChange({ ...settings, wordTypes })}
        />
      )}
      {settingApplies(settings, "verbType") && (
        <ChipGroup
          label="Verbs (in English)"
          options={VERB_TYPES}
          selected={settings.verbTypes ?? []}
          onChange={(verbTypes) => onChange({ ...settings, verbTypes })}
        />
      )}
      {settingApplies(settings, "tense") && (
        <ChipGroup
          label="Sentence tenses"
          options={TENSES}
          selected={settings.tenses ?? []}
          onChange={(tenses) => onChange({ ...settings, tenses })}
        />
      )}
      {settingApplies(settings, "theme") && (
        <ChipGroup
          label="Themes"
          options={THEMES}
          selected={settings.themes ?? []}
          onChange={(themes) => onChange({ ...settings, themes })}
        />
      )}
    </div>
  );
}

type ChipGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (selected: T[]) => void;
};

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
}: ChipGroupProps<T>) {
  const toggle = (option: T) =>
    onChange(
      selected.includes(option)
        ? selected.filter((value) => value !== option)
        : // Keep the options' own order so the saved list stays tidy.
          options.filter(
            (value) => value === option || selected.includes(value),
          ),
    );

  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-medium">
        {label}
        <span className="text-xs font-normal text-zinc-500">
          {selected.length === 0 ? "All" : `${selected.length} selected`}
        </span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
