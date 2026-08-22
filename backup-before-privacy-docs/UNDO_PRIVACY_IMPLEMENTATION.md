# Undo Round 2 Privacy Implementation

Use this only if you want to return to the pre-privacy-control MVP.

## If You Have Not Committed These Changes

From the project root:

```powershell
git restore README.md backend/main.py backend/test_api.py frontend/src/api.js frontend/src/components.jsx frontend/src/main.jsx frontend/src/pages/AuditTrail.jsx frontend/src/pages/Dashboard.jsx frontend/src/pages/StudentVerify.jsx frontend/src/styles.css
Remove-Item -Force frontend/src/privacy.jsx
```

The previous README was also copied here:

```text
backup-before-privacy-docs/README.before-privacy.md
```

## If You Commit First

Commit before experimenting:

```powershell
git add .
git commit -m "Add context-aware privacy controls"
```

Then undo later with:

```powershell
git revert HEAD
```

