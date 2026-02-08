# Coding Conventions

- Language: TypeScript with ESM (`"type": "module"`).
- Formatting: Biome with 2-space indent, 100-char line width, and double quotes.
- Types: avoid `any`; prefer explicit, narrow types.
- Naming: use kebab-case for multiword filenames (for example `ide-launch.ts`).
- Design preference: keep launch logic side-effect free when practical; prefer pure helpers.
