# Mikro Agents

This module is part of the Mikro. By itself, it does not do much. It is intended to be used as a dependency for other modules. For more information about the project, please visit https://github.com/psanders/mikro.

## Example members report

To generate a sample Excel report with rating, missed payments count, and trend columns (for manual inspection) from the root of the project:

```bash
npm run report:example -w @mikro/agents
```

This writes `reporte-ejemplo-YYYY-MM-DD.xlsx` in the current working directory. You can also run from the repo root:
