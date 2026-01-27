# Mikro Créditos

This is the main repository for the Mikro project. It is a monorepo that contains all the modules for the Mikro project.

Build a linux compatible docker image.

```bash
docker build --platform linux/amd64 --no-cache -t psanders/mikro:latest -f mods/apiserver/Dockerfile .
```

Run with:

```bash
docker run -p 3000:3000 psanders/mikro:latest
```

## Docker Compose Setup

Before running with `docker compose up`, create the data directory with proper ownership:

```bash
mkdir -p data
sudo chown -R 1001:1001 data
```

The container runs as UID 1001 (`nodejs` user), so mounted volumes need matching ownership to allow writes (e.g., SQLite database).

TODO:

- Create a guardrail to prevent more payments than the loan amount
- Create a guardrail to enforce payment amount for the loan frequency
- Add a feature to allow partial payments for some loans
