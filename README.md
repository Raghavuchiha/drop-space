# DropSpace — Your personal cloud pocket

Drop a file, note, or link from one device and open it from another.
A full responsive React frontend powered directly by Supabase.

## What is included

- Email/password sign up, sign in, and persistent sessions (Supabase Auth)
- Private file uploads, previews, downloads, and deletes (Supabase Storage)
- Notes and saved URLs (Supabase Postgres)
- Search, file sorting, starred items, grid/list layouts
- Mobile-friendly interface, multi-file drag-and-drop, upload size checks
- Row Level Security for both database rows and storage objects

## Requirements

- Node.js 22+ with npm
- A Supabase project
- A connection to the Internet while using it

## Run locally

1. Create a **new** Supabase project at https://supabase.com/dashboard.
2. Open **SQL Editor**, paste `supabase/setup.sql`, and click **Run**.
3. In **Authentication > Providers**, ensure Email authentication is enabled.
4. Go to **Project Settings > API Keys**, and copy the project URL and
   **publishable** (`sb_publishable_...`) key. In recent dashboards they are
   also available in the **Connect** dialog.
5. In the root folder, create `.env` using `.env.example`:

   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

6. Install and launch:

   ```bash
   npm install
   npm run dev
   ```

7. Open `http://localhost:5173` on your laptop and create an account.
   If email confirmation is enabled in your Supabase project, confirm the
   signup email before signing in.

**Use the same credentials on each device to access the same items.**

## Access on your phone

For the most reliable setup, deploy the site to a HTTPS host such as Vercel or
Netlify; add the exact same two Vite environment variables in the hosting
dashboard, and add the production URL in Supabase **Authentication > URL
Configuration** as the Site URL (and an allowed redirect URL, if needed).

You can test on the same Wi-Fi using the laptop's LAN IP with Vite (for example
`http://192.168.1.10:5173`), but HTTPS deployment is preferred for clipboard
and other secure-browser functionality. LAN IP access is not cloud hosting;
the laptop must be running.

## Usage

- Click **Upload files**, or drag files into the drop area.
- Click **Quick note** to save text; **Save a link** for a website.
- Search items, star favorites, and view by type.
- Use the arrow button to open a note, link, or temporary signed file URL.
- Download or delete files from the item toolbar.

## Architecture

```
Android / iOS browser ─┐
                       ├── React / Vite frontend (deploy once)
Windows / Mac browser ─┘
                              │
                              ▼
                           Supabase
                     ├─ Auth: same account
                     ├─ Postgres: item metadata
                     ├─ Storage: private uploaded files
                     └─ RLS: only owner can read/write
```

## Security & limits

- **Only** the Supabase publishable key goes in client-side `.env`.
  Never use a service-role key, secret key, or database password in the app.
- Uploaded files are in a **private** Storage bucket. Signed preview links
  expire after one minute; already-downloaded copies aren't revoked.
- File paths are prefixed with the authenticated user's UUID. Both storage
  access rules and database row policies verify user identity.
- The app enforces **50 MB per file**, but Supabase project-level upload
  limits and total storage quota can be lower or higher depending on plan.
- This is an MVP, not a backup system or end-to-end encrypted vault.
  Consider backups, retention, malware scanning, and upload resumability
  before putting critical or untrusted content into production.
- npm dependencies are exact-version pinned in `package.json`. Run `npm
  install` with internet access to generate `package-lock.json` on your
  machine and commit it for reproducible installs.

## Troubleshooting

- **Configuration screen appears:** `.env` is missing or has placeholder
  credentials. Restart the Vite dev server after editing.
- **"relation drop_items does not exist":** run `supabase/setup.sql` in the
  **same project** whose URL is in `.env`.
- **"row-level security policy" upload error:** check that the bucket is
  `drop-space`, that `setup.sql` completed, and that you're signed in.
- **Upload bigger than 50 MB:** split/compress or use a larger storage
  limit and update both app/backend settings.
- **No confirmation email:** check Supabase Email provider and spam folder;
  free default-email limits may apply.
- **Another device shows an empty space:** sign into the same account and
  same deployed app pointing to the same Supabase project.
- **Auth API fails:** check browser DevTools Network panel; confirm
  Supabase URL and publishable key match.

## Next improvements

Shared spaces, folders, tags, paste-to-upload, link previews, password reset,
upload progress, resumable uploads, and PWA installation.
