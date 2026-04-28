# Repository Setup Guide

This document explains how to set up this repository on GitHub and configure automated releases.

## Initial Setup

### 1. Create GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository named `ncsender-plugin-fusion360-tool-importer`
3. Make it public or private (your choice)
4. Do NOT initialize with README, .gitignore, or license (we already have these)

### 2. Push to GitHub

```bash
cd /Users/patricecote/GitHub/ncsender-plugin-fusion360-tool-importer

# Add remote origin (replace cotepat with your GitHub username)
git remote add origin https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Configure GitHub Actions

The repository includes two GitHub Actions workflows:

**test.yml** - Runs on every push/PR:
- Validates manifest.json
- Checks JavaScript syntax
- Tests package creation
- Validates package contents

**release.yml** - Runs on version tags:
- Creates plugin package
- Extracts release notes
- Creates GitHub release
- Attaches zip file

No additional configuration needed - workflows will run automatically!

### 4. Create Your First Release

```bash
# Make sure you're on main branch
git checkout main

# Tag the current version (must match version in manifest.json)
git tag -a v1.0.0 -m "Release v1.0.0"

# Push the tag to trigger release workflow
git push origin v1.0.0
```

The GitHub Action will:
1. Run validation tests
2. Create the plugin package zip
3. Create a GitHub release with the zip file attached
4. Use content from `latest_release.md` as release notes

## Repository Structure

```
ncsender-plugin-fusion360-tool-importer/
├── .github/
│   └── workflows/
│       ├── release.yml          # Automated releases on tags
│       └── test.yml             # Validation tests on push/PR
├── .scripts/
│   ├── extract-release-notes.sh # Extract notes from latest_release.md
│   ├── package.sh               # Create distribution zip
│   └── test-package.sh          # Test packaging locally
├── .gitignore                   # Git ignore patterns
├── CONTRIBUTING.md              # Contribution guidelines
├── README.md                    # Main documentation
├── REPOSITORY_SETUP.md          # This file
├── import.html                  # Plugin UI + logic (everything lives here)
├── latest_release.md            # Release notes for next version
├── logo.png                     # Plugin icon shown in ncSender
└── manifest.json                # Plugin metadata (declares configUi + toolMenu)
```

## Making Updates

### For Bug Fixes or Features

1. Create a branch:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. Make your changes to `import.html` or other files

3. Update `manifest.json` version (follow [Semantic Versioning](https://semver.org/)):
   - MAJOR.MINOR.PATCH (e.g., 1.0.0 → 1.0.1 for bug fix)

4. Update `latest_release.md` with your changes

5. Test locally:
   ```bash
   ./.scripts/test-package.sh
   ```

6. Commit and push:
   ```bash
   git add -A
   git commit -m "Description of changes"
   git push origin feature/my-new-feature
   ```

7. Create a Pull Request on GitHub

8. After merging to main, create a release tag:
   ```bash
   git checkout main
   git pull
   git tag -a v1.0.1 -m "Release v1.0.1"
   git push origin v1.0.1
   ```

## Testing Locally

Before creating a release:

```bash
# Test package creation
./.scripts/test-package.sh

# This will create a zip file you can manually install in ncSender
# Copy to: ~/Library/Application Support/ncSender/plugins/ (macOS)
```

## GitHub Settings

### Required Permissions

The release workflow needs the `contents: write` permission, which is configured in `.github/workflows/release.yml`. No additional repository settings needed.

### Optional: Branch Protection

Consider enabling branch protection for `main`:
1. Go to repository Settings → Branches
2. Add rule for `main` branch
3. Enable:
   - Require pull request reviews
   - Require status checks to pass (test workflow)
   - Require branches to be up to date

### Optional: Topics/Tags

Add repository topics for discoverability:
- `ncsender`
- `ncsender-plugin`
- `fusion360`
- `tool-library`
- `cnc`
- `cam`

## Troubleshooting

**Release not creating?**
- Ensure tag format is `v*` (e.g., `v1.0.0`)
- Check Actions tab for workflow errors
- Verify version in manifest.json matches tag

**Package validation failing?**
- Run `./.scripts/test-package.sh` locally
- Check manifest.json syntax
- Verify import.html has the `__INITIAL_CONFIG__` placeholder

**Tests failing?**
- Check GitHub Actions logs
- Validate manifest: `node -p "require('./manifest.json')"`
- Verify configUi placeholder: `grep __INITIAL_CONFIG__ import.html`

## Related Documentation

- [ncSender Main Repository](https://github.com/siganberg/ncSender)
- ncSender v2 plugin source — no standalone docs yet, read [`src/NcSender.Server/Plugins/`](https://github.com/siganberg/ncSender/tree/main/src/NcSender.Server/Plugins) and [`src/NcSender.Core/Models/PluginModels.cs`](https://github.com/siganberg/ncSender/blob/main/src/NcSender.Core/Models/PluginModels.cs)
- Reference plugin: [ncsender-plugin-rapidchangeatc](https://github.com/siganberg/ncsender-plugin-rapidchangeatc)

