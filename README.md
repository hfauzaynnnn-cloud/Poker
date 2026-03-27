# 🃏 Poker — No-Limit Texas Hold'em

A production-grade multiplayer Texas Hold'em platform with AI opponents, equity analysis, and training mode.

## Running Locally

```bash
# Terminal 1 — Server
cd server && npm install && npm run dev

# Terminal 2 — Client
cd client && npm install && npm run dev
```

App runs at **http://localhost:5173**, server at **http://localhost:3001**

---

## 🚀 Deploying to Vercel

The app has two parts: a **React client** (Vercel) and a **Node.js/Socket.io server** (needs Railway/Render).

### Step 1 — Deploy the Server to Railway (free)

> Vercel does not support long-running WebSocket servers. Use Railway instead.

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your repo, set **Root Directory** to `server`
4. Set these environment variables in Railway:
   ```
   PORT=3001
   NODE_ENV=production
   ```
5. Railway will auto-detect it's a Node.js project and deploy
6. Copy your Railway server URL, e.g. `https://poker-server-production.up.railway.app`

### Step 2 — Deploy the Client to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project → Import Git Repository**
3. Select your repo, set **Root Directory** to `client`
4. Add this environment variable:
   ```
   VITE_SERVER_URL=https://your-railway-server-url.up.railway.app
   ```
5. Click **Deploy** — Vercel will build and deploy automatically

### Step 3 — Share your link!

Your app will be live at `https://your-project.vercel.app` 🎉

---

## 🔑 Card Randomization

Cards are shuffled using the **Fisher-Yates algorithm** with `Math.random()` every hand:

```typescript
static create(): Deck {
  const cards = buildDeck();           // 52 ordered cards
  return new Deck(fisherYates(cards, Math.random));  // full random shuffle
}
```

There are `52! ≈ 8 × 10^67` possible deck orderings — every deal is unique.

---

## 📊 Probabilities

| Feature | Method |
|---|---|
| Win equity | Monte Carlo (20,000 simulations) |
| Pot odds | `call / (pot + call)` |
| EV | `win% × pot_won - lose% × call` |
| Outs (flush) | 9 outs detected, Rule of 2/4 applied |
| Outs (OESD) | 8 outs detected |

---

## 🧪 Tests

```bash
cd server && npm test
```

79 tests covering deck, evaluator, side pots, betting, integration, and equity.
