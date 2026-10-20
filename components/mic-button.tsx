"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Props = {
  // The answer typed so far: what is said is added after it.
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  // While listening, the page keeps the answer as it is: typing or checking
  // would race the words still coming in.
  onListeningChange?: (listening: boolean) => void;
};

// The browser's own speech recognition (Chrome, Edge, Safari); none in Firefox.
function recognitionClass() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

const noSubscribe = () => () => {};

// A microphone icon: the learner says the answer in English, and the words
// are written in the answer field, to check before sending. Hidden where the
// browser can't recognize speech.
export function MicButton({
  value,
  onChange,
  disabled = false,
  onListeningChange,
}: Props) {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => recognitionClass() !== undefined,
    () => false,
  );
  const [listening, setListening] = useState(false);
  // Why the last try failed: a blocked microphone needs the browser settings.
  const [failed, setFailed] = useState<"blocked" | "error" | null>(null);
  const recognition = useRef<SpeechRecognition | null>(null);

  // Leaving the exercise stops listening.
  useEffect(() => () => recognition.current?.abort(), []);
  useEffect(() => {
    if (disabled) recognition.current?.abort();
  }, [disabled]);
  // The page hears when listening starts and stops, and when the button goes.
  useEffect(() => {
    onListeningChange?.(listening);
    return () => onListeningChange?.(false);
  }, [listening]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Recognition = recognitionClass();
    if (!Recognition) return;
    const listener = new Recognition();
    listener.lang = "en-US";
    listener.interimResults = true;
    listener.continuous = false;
    const before = value.trimEnd();
    listener.onresult = (event) => {
      const said = Array.from(event.results, (result) => result[0].transcript)
        .join("")
        .trim();
      onChange(before && said ? `${before} ${said}` : before || said);
    };
    listener.onerror = (event) => {
      // Silence or a stop isn't a failure.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setFailed("blocked");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setFailed("error");
      }
    };
    listener.onend = () => {
      setListening(false);
      recognition.current = null;
    };
    try {
      listener.start();
    } catch {
      // Some browsers throw at once when the microphone is blocked.
      setFailed("blocked");
      return;
    }
    recognition.current = listener;
    setFailed(null);
    setListening(true);
  }

  const label = listening
    ? "Stop listening"
    : failed === "blocked"
      ? "Microphone blocked. Allow it in your browser settings"
      : failed === "error"
        ? "Microphone unavailable. Try again"
        : "Speak your answer";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={label}
      aria-pressed={listening}
      title={label}
      className={`inline-flex shrink-0 rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-40 ${
        listening
          ? "animate-pulse bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
          : failed
            ? "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
            : "text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v4" />
      </svg>
    </button>
  );
}
