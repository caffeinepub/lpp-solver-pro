# LPP Solver Pro

## Current State
- Full-featured LPP solver with Simplex, Dual Simplex, and Cutting-Plane methods
- Mobile-first React frontend with InputForm, SolverView, ProblemHistory components
- Problem history persisted in localStorage
- PDF export with colorful theme, Ravi SKT watermark
- No authentication — app is fully open to anyone
- Backend only has `isAlive()` function

## Requested Changes (Diff)

### Add
- Login screen: username/email + password fields, styled with Ravi SKT branding (Parisienne font, blue accents)
- Registration screen: name, username/email, password, confirm password fields
- Authentication gate: users must log in before accessing the LPP Solver
- Session persistence: stay logged in across page refreshes
- Logout button accessible from within the solver app
- Backend authorization via the Caffeine `authorization` component

### Modify
- App.tsx: wrap entire app in auth check — show login/register screens if not authenticated, show solver if authenticated
- Backend: integrate authorization component for user management

### Remove
- Nothing removed

## Implementation Plan
1. Select `authorization` Caffeine component
2. Regenerate Motoko backend with authorization integrated
3. Create `AuthScreen.tsx` component with login and registration forms (toggle between them)
4. Update `App.tsx` to check auth state — render `AuthScreen` if not logged in, render full app if logged in
5. Add logout button to the main app header/top area
6. Style login/register screens with Ravi SKT branding (Parisienne font, blue theme, mobile-first)
7. Wire up backend auth calls (register, login, logout)
