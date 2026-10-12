"use client";

import { LEVELS, TENSES, THEMES, type Settings } from "@/lib/settings";

type Props = {
  settings: Settings;
  onChange: (settings: Settings) => void;
};

export function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <ChipGroup
        label="Niveaux"
        options={LEVELS}
        selected={settings.levels ?? []}
        onChange={(levels) => onChange({ ...settings, levels })}
      />
      <ChipGroup
        label="Temps"
        options={TENSES}
        selected={settings.tenses ?? []}
        onChange={(tenses) => onChange({ ...settings, tenses })}
      />
      <ChipGroup
        label="Thèmes"
        options={THEMES}
        selected={settings.themes ?? []}
        onChange={(themes) => onChange({ ...settings, themes })}
      />
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
          options.filter((value) => value === option || selected.includes(value)),
    );

  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-medium">
        {label}
        <span className="text-xs font-normal text-zinc-500">
          {selected.length === 0 ? "tous" : `${selected.length} choisi(s)`}
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
