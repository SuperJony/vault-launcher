# Platform And Launch Constraints

- Target platform is desktop only.
- Launch behavior is macOS-focused using CLI tools or `open -a`.
- Do not use `spawnSync`.
- Do not use `shell: true`.
- Always pass paths as separate process arguments to preserve spaces and special characters.
