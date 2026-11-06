# Unified Identifier & Google OAuth Experience Refinement

## Problem Statement

How might we provide a frictionless, modern login & registration experience in Cashow that unifies email and username identifiers while maintaining rock-solid security and clear multi-auth state visibility in settings?

## Recommended Direction

### 1. Dual-Purpose Identifier for Password Login

- The login input changes label/placeholder from `"Username"` to `"Username atau Email"`.
- Backend accepts `identifier: string` (or accepts either `username` or `email`).
- If the identifier contains `@`, it queries `User.where({ email: identifier.toLowerCase() })`.
- If not (or as fallback), it queries `User.where({ username: identifier })`.
- Timing-safe error message preserves privacy: `"Username, email, atau kata sandi salah."`

### 2. Registration / Setup Alignment

- On the password registration tab (`/setup`), accept:
  - **Email** (optional or recommended, so users can later log in with email or link Google easily).
  - **Username** (unique handle, e.g. `budi`).
  - Or, if a user enters an email as their primary identifier, automatically suggest/derive a default username (e.g. `budi` from `budi@gmail.com`).
- This guarantees every user has both a clean display username for ledger tagging and an optional email for passwordless/Google linking.

### 3. Settings: "Metode Masuk & Akun Terhubung" (Connected Accounts)

- In `/app/settings` under **Keamanan & Akses**:
  - Show status for all 3 auth methods:
    1. **Passkey (Biometrik / Kunci Fisik)**: Active passkeys list with add/revoke controls.
    2. **Kata Sandi**: Status (Aktif / Belum Diatur).
    3. **Akun Google**:
       - If linked (`googleId` present): Shows `Terhubung` with the Google email badge and a disconnect button (if passkey/password is available to prevent lockout).
       - If not linked: Shows `Belum Terhubung` with a `"Hubungkan Akun Google"` button.

### 4. Seamless Navigation (`returnTo` / `next`)

- Support `?returnTo=/app/...` in login and Google OAuth initiation.
- Sanitize and validate that `returnTo` is a relative internal path starting with `/app` (preventing open redirect vulnerabilities).

---

## Key Assumptions to Validate

- [ ] Users prefer having a clean username handle (e.g. `@budi`) for their personal ledger profile while being able to type their email on login.
- [ ] Auto-linking by verified Google email is frictionless and safe when verified by Google OAuth (`email_verified === true`).
- [ ] Disconnecting Google account in settings must ensure the user has at least one alternative login method (password or passkey) active to avoid account lockout.

---

## MVP Scope

### In Scope

1. **API Update (`POST /api/auth/login/password`)**:
   - Accept `identifier` (or fallback `username`).
   - Query user by `username OR email` (case-insensitive for email).
2. **Setup Update (`POST /api/auth/register/password`)**:
   - Allow optional `email` alongside `username` and `password`.
3. **UI Updates (`LoginForm` & `SetupForm`)**:
   - Update label and placeholder to `"Username atau Email"`.
   - Setup form includes optional Email field for password users.
4. **Settings Page (`apps/web/app/app/settings/page.tsx`)**:
   - Add **"Akun Terhubung (Google)"** card with status and link/unlink actions.
5. **OAuth Route (`/api/auth/google`)**:
   - Support `returnTo` preserving target URL after authentication.

### Not Doing (and Why)

- **Mandatory Email Verification via SMTP**: Cashow is designed to run self-hosted with zero mandatory third-party dependencies (email server not required for basic functionality).
- **Multiple Google Accounts Linked to a Single User**: One Google account per user is sufficient and prevents identity fragmentation.
