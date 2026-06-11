# Resume Enhancer

A single-page web app that uses Claude AI to rewrite a user's resume,
tailored to a specific job title — gated behind a one-time $5 Stripe payment.

## How it works

1. User pastes their resume text and enters the job title they're applying for.
2. Clicking **"Enhance My Resume — $5"** redirects them to a Stripe Checkout page.
3. After successful payment, Stripe redirects back to the app.
4. The backend verifies the payment with Stripe, then sends the resume to
   Claude (`claude-haiku-4-5-20251001`) to generate a tailored rewrite.
5. The original ("Before") and AI-enhanced ("After") resumes are shown side by side.

No user accounts or database are required — submissions are held in memory
on the server until payment is confirmed and the resume is processed, then discarded.

## Tech stack

- **Frontend:** Plain HTML/CSS/JavaScript (in `public/`)
- **Backend:** Node.js + Express (`server.js`)
- **Payments:** Stripe Checkout (one-time $5 payment)
- **AI:** Anthropic Claude API (`claude-haiku-4-5-20251001`)

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file based on `.env.example`:

   ```bash
   cp .env.example .env
   ```

3. Fill in your keys in `.env`:

   ```
   STRIPE_SECRET_KEY=sk_test_...
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

   For local Stripe test payments, use Stripe's test card: `4242 4242 4242 4242`,
   any future expiry date, any CVC, and any postal code.

## Deploying to Railway

1. **Push this project to a GitHub repository.**

2. **Create a new Railway project** and choose "Deploy from GitHub repo",
   selecting this repository.

3. **Set environment variables** in the Railway project settings:
   - `STRIPE_SECRET_KEY` — your Stripe secret key (use a live key `sk_live_...` for production)
   - `ANTHROPIC_API_KEY` — your Anthropic API key
   - `BASE_URL` — *(optional but recommended)* your Railway app's public URL,
     e.g. `https://your-app-name.up.railway.app` (no trailing slash).
     If not set, the app will derive the URL from incoming request headers,
     which usually works fine on Railway.

4. **Deploy.** Railway will automatically detect the Node.js project, run
   `npm install`, and start it with `npm start`. Railway sets the `PORT`
   environment variable automatically — the app reads it via `process.env.PORT`.

5. Once deployed, visit your Railway URL to confirm the app loads. Test the
   full flow with a Stripe test card before switching to live keys.

## Notes

- Switch `STRIPE_SECRET_KEY` to a live key (`sk_live_...`) only when you're
  ready to accept real payments.
- The price is set to **$5.00 USD** in `server.js` (`PRICE_USD_CENTS = 500`).
  Change this constant to adjust the price.
- The model used is `claude-haiku-4-5-20251001` to keep API costs low.
- Submissions are stored in memory and expire after 1 hour if unused — this
  is sufficient for a single-instance deployment but won't persist across
  restarts or multiple instances/scaling.
