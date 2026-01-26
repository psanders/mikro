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
