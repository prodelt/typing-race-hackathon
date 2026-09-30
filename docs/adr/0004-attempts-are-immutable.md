# An attempt is immutable; progress is a fold over attempts

An attempt is one row plus its keystroke event log. Progress, unlocked keys and confidence are derived
by folding over attempts, never edited in place. `metrics` and `curriculum` stay free of browser and
Node APIs so the same code could later run server-side.
