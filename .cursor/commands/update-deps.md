# Update Dependencies

Upgrade all dependencies in this monorepo to their latest versions.

## Instructions

1. **Discover all package.json files** in the monorepo (root and all workspaces under `mods/`)

2. **For each package.json**, identify outdated dependencies by running:

   ```bash
   npm outdated --json
   ```

3. **Research breaking changes** for major version upgrades:
   - Check if the upgrade involves a major version bump
   - For major upgrades, briefly note any breaking changes that may require code updates

4. **Create a summary table** showing:
   - Package name
   - Current version
   - Target version
   - Whether it's a major/minor/patch upgrade

5. **Update all package.json files** with the new versions:
   - Update `dependencies`
   - Update `devDependencies`
   - Keep `@types/*` packages aligned with their runtime counterparts

6. **Run npm install** from the root to update `package-lock.json`

7. **Verify the build** by running:

   ```bash
   npm run build
   ```

8. **Fix any breaking changes** if TypeScript compilation fails

## Notes

- This is a Lerna monorepo with workspaces in `mods/*`
- All packages use ESM (`"type": "module"`)
- TypeScript is used across all packages
- Do not downgrade packages (if current version is newer than "latest", keep current)
