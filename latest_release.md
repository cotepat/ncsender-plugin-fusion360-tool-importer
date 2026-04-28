# Fusion 360 Tool Library Import v3.0.0

## ⚠️ Breaking Change: ncSender v2 Required

This release **requires ncSender 2.0.0 or higher**. The plugin has been rewritten to use ncSender v2's new plugin model (`pro-v2` platform). It will **not** load on ncSender v1 (0.3.x) — if you are still on v1, stay on plugin v2.3.1.

## What's New

### 🔌 Rewritten for ncSender v2 Plugin Model
- Migrated from the v1 Node.js plugin runtime to v2's declarative `configUi` model
- Plugin now ships as a single `import.html` file rather than `index.js` + `tool-importer.js`
- Tool menu entry is registered declaratively in `manifest.json` (no `onLoad` wiring)
- Settings persist via the standard `/api/plugins/{id}/settings` endpoint
- All existing functionality (JSON import, clipboard import, comparison table, smart merge, library reset) is preserved unchanged

### 📦 What Did Not Change
- Same Fusion 360 JSON / TSV parsing
- Same imperial → metric conversion
- Same NEW / MODIFIED / UNCHANGED comparison flow
- Same import options ("Include Fusion 360 tool number", "Do not overwrite ncSender Slot number")
- Same tool ID / slot mapping behavior

## ⚙️ Requirements

- **ncSender**: 2.0.0 or higher (`pro-v2` runtime)
- **Fusion 360**: Any recent version

## 📍 How to Use

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

---

**Full Changelog**: https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/compare/v2.3.1...v3.0.0
