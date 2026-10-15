// Random ingredients for sentences and paragraphs: a person, a place and a moment.
// The model invents a situation around them on the chosen theme, so two exercises
// on the same theme differ (20 × 20 × 20 = 8,000 combinations).
// They only go into the prompt, which is in English; the sentence stays in French.

const PEOPLE = [
  "a nurse",
  "a ten-year-old child",
  "my neighbor",
  "a retired teacher",
  "two roommates",
  "a taxi driver",
  "my grandparents",
  "a new colleague",
  "a tourist",
  "a teenager",
  "a baker",
  "my older sister",
  "a student",
  "a farmer",
  "a young couple",
  "a mail carrier",
  "a chef",
  "my best friend",
  "a firefighter",
  "a shy musician",
] as const;

const PLACES = [
  "in a train station",
  "at the beach",
  "in a small village",
  "in an office",
  "at a hospital",
  "in a supermarket",
  "on a bus",
  "in a park",
  "at a wedding",
  "in a mountain cabin",
  "at an airport",
  "in a kitchen",
  "at a library",
  "in a stadium",
  "at a street market",
  "in a hotel lobby",
  "at a gas station",
  "in a garden",
  "at a museum",
  "in an elevator",
] as const;

const MOMENTS = [
  "early on a Monday morning",
  "during a heat wave",
  "on New Year's Eve",
  "late at night",
  "during a storm",
  "on the first day of vacation",
  "at lunchtime",
  "on a rainy Sunday",
  "just before an important meeting",
  "during a power outage",
  "on their birthday",
  "after a long trip",
  "in the middle of winter",
  "during a strike",
  "on the last day of school",
  "the day after a party",
  "at sunrise",
  "during a holiday weekend",
  "five minutes before closing time",
  "on a snowy evening",
] as const;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function pickSituation(): string {
  return `${pick(PEOPLE)}, ${pick(PLACES)}, ${pick(MOMENTS)}`;
}
