// Dependency-free so it can be unit-tested outside Deno (src/test/adviceFilter.test.ts).
// What a reply must never read like. A prompt can't guarantee model behavior,
// so every generated answer is also checked here; a hit swaps the whole reply
// for the plain no-advice message below instead of showing it.
const ADVICE_PATTERNS: RegExp[] = [
  /\byou should (buy|sell|invest|put|own|hold|short|avoid|consider (buying|selling|investing|adding|shorting))\b/i,
  /\bi (would |'d )?(recommend|suggest|advise)\b/i,
  /\bi('d| would) (buy|sell|pick|choose|go with)\b/i,
  /\b(my|our) (top )?(pick|recommendation)s?\b/i,
  /\b(is|are|would be) (a |an )?(good|great|solid|safe|smart) (buy|investment|choice|pick|fit) for you\b/i,
  /\b(best|safest|top) (etf|fund|stock|investment)s? (for you|to buy|to own)\b/i,
];

// Promises of returns are only a problem when stated, not when denied ("no
// fund is guaranteed to return 10%" is exactly what the assistant should say),
// so these are checked per sentence and skipped when the sentence negates them.
const PROMISE_PATTERNS: RegExp[] = [
  /\bwill (return|earn|make|deliver|hit|reach) (you )?(about |around |roughly )?\d+(\.\d+)?\s?%/i,
  /\bguaranteed (to )?(return|earn|make|profit)\b/i,
];
const NEGATION = /\b(no|not|never|cannot|can't|isn't|aren't|won't|nothing|nobody|without)\b|n't\b/i;

export const adviceViolation = (text: string): boolean =>
  ADVICE_PATTERNS.some((p) => p.test(text)) ||
  text.split(/(?<=[.!?])\s+/).some((sentence) => !NEGATION.test(sentence) && PROMISE_PATTERNS.some((p) => p.test(sentence)));

export const NO_ADVICE_REPLY =
  "I can show you what the data says - readings, scores, how funds and stocks have moved and how volatile they are - and explain the tradeoffs, but I can't recommend what to buy or sell, and nothing here is tailored to your situation. Try asking about a specific stock or fund, or about how a category compares, and I'll pull the facts.";

