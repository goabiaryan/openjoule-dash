# Data Center Planner

**Preview** — interactive educational planner: stack facility blocks (GPU through site), derive power / cooling / network / space, program brief, Scale campus views, and illustrative Operate signals.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Tabs: **Build** · **Program** · **Scale** · **Operate**. Hash routes: `#build`, `#program`, `#scale`, `#operate` (`#size` → `#scale`, `#path` → `#operate`).

**Scale (high level):**

1. Campus IT capacity → hall count (your Build hall module repeats on site)
2. Site ring road (up to 12 hall footprints on the plan)
3. Isometric hall (one module, layers / rack detail)

```bash
npm run build && npm run preview
```

Figures are illustrative, not engineering sign-off. Check vendor data sheets and local codes before you build.
