"use client";

import { speak } from "@/lib/speak";

type Props = {
  // English text, maybe with ** ** marks, which aren't read.
  text: string;
};

// A small speaker icon that reads the text next to it aloud.
export function SpeakButton({ text }: Props) {
  return (
    <button
      type="button"
      onClick={() => speak(text.replaceAll("**", ""))}
      aria-label="Listen"
      title="Listen"
      className="inline-flex shrink-0 rounded-full p-1.5 align-middle text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-blue-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M19 5a10 10 0 0 1 0 14" />
      </svg>
    </button>
  );
}
