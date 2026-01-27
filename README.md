# Fusion 360 Tool Importer for ncSender

A ncSender plugin that imports tool libraries from Fusion 360 JSON exports.

![Plugin Banner](docs/screenshots/banner.png)

## 🎯 Overview

Perfect for CNC users who design in Fusion 360 and run jobs with ncSender.

This plugin allows you to:

1. **Tool Library Import** - Import your complete Fusion 360 tool library (exported to JSON format) with one click

> **Note**: For G-code tool-to-slot mapping when loading programs, see the separate **[ncSender Dynamic Tool Slot Mapper](https://github.com/cotepat/ncsender-plugin-dynamic-tool-slot-mapper)** plugin.

## ✨ Key Features

### Tool Import
- **Smart Import**: See NEW, MODIFIED, and UNCHANGED tools before importing
- **Clipboard Import**: Copy/paste tool data directly from Fusion 360 (TSV format)
- **File Import**: Import complete tool libraries from JSON exports
- **Full Metadata**: Names, types, diameters, offsets, and specifications preserved

![Tool Import Dialog](docs/screenshots/tool-import-dialog.png)
*Tool import comparison*

## 🚀 Installation

1. **Download** the latest release: [`com.ncsender.fusion360-import-v2.3.0.zip`](https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/releases/latest)
2. **Open ncSender** → Navigate to settings (gear icon), then **Plugins** tab
3. **Click** "Install Plugin" button
4. **Select** the downloaded zip file

The plugin will appear in **Plugins → Fusion 360 Tool Importer** menu.

## 📖 Quick Start

### Import Tool Library

**Method 1: Clipboard (Quick)**
1. In Fusion 360: Select tools in Tool Library → Right-click → Copy
2. In ncSender: **Plugins → Fusion 360 Tool Importer**
3. Click **Paste from Clipboard**
4. Review and import

![Copy from Fusion 360](docs/screenshots/fusion-copy-tools.png)
*Copying tools from Fusion 360*

![Paste in ncSender](docs/screenshots/ncsender-paste-clipboard.png)
*Pasting tools in ncSender*

**Method 2: JSON File (Full Library)**
1. Export your Fusion 360 tools as **JSON** (Tool Library → Export)
2. In ncSender: **Plugins → Fusion 360 Tool Importer**
3. Click **Select JSON File**
4. Review the comparison table
5. Choose **Import New** or **Import All**


## ⚙️ Settings

### Tool Import Options
- **Include Fusion 360 tool number in description** - Adds `[XXX]` prefix for reference
- **Do not overwrite ncSender Tool Number** - Preserves existing ATC assignments

## 📊 Technical Details

### Import Formats
- **JSON**: Full tool library export from Fusion 360
- **TSV/Clipboard**: Tab-separated values from Fusion 360 tool list copy

### Compatibility
- **ncSender**: 0.3.131+
- **Fusion 360**: All recent versions (JSON and TSV formats)

---

**Version**: 2.3.0  
**Repository**: [github.com/cotepat/ncsender-plugin-fusion360-tool-importer](https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer)
