# LMU Analyzer

A web-based race data analysis tool for [Le Mans Ultimate](https://www.lemansultimate.com/). Load your XML race result files and get detailed analytics and visualizations of your racing performance — all processed locally in your browser, no data leaves your machine.

## Features

- **Overview Dashboard** — Session count, total laps, races, tracks visited, distance driven, all-time best lap with track/car stats tables
- **Personal Bests** — Best lap times grouped by track and car, with sector splits and theoretical best (combined best sectors)
- **Session Analysis** — All sessions with drill-down: lap time progression charts, tire wear analysis (FL/FR/RL/RR), fuel consumption tracking, pitstops, incidents, penalties, track limits
- **Track Stats** — Per-track performance breakdown with best laps by class and sector analysis
- **Car Stats** — Vehicle-specific performance, usage history, and distance tracking
- **Race Results** — Race outcomes with position progress chart, wins/podiums/top-5 stats, grid vs finish positions, DNF tracking
- **Race Pace** — Compare your lap times against community benchmark tiers (Alien → Offline) powered by ohne_speed's pace data
- **Driver Profile** — Customizable profile with session stats, class breakdown, and incident summary
- **Data Export** — Export any table as CSV or XLSX
- **PWA Support** — Install as a standalone app on desktop or mobile

Supports all Le Mans Ultimate car classes: Hypercar, GT3, GTE, and LMP3.

All data stays in your browser — zero server communication. Parsed data is cached in IndexedDB for instant reload.

## 🚀 Fork Enhancements & New Features

This fork introduces powerful competitive analytics and data fidelity improvements tailored for Le Mans Ultimate drivers:

- **Dedicated Safety & Rank Rating (SR & RR) Tracking** — A brand-new dashboard to monitor your SR and RR progression over time, track rating point fluctuations, analyze collision types (vehicle-to-vehicle vs. wall impacts), measure impact severities, and identify circuit danger rankings.
- **Event Jokers Management & Optimization Engine** — A specialized view to manage and simulate your in-game Event Jokers. It intelligently detects your most damaging disaster races (heavy RR loss, early DNFs, high SR penalties) with multi-strategy optimization modes (*Rating First*, *Safety First*, or *Balanced*) to safeguard your ratings.
- **Incomplete Session & Early-Departure Tagging** — Clear visual tagging for truncated or incomplete XML logs when a driver leaves a session before official completion, ensuring data transparency and accurate completion statistics.
- **Standardized Session Timestamps** — Race and session dates are now uniformly anchored to the actual session start time for consistent chronological sorting and timeline alignment.

## Tech Stack

- React 19 + TypeScript 6
- Vite 8
- Tailwind CSS v4
- Recharts (charts)
- Motion (animations)
- xlsx (data export)
- Lucide React (icons)
- PWA with auto-updating service worker

## Getting Started

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:5173` in your browser, then select the folder containing your Le Mans Ultimate XML result files (or upload them manually in Brave/Firefox).

## Building for Production

```bash
pnpm run build
pnpm run preview
```

## How It Works

Le Mans Ultimate exports XML files containing detailed session data — lap times, sector splits, tire wear, fuel levels, incidents, penalties, and more. LMU Analyzer parses these files entirely in your browser and presents the data through an interactive dashboard with charts and sortable tables, letting you track your progress and identify areas for improvement.

The app uses the File System Access API to read your race data folder directly (with a file upload fallback for browsers that don't support it). Parsed data is cached locally so you can pick up where you left off.


