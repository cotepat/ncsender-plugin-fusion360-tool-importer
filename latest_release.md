# Fusion 360 Tool Library Import v3.1.0

## What's New

### 🔩 Flutes and lengths are imported
Each tool's **number of flutes**, **flute length** and **overall length** now come over from Fusion 360, from a JSON file or a paste.
- ncSender's Tool Library doesn't show them yet, but it keeps them with the tool. Plugins can use them: for example, to work out feeds and speeds from the flute count instead of guessing from the tool's name.
- Lengths are saved in mm, whatever units the Fusion 360 library uses.
- Re-importing updates them, and the preview lists them as changes (**Flutes**, **Flute Length**, **Overall Length**).
- A tool that Fusion 360 gives no value for keeps what ncSender already has. Other stored data (offsets, image, life, stickout and the rest) is kept, as before.

To add them to the tools you already have, import your library once more and click **Import All**: the preview shows those tools as MODIFIED, and **Import New** skips them.

## ⚙️ Requirements

- **ncSender**: 2.0.173 or higher
- **Fusion 360**: Any recent version

---

**Full Changelog**: https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/compare/v3.0.4...v3.1.0
