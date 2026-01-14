# Fusion 360 Tool Library Import v2.2.0

## ⚠️ Important Note

**G-Code Translation & Tool Mapping**: The functionality for mapping tools to ATC slots when loading G-code programs has been moved to a separate plugin: **[ncSender G-Code Translator](https://github.com/cotepat/ncsender-plugin-gcode-translator)**

This plugin now focuses exclusively on **importing tool libraries** from Fusion 360. For automatic tool number translation and slot mapping when loading G-code files, please install the separate G-Code Translator plugin.

## What's New

This release improves the user experience with native-styled confirmation dialogs that match the application's look and feel.

### ✨ Improvements

#### Native Confirmation Dialog
- Replaced browser `confirm()` dialog with native-styled modal
- Matches application's design system and CSS variables
- Proper modal overlay with backdrop
- Supports Escape key and click-outside to cancel
- Better visual integration with the plugin interface

### 🐛 Bug Fixes

- Fixed confirmation dialog appearing as stacked inline elements
- Fixed dialog positioning within plugin dialog container
- Improved modal behavior and cleanup

### 📍 How to Use

**Clipboard Import:**
1. In Fusion 360: Select tools → Copy
2. In ncSender: Plugins → Fusion 360 Tool Importer
3. Click "Paste from Clipboard"
4. Review → Import

**JSON File Import:**
1. In Fusion 360: Export tools as JSON
2. In ncSender: Plugins → Fusion 360 Tool Importer
3. Click "Select Fusion 360 JSON File"
4. Review → Import

### ⚙️ Requirements

- **ncSender**: 0.3.131 or higher
- **Fusion 360**: Any recent version

---

**Full Changelog**: https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/compare/v2.0.5...v2.2.0
