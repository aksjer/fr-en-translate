"use client";

import { SettingsPanel } from "@/components/settings-panel";
import { useSettings } from "@/lib/use-settings";

// The settings: changes are saved in this browser as they are made, and apply
// to the next exercise.
export function Settings() {
  const [settings, setSettings] = useSettings();
  return <SettingsPanel settings={settings} onChange={setSettings} />;
}
