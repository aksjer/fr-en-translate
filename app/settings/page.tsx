import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "@/components/settings";

export const metadata: Metadata = { title: "Settings · FR → EN" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Back to exercises
      </Link>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Settings />
    </main>
  );
}
