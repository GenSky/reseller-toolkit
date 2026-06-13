# Reseller Toolkit

A single, free, private web app that merges two reseller tools behind one
**brutalist** interface:

1. **Profit Calculator** — net profit, margin, and ROI after marketplace +
   payment fees, shipping, and cost of goods, with eBay/Mercari/Poshmark presets
   and a break-even price solver.
2. **Inventory Tracker** — aging buckets (fresh / watch / **dead stock**),
   capital tied up, potential revenue, realized profit, and sell-through rate.

They're genuinely integrated: calculate a deal and hit **Add to inventory** to
push it straight in (fees and all), then **Mark sold** computes true realized
profit using the fee math you saved. No backend, no account, no tracking.

> Merges [`reseller-profit-calc`](https://github.com/GenSky/reseller-profit-calc)
> and [`reseller-inventory`](https://github.com/GenSky/reseller-inventory) from
> the [AI Opportunity Hunter](https://github.com/GenSky/ai-opportunity-hunter)
> pipeline into one app.

## Features
- Two tabs, one shared local data store.
- Calculator → inventory hand-off (saves cost, list price, platform, and fees).
- Realized profit on sale uses the saved fee structure, not a naive price − cost.
- Aging, dead-stock flagging, capital/sell-through summary.
- CSV import & export. Mobile-first, light/dark, works offline and on GitHub Pages.

## Run locally
Open `index.html`, or serve it:
```bash
python -m http.server 8080   # then visit http://localhost:8080
```

## Design
Brutalist: thick black borders, hard offset shadows, monospace data, loud
accents (electric yellow / hot red / hard blue), no rounded corners.

## Privacy
All data lives in your browser's localStorage. Export to CSV to back it up.
Marketplace fees change — verify current rates. Estimates, not financial advice.

Pure helpers are exposed as `window.RT` for testing.

## License
MIT.
