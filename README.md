# Multiplayer Casino — starter

A browser-based social casino starter. It includes private rooms, live party/table chat,
a shared virtual-chip balance, and simple demo game screens. **Chips have no cash value:
no deposits, withdrawals, or real-money gambling.**

## Run locally
1. Install Node.js 20 or newer.
2. In this folder run `npm install`
3. Run `npm start`
4. Open http://localhost:3000 in multiple browser windows to test multiplayer.

## Deploy to Render
1. Create a new GitHub repository and upload the contents of this folder.
2. In Render choose **New + → Web Service**, then connect that repository.
3. Render can read `render.yaml`, or use:
   - Build command: `npm install`
   - Start command: `npm start`
4. Deploy, then open the Render URL.

## Included
- Create/join rooms with room codes
- Live room chat and player list
- Server-controlled virtual chips (in-memory demo balance)
- Poker, Blackjack, Baccarat and Slots demo panels
- Render-ready Node + Express + Socket.IO server

## Important next steps before public launch
This is a starter, not a finished casino. Add proper accounts/authentication, persistent
PostgreSQL storage, moderation/rate limits, and fully implemented server-authoritative game
rules before public release. The current demo stores rooms and balances in memory, so they
reset when the server restarts. Never trust chip amounts or game outcomes sent by the browser.

## Playable games (first release)

The room now includes server-managed **Texas Hold'em** and **Blackjack** rounds. Select Poker or Blackjack in the room, then press **Start game**. Poker supports 2–8 players, private hole cards, community cards, fold/call/check/raise actions and a simple showdown hand evaluator. Blackjack deals each room player a hand against the shared AI dealer; hit and stand are supported. Each round uses virtual chips only (100-chip starting bet). Game state is held in memory and resets if the server restarts. This is an early playable implementation: it does not yet include full casino turn timers, side pots, blind rotation, split/double-down, or persistent accounts.
