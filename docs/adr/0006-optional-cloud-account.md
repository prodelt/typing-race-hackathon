# Optional Google Account; progress syncs as a union of attempts

Supersedes [0001](0001-local-only-scope.md) for storage. Training stays fully local-first and works
with the backend unreachable. A Learner may sign in with Google, and from then on their attempts,
settings and nick follow them to any device.

- **The identity is lazy.** An anonymous Supabase user appears only on the first race or at Google
  sign-in. Training before sign-in never touches the backend. This keeps junk users and the
  anonymous sign-in rate limit out of the way. Signing in links Google to the existing anonymous
  user (`linkIdentity`), so its id and race history stay.
- **Sync is a set union.** Attempts are immutable with client UUIDs ([0004](0004-attempts-are-immutable.md)),
  so merging two devices is a conflict-free union. Level, XP, Streak and mastery are re-derived. On
  sign-in the local history uploads (through an outbox, idempotent) and the cloud history downloads.
  Settings sync last-write-wins by `updatedAt`. The nick lives on the server. No separate "sync" toggle:
  signed in means syncing.
- **Second device:** when the Google identity already belongs to another user, we sign into that
  account and upload this device's local attempts. The anonymous user's races stay under its guest
  nick and are not merged (a `merge-account` function is possible later).
- **Sign-out** wipes the local copy once the outbox is empty (warning otherwise), so a shared
  computer keeps nobody's progress.
- **Delete my data** removes the user. Owned groups pass to their oldest member and are deleted only
  when empty. Inactive anonymous users are purged after 30 days.
- **Only the nick is public.** Guests get a generated one. Google name, email and avatar are never
  shown.

Considered: an eager anonymous user on first visit (simpler sync, but a user row per visitor and the
30/h/IP sign-in limit at a shared-network demo), and a full account merge (correct but costly and
irrelevant to learning progress).
