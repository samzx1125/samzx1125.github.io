# Host & test (DESKTOP-97V8214)

**Pinned local command** — PowerShell, absolute path:

```powershell
Set-Location "C:\Users\E-Learning Team REU\Documents\SamYee\notes\self\SaikoroJourney"; Start-Process "http://localhost:8080"; python -m http.server 8080
```

- Opens browser to http://localhost:8080 then serves the folder.
- Stop: `Ctrl+C` in that terminal.
- Do **not** open `index.html` via `file://` (ES modules blocked).

Smoke check: map shows 3 locs; click an adjacent node → train moves along the edge.
