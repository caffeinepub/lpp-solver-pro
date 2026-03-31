# LPP Solver Pro

## Current State
Admin access is claimed via token dialog and stored in `isAdmin` React state for the entire session. Once claimed, Users and Admin panels remain accessible indefinitely until page refresh. The backend correctly enforces admin checks on all data endpoints.

## Requested Changes (Diff)

### Add
- 5-minute countdown timer displayed in the top bar when admin session is active
- Auto re-lock logic: after 5 minutes, isAdmin resets to false, panels close
- Token prompt re-appears if user tries to access panels after lock

### Modify
- isAdmin state: track adminUnlockedAt timestamp, derive active admin status from elapsed time
- Top bar: show countdown timer (MM:SS) next to admin buttons when unlocked
- Key icon always visible so token can be re-entered after lock

### Remove
- Permanent admin session (no more session-persistent admin access)
- Initial isCallerAdmin() check on mount

## Implementation Plan
1. Replace isAdmin boolean with adminUnlockedAt: number | null state
2. Derive isAdmin = adminUnlockedAt !== null && Date.now() - adminUnlockedAt < 300000
3. Add 1-second interval useEffect to force re-render, auto-close panels and reset on expiry
4. On successful token claim: set adminUnlockedAt = Date.now()
5. Show MM:SS countdown in top bar in amber color when admin is active
6. Always show key icon button for re-entry
