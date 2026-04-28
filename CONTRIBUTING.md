# Contributing to Fusion 360 Tool Library Importer

Thank you for your interest in contributing to this plugin!

## Development Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer.git
   cd ncsender-plugin-fusion360-tool-importer
   ```

2. Make your changes to `import.html` or other files

3. Test locally:
   ```bash
   chmod +x .scripts/test-package.sh
   .scripts/test-package.sh
   ```

4. Install in ncSender:
   - Copy the generated zip file to your ncSender plugins directory
   - Extract it
   - Restart ncSender
   - Test your changes

## Plugin Development

This plugin targets the ncSender v2 (`pro-v2`) plugin model. There is no standalone plugin guide yet — the source itself is the reference:

- [ncSender repository](https://github.com/siganberg/ncSender)
- Plugin loader & manifest schema: [`src/NcSender.Server/Plugins/PluginManager.cs`](https://github.com/siganberg/ncSender/blob/main/src/NcSender.Server/Plugins/PluginManager.cs)
- Plugin REST API & dialog placeholders (`__INITIAL_CONFIG__`, `__SERVER_PORT__`): [`src/NcSender.Server/Plugins/PluginEndpoints.cs`](https://github.com/siganberg/ncSender/blob/main/src/NcSender.Server/Plugins/PluginEndpoints.cs)
- Manifest model fields: [`src/NcSender.Core/Models/PluginModels.cs`](https://github.com/siganberg/ncSender/blob/main/src/NcSender.Core/Models/PluginModels.cs)
- How `configUi` HTML is rendered (inline, not iframe): [`src/NcSender.Client/src/components/PluginDialog.vue`](https://github.com/siganberg/ncSender/blob/main/src/NcSender.Client/src/components/PluginDialog.vue)

Reference plugin (richer example with both `commands.js` and `configUi`): [ncsender-plugin-rapidchangeatc](https://github.com/siganberg/ncsender-plugin-rapidchangeatc).

## Testing

Before submitting a pull request:

1. Test with various Fusion 360 JSON exports
2. Test with invalid/malformed files
3. Verify error handling works correctly
4. Check console for any errors
5. Test configuration UI changes

## Pull Request Process

1. Update the version in `manifest.json`
2. Update `latest_release.md` with your changes
3. Ensure all tests pass
4. Submit a pull request with a clear description

## Coding Standards

- Use clear, descriptive variable names
- Add comments for complex logic
- Handle errors gracefully with user-friendly messages
- Follow the existing code style
- Validate all user inputs

## Reporting Bugs

Please report bugs on this plugin's issues page.

Include:
- ncSender version
- Plugin version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Console error messages
- Sample Fusion 360 JSON file (if applicable)

## Feature Requests

Feature requests are welcome! Please open an issue describing:
- The feature you'd like to see
- Why it would be useful
- Any implementation ideas

## Code of Conduct

Please be respectful and constructive in all interactions.

