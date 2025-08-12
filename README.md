# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/5b8b2dd9-158b-4a75-8931-da6f67e1f936

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5b8b2dd9-158b-4a75-8931-da6f67e1f936) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/5b8b2dd9-158b-4a75-8931-da6f67e1f936) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

## Quick Test (ZingLots MVP)

1) Supabase Edge Secrets to set:
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
- SITE_URL (frontend origin), STRIPE_PLATFORM_FEE_BPS=1200

2) Run migrations (SQL Editor):
- Paste and run docs/migrations/0001_app_schema.sql
- Paste and run docs/migrations/0002_end_lot.sql
- Paste and run docs/migrations/0003_seed_demo.sql

3) Enable:
- Auth: Email (magic link or password)
- Storage buckets: lot-photos (public), evidence (private)
- Realtime: tables app.lots and app.bids

4) Deploy Edge Functions (Dashboard → Edge Functions):
- livekit-token, stripe-onboard, checkout-create-session, stripe-webhook, shipping-create-label, admin-settle

5) Test flow:
- Open /qa in two tabs; set a Lot ID; place sample bids; use “Shorten Soft-Close (20s)” to see realtime extend ping
- End Lot (demo) to generate invoiced order via RPC
- Call checkout-create-session to pay; webhook marks order paid and creates pending payout
- Call shipping-create-label to get label URL + tracking; include $1 platform label margin
- Call admin-settle to transfer payout and mark order settled

