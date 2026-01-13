# Quick Start Guide

## For Users: Installing the Plugin

### Option 1: From ncSender Plugin Manager (Coming Soon)
Once published, you'll be able to install directly from ncSender's Plugin Manager.

### Option 2: Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/releases)
2. Locate your ncSender plugins directory:
   - **macOS**: `~/Library/Application Support/ncSender/plugins/`
   - **Windows**: `%APPDATA%\ncSender\plugins\`
   - **Linux**: `~/.config/ncSender/plugins/`
3. Extract the downloaded ZIP file into the plugins directory
4. Restart ncSender
5. Access via **Plugins → Fusion 360 Tool Importer** menu

## For Developers: Setting Up for Development

### 1. Clone the Repository

```bash
cd ~/GitHub
git clone https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer.git
cd ncsender-plugin-fusion360-tool-importer
```

### 2. Test Locally

```bash
# Create a test package
./.scripts/test-package.sh

# Install the generated zip in ncSender
# Extract to: ~/Library/Application Support/ncSender/plugins/ (macOS)
```

### 3. Make Changes

1. Edit `index.js` to modify plugin behavior
2. Update `manifest.json` version if needed
3. Test your changes by reinstalling in ncSender
4. Update `latest_release.md` with your changes

### 4. Publish Changes

```bash
# Commit your changes
git add -A
git commit -m "Description of changes"
git push

# Create a release tag (triggers automated release)
git tag -a v2.0.1 -m "Release v2.0.1"
git push origin v2.0.1
```

The GitHub Action will automatically:
- Validate the code
- Create the plugin package
- Create a GitHub release with the zip file

## Using the Plugin

### Importing Tools from Fusion 360

#### Method 1: Clipboard Import (Quick & Easy)

1. Open Fusion 360 → **Manufacture** workspace → **Tool Library**
2. Select tools to import (click to select, Shift+click for range, Cmd/Ctrl+A for all)
3. Right-click → **Copy** (or Cmd/Ctrl+C)
4. Open ncSender → **Plugins → Fusion 360 Tool Importer**
5. Click **Paste from Clipboard**
6. Review the comparison table
7. Choose **Import New** or **Import All**

**Benefits**: Fast, no need to export files, perfect for small updates

#### Method 2: JSON File Import (Full Library)

1. Open Fusion 360 → **Manufacture** workspace → **Tool Library**
2. Select tools to export (or select all)
3. Right-click → **Export** → Save as **JSON** format
4. Open ncSender → **Plugins → Fusion 360 Tool Importer**
5. Click **Select Fusion 360 JSON File**
6. Choose your exported JSON file
7. Configure import options:
   - ☑️ **Include Fusion 360 tool number in description**: Adds padded numbers like "001 - End Mill"
   - ☑️ **Do not overwrite ncSender Slot number**: Preserves existing ATC slot assignments
8. Review the preview:
   - **Summary stats**: Shows total, new, and modified tools
   - **Comparison table**: Lists all tools with their status and changes
9. Choose import action:
   - **Import New**: Only adds tools that don't exist yet
   - **Import All**: Imports new tools and updates modified ones

**Benefits**: Best for initial setup, large updates, or archiving tool libraries

**Smart Detection (v1.2.0+)**:
- The plugin compares your file against existing tools by ID
- Tools are marked as:
  - **NEW**: Doesn't exist in ncSender yet
  - **MODIFIED**: Exists but has changes
  - **UNCHANGED**: Exists with no changes
- Choose to import only new tools or all changes

### Important: Tool Length Offset (TLO)

⚠️ **TLO values are NOT imported from Fusion 360**

All imported tools will have TLO = 0. You MUST measure tool length offsets on your machine using:
- Automatic probing (if your machine supports it)
- Manual touch-off
- Tool setter/height gauge

Fusion 360's `assemblyGaugeLength` is for CAM simulation only and does not represent your machine's actual tool offsets.

### Tool ID and Number Mapping

**Duplicate Prevention (v1.1.0+)**:
- **Fusion 360 `number`** field → **ncSender `toolId`** (for duplicate detection)
- **Fusion 360 `turret`** field → **ncSender `toolNumber`** (ATC slot)

**What This Means**:
- First import: Tool #42 in Fusion → toolId 42 in ncSender
- Re-import same library: Plugin detects tool toolId 42 exists and shows as MODIFIED or UNCHANGED
- **No duplicate tools** when re-importing!

**Update Workflow**:
1. Modify tools in Fusion 360
2. Re-export as JSON
3. Open **Plugins → Fusion 360 Tool Importer**
4. Select file and review changes
5. Import new/modified tools

**Preserve Slot Number Option (v2.0+)**:
- When enabled, existing ATC slot assignments are preserved
- Useful if you've manually assigned slots in ncSender
- Fusion 360's `turret` field is ignored for existing tools
- If a tool has `turret = 0` in Fusion 360, it will be imported without a slot assignment

### Using the G-code Translator

When you load a Fusion 360 G-code file, the plugin automatically:

1. **Analyzes Tools**: Scans for all tool changes (T## M6 commands)
2. **Shows Visual Slot Carousel**: Displays all ATC slots with color coding:
   - **Green**: Tool is in this slot AND used in the G-code
   - **Grey**: Tool is in this slot but NOT used in the G-code
   - **Empty (—)**: No tool assigned to this slot
3. **Displays Tool Table**: Lists all tools with their current status
4. **Interactive Mapping**: Click any tool row to reassign its slot

#### Assigning Tool Slots

**To assign a tool to a slot:**
1. Click the tool's row in the table
2. Select target slot from dropdown
3. If slot is occupied, you'll see "Swap with #XX" - select it to swap
4. Dialog refreshes automatically to show new assignments

**Unknown Tools** (not in your library):
- Can be mapped to slots temporarily (for this G-code only)
- Session mappings don't persist after closing
- Shows with red "Unknown" status badge

**Smart Slot Swapping:**
- Automatically handles conflicts when two tools want the same slot
- 3-step swap process prevents conflicts
- Works for library tools, unknown tools, or combinations

## Support

- **Documentation**: See [README.md](README.md) for full documentation
- **Issues**: Report bugs on [GitHub Issues](https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/issues)
- **ncSender Docs**: [Plugin Development Guide](https://github.com/siganberg/ncSender/blob/main/docs/PLUGIN_DEVELOPMENT.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

