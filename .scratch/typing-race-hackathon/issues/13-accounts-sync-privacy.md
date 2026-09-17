# 13 Grilling: Accounts, sync & privacy under mandatory authentication

Type: grilling
Status: open
Blocked by: 05, 11

## Question

Every learner must sign in (`docs/adr/0002-mandatory-authentication.md`). How do we make that work while still satisfying the TZ?

- **Sign-in methods:** email magic link, OAuth, or anonymous-then-link. Also how the jury's "new profile" demo step (§9.1) stays fast.
- **Local persistence:** how progress still survives browser restarts locally (§4.1, automated check §8.9).
- **Availability:** what happens when Supabase Auth or DB is unreachable (§11 disqualification risk), including keeping the project from pausing.
- **Multi-device sync:** conflict rules for progress edited on several devices.
- **Access control:** the RLS model.
- **Practical constraints from research 05 §3:**
  - built-in SMTP only reaches team members at 2/hour. **Decided:** email goes through Resend as custom SMTP. Still open: which email flows (password, magic link/OTP) and whether to add OAuth;
  - per-IP sign-up limits;
  - anonymous sign-ins would amend ADR-0002.

  Internal hackathon: no outage-hardening work.
- **Privacy:**
  - the exact personal data collected and the privacy page;
  - self-service profile deletion (§6);
  - consent.

## Answer
