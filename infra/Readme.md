# AlphaForge — Backup & Provisioning

Server backup and fresh-server provisioning scripts, scoped exclusively to
AlphaForge. These live in AlphaForge's own repo and do not reference or
depend on any other application that may share the same physical server.

## `backup.sh`

Run on the production server (needs `sudo`). Captures:
- `apexdb` (Postgres) — custom + plain SQL format
- Redis snapshot (used for session caching / rate limiting)
- AlphaForge's Nginx site config (`api.alphaforge.skillsifter.in`)
- Its SSL certificate
- `backend/.env`, current git commit, live Docker image reference
- Shared server-level facts (UFW rules, cron, installed packages) — captured
  here for convenience so this backup alone is enough to rebuild a working
  server, even though these facts aren't AlphaForge-specific

```bash
sudo bash backup.sh
```

Output: `/home/harisha/backups/alphaforge_backup_<timestamp>.tar.gz`

**⚠️ Contains live secrets.** Download off the server; don't leave copies
lying around longer than needed.

## `provision.sh`

Sets up a **brand-new** server and restores AlphaForge from a `backup.sh`
archive: installs Docker, Nginx, PostgreSQL, Redis, Certbot, UFW, Node.js;
restores `apexdb`; rebuilds and starts the Docker container.

```bash
sudo bash provision.sh /path/to/alphaforge_backup_<timestamp>.tar.gz
```

**Deliberately manual, not automated:**
- DNS cutover and propagation wait
- SSL certificate re-issuance
- Setting *new* DB/Redis passwords (the script forces this — never reuses
  old, potentially-exposed credentials)

The script prints the exact remaining steps at the end of its run.

## Status

- Both scripts are syntax-checked but have not yet been run against a real
  production restore. Treat the first real run of each as the actual test —
  verify against a disposable VM/droplet before trusting `provision.sh` for
  a real migration.