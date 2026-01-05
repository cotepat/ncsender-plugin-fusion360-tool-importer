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
5. Navigate to Tools tab → Import → Select "Fusion 360 (JSON)"

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
2. Go to **Tools** tab
3. Click **Import** dropdown
4. Select **Fusion 360 (JSON)**
5. Choose your exported JSON file
6. Review imported tools

### Configuration

Go to **Plugins** → **Fusion 360 Tool Library Import** → **Settings**:

- **Include Fusion tool number**: When enabled, tool descriptions will be prefixed with Fusion 360's tool number (e.g., "42 - 1/4\" End Mill")

### Important: Tool Length Offset (TLO)

⚠️ **TLO values are NOT imported from Fusion 360**

All imported tools will have TLO = 0. You MUST measure tool length offsets on your machine using:
- Automatic probing (if your machine supports it)
- Manual touch-off
- Tool setter/height gauge

Fusion 360's `assemblyGaugeLength` is for CAM simulation only and does not represent your machine's actual tool offsets.

### Tool Number Mapping

- **Fusion 360 `turret`** field → **ncSender `toolNumber`** (ATC slot)
- **Fusion 360 `number`** field → Optional prefix in tool description (not ATC slot)

If a tool has `turret = 0` in Fusion 360, it will be imported without an ATC slot assignment.

## Troubleshooting

**Import fails with "Invalid format" error:**
- Ensure you exported as JSON format (not XML or other formats)
- Verify the file is a valid Fusion 360 tool library export

**Some tools are skipped:**
- Check ncSender console for detailed error messages
- Tools missing required fields (diameter, type) are automatically skipped
- Review the skipped tools log for specific reasons

**Tool names are different than expected:**
- Check plugin settings for "Include Fusion tool number" option
- Verify Fusion 360 tool descriptions are not empty

**Wrong tool numbers:**
- Remember: ncSender's tool number is the ATC slot (from Fusion's `turret` field)
- Fusion's tool number (used for CAM identification) is optionally in the description

## Support

- **Documentation**: See [README.md](README.md) for full documentation
- **Issues**: Report bugs on [GitHub Issues](https://github.com/YOUR_USERNAME/ncsender-plugin-fusion360-tool-importer/issues)
- **ncSender Docs**: [Tool Importer Development Guide](https://github.com/siganberg/ncSender/blob/main/docs/TOOL_IMPORTER_DEVELOPMENT.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

