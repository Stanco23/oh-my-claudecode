# oh-my-claudecode v4.10.1

## Release Notes

Patch release for a packaging mistake in v4.10.0.

### Fixed

- rebuilt and shipped the missing `dist/` HUD layout artifacts so the layout/worktree ordering changes from #2083 are actually present in the published package
- restores released parity between `src/` and `dist/` for the HUD layout path

### Install / Update

```bash
npm install -g oh-my-claude-sisyphus@4.10.1
```

Or reinstall the plugin:

```bash
claude /install-plugin oh-my-claudecode
```

**Full Changelog**: https://github.com/Yeachan-Heo/oh-my-claudecode/compare/v4.10.0...v4.10.1
