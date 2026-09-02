# PrintMatch

A mobile-first peer-to-peer marketplace connecting local 3D printer owners
with customers who need custom parts printed nearby.

Scaffolded with React + Tailwind CSS v4 + React Router. All data is mocked
locally (`src/data/mockData.js`) — there is no backend yet.

## Getting started

```bash
npm install
npm run dev
```

Open the app at a mobile viewport (or resize your browser below 480px) to
see the intended layout — the shell is capped at `max-width: 480px` and
centered.

## Structure

- `src/pages/buyer/` — home feed, request/upload, quotes, checkout, order
  tracking
- `src/pages/owner/` — dashboard, requests, job detail, earnings, printer
  management
- `src/components/` — shared building blocks (`PrinterCard`, `QuoteCard`,
  `StatusBadge`, `ProgressStepper`, `ChatThread`, `MaterialChipSelector`,
  `BottomNav`)
- `src/context/AppContext.jsx` — in-memory role switching (buyer/printer
  owner) and request → quote → order flow state
- `src/data/mockData.js` — mock printers, jobs, quotes, orders, and chat
  messages

Use the role toggle in the top bar (Home feed / Dashboard) to switch
between the Buyer and Printer owner experiences.
