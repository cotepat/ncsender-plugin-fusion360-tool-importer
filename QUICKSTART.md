# Quick Start Guide

## For Users: Installing the Plugin

### Option 1: From ncSender Plugin Manager (Coming Soon)
Once published, you'll be able to install directly from ncSender's Plugin Manager.

### Option 2: Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/YOUR_USERNAME/ncsender-plugin-fusion360-tool-importer/releases)
2. Locate your ncSender plugins directory:
   - **macOS**: `~/Library/Application Support/ncSender/plugins/`
   - **Windows**: `%APPDATA%\ncSender\plugins\`
   - **Linux**: `~/.config/ncSender/plugins/`
3. Extract the downloaded ZIP file into the plugins directory
4. Restart ncSender
5. Access via **Tools → Fusion 360 Tool Importer** menu

## For Developers: Setting Up for Development

### 1. Clone the Repository

```bash
cd ~/GitHub
git clone https://github.com/YOUR_USERNAME/ncsender-plugin-fusion360-tool-importer.git
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
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

The GitHub Action will automatically:
- Validate the code
- Create the plugin package
- Create a GitHub release with the zip file

## Using the Plugin

### Exporting from Fusion 360

1. Open Fusion 360
2. Go to **Manufacture** workspace
3. Open **Tool Library** manager
4. Select tools to export (or select all)
5. Right-click → **Export**
6. Save as **JSON** format

### Importing into ncSender

1. Open ncSender
2. Select **Tools → Fusion 360 Tool Importer** from the menu
3. Click **Select Fusion 360 JSON File**
4. Choose your exported JSON file
5. Configure import options:
   - ☑️ **Include Fusion 360 tool number in description**: Adds padded numbers like "001 - End Mill"
   - ☑️ **Do not overwrite ATC Tool Number**: Preserves existing tool numbers
6. Review the preview:
   - **Summary stats**: Shows total, new, and modified tools
   - **Comparison table**: Lists all tools with their status and changes
7. Choose import action:
   - **Import New**: Only adds tools that don't exist yet
   - **Import All**: Imports new tools and updates modified ones
8. Tools are imported automatically

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
- **Fusion 360 `number`** field → **ncSender `id`** (for duplicate detection)
- **Fusion 360 `turret`** field → **ncSender `toolNumber`** (ATC slot)

**What This Means**:
- First import: Tool #42 in Fusion → ID 42 in ncSender
- Re-import same library: Plugin detects tool ID 42 exists and shows as MODIFIED or UNCHANGED
- **No duplicate tools** when re-importing!

**Update Workflow**:
1. Modify tools in Fusion 360
2. Re-export as JSON
3. Open **Tools → Fusion 360 Tool Importer**
4. Select file and review changes
5. Import new/modified tools

**Preserve Tool Number Option (v1.2.0+)**:
- When enabled, existing ATC tool numbers are preserved
- Useful if you've manually assigned tool numbers in ncSender
- Fusion 360's `turret` field is ignored for existing tools

If a tool has `turret = 0` in Fusion 360, it will be imported without an ATC slot assignment (`toolNumber = null`).

## Troubleshooting

**Import fails with "Invalid format" error:**
- Ensure you exported as JSON format (not XML or other formats)
- Verify the file is a valid Fusion 360 tool library export

**Some tools are skipped:**
- Check ncSender console for detailed error messages
- Tools missing required fields (diameter, type) are automatically skipped
- Review the skipped tools log for specific reasons

**Tool names are different than expected:**
- Toggle the "Include Fusion 360 tool number" checkbox in the import dialog
- Verify Fusion 360 tool descriptions are not empty
- Tool numbers will be padded with leading zeros (001, 010, 100)

**Wrong tool numbers:**
- Remember: ncSender's tool number is the ATC slot (from Fusion's `turret` field)
- Fusion's tool number becomes the ncSender ID (for duplicate detection, not shown in UI)
- Fusion's tool number is optionally prefixed in the description with leading zeros
- Use "Preserve Tool Number" option to keep existing ATC assignments

**Duplicate tools after re-import:**
- This shouldn't happen in v1.1.0+
- Ensure you're using the latest version of the plugin
- The import preview should show tools as MODIFIED or UNCHANGED, not NEW

**Can't find the importer:**
- Plugin appears in **Tools** menu, not in the Tools tab import dropdown
- Look for **Tools → Fusion 360 Tool Importer** in the menu bar

## Support

- **Documentation**: See [README.md](README.md) for full documentation
- **Issues**: Report bugs on [GitHub Issues](https://github.com/YOUR_USERNAME/ncsender-plugin-fusion360-tool-importer/issues)
- **ncSender Docs**: [Plugin Development Guide](https://github.com/siganberg/ncSender/blob/main/docs/PLUGIN_DEVELOPMENT.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

