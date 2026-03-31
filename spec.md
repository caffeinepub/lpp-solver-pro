# LPP Solver Pro

## Current State
The app is a full-featured LPP solver with Internet Identity auth, problem history, PDF export, feedback system, and admin/users panels. Admin access is token-gated via "Apple$12". The Users Panel shows activity data (principal, visits, solves, location, etc.) but has no email column. There is no first-login email collection flow.

## Requested Changes (Diff)

### Add
- First-login mandatory email prompt: after first login (when user has no profile), show an email collection screen before the solver. User must enter email to proceed. Email saved via `saveCallerUserProfile`.
- Backend: `getAllUserProfiles()` admin-only query that returns all user profiles (principal + email).
- Email column in Users Panel table, populated by cross-referencing user profiles with activity records.

### Modify
- App.tsx: after identity is set, check `getCallerUserProfile()`. If null, show EmailSetupScreen. Once email is saved, show the solver.
- UsersPanel.tsx: fetch all user profiles alongside activity, add Email column.
- backend main.mo: add `getAllUserProfiles` query (admin only).

### Remove
- Nothing removed.

## Implementation Plan
1. Add `getAllUserProfiles` to backend (Motoko + update backend.d.ts).
2. Create `EmailSetupScreen` component: form with mandatory email field, calls `saveCallerUserProfile`, then sets profile state to proceed.
3. In App.tsx: after identity resolves, fetch `getCallerUserProfile()`. If no profile, render `EmailSetupScreen` instead of solver.
4. In UsersPanel.tsx: also fetch `getAllUserProfiles()`, build a map of principal→email, add Email column to table.
