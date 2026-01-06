# Fusion 360 Tool Library Import v1.2.0

## Version 1.2.0 - Self-Contained Utility Plugin (Major Architectural Change)

### 🎉 Major Changes

This release completely reimagines the plugin as a **self-contained utility** that requires **NO changes to the ncSender core application**. The plugin now provides its own complete user interface and workflow.

**Breaking Change**: The plugin is no longer a "tool-importer" category plugin. Instead, it's a "utility" plugin that adds a menu item under **Tools → Fusion 360 Tool Importer**.

### ✨ New Features

#### Complete Built-in UI
- **Custom Import Dialog**: Beautiful, intuitive dialog with real-time preview
- **Smart Comparison Table**: See exactly which tools are NEW, MODIFIED, or UNCHANGED
- **Summary Statistics**: Quick overview of tools in file vs. current library
- **Inline Configuration**: Settings are right in the import dialog - no need to visit a separate settings page
- **Visual Status Badges**: Color-coded badges show tool status at a glance
- **Change Detection**: See exactly what changed for each tool (Description, Type, Diameter, etc.)

#### Enhanced Import Options
- **Selective Import**: Choose to import only new tools or all changes
- **Preserve Tool Numbers**: New option to keep existing ATC tool number assignments
- **Delete Library**: Option to clear all tools before importing (use with caution!)
- **Import Preview**: Review all changes before committing

#### Improved Tool Number Formatting
- **Leading Zeros**: Tool numbers now display with leading zeros (001, 010, 100) for proper sorting
- **Sortable Descriptions**: When "Include Fusion 360 tool number" is enabled, descriptions sort correctly

#### Expanded Type Mapping
Added support for many more Fusion 360 tool types:
- Bull Nose End Mill → ball
- Countersink → v-bit
- Dovetail Mill → v-bit
- Tapered Mill → v-bit
- Counterbore → drill
- Reamer → drill
- Spot Drill → drill
- Slot Mill → flat
- Form Mill → flat
- Tap (all types) → thread-mill
- Probe → probe

### 🔧 Technical Changes

#### Plugin Architecture
- **Category**: Changed from `tool-importer` to `utility`
- **API Used**: `registerToolMenu()` instead of `registerToolImporter()`
- **Self-Contained**: All logic is within the plugin - no dependency on core app APIs
- **Standard REST API**: Uses `/api/tools` endpoint for tool management
- **Custom Dialog**: Uses `showDialog()` with complete HTML/CSS/JS interface

#### No Core App Changes Required
- Previous versions required ncSender core to support "tool-importer" plugins
- v1.2.0 works with standard ncSender plugin APIs only
- Easier to maintain and less dependent on core app changes

### 📍 How to Access

**Old Way (v1.1.x)**: Tools tab → Import dropdown → Fusion 360 (JSON)
**New Way (v1.2.0)**: **Tools → Fusion 360 Tool Importer** (menu item)

### 🔄 Upgrade Notes

If you're upgrading from v1.1.x:
1. The import workflow has changed - use the Tools menu instead of the Import dropdown
2. New UI provides much better preview and control over imports
3. Settings are now inline in the import dialog
4. All existing functionality is preserved, just with a better interface

### 🐛 Bug Fixes

- Fixed tool number display to use consistent zero-padding throughout
- Improved error handling and user feedback
- Better detection of duplicate tools
- More robust JSON parsing and validation

### 📚 Documentation Updates

- Updated all documentation to reflect new menu-based workflow
- Removed references to "tool-importer" plugin category
- Added comprehensive UI usage guide
- Updated troubleshooting section with new location

---

## Version 1.1.1 - Sortable Tool Numbers

### Changed

* **Leading Zeros**: Tool numbers now display with leading zeros (001, 010, 100)
* **Sortable Descriptions**: Ensures tool descriptions sort correctly when Fusion tool number is included

---

## Version 1.1.0 - Duplicate Prevention

### Changed

* **ID Mapping**: Fusion 360 tool number now maps directly to ncSender tool ID
* **Duplicate Prevention**: Re-importing the same Fusion 360 library now updates existing tools instead of creating duplicates
* **Conflict Detection**: ncSender will prompt "Replace existing tools?" when importing a library with tools that already exist

### How It Works

* **Fusion tool number** → **ncSender ID** (for duplicate detection)
* **Fusion turret** → **ncSender toolNumber** (ATC slot assignment)

This means:
- First import: Creates tools with IDs matching Fusion tool numbers
- Re-import: Detects existing tools by ID and asks to replace or cancel
- No more duplicate tools when re-importing the same library!

---

## Version 1.0.0 - Initial Release

### Features

* Import tool libraries from Fusion 360 JSON exports
* Automatic tool type mapping (Flat, Ball, V-Bit, Surfacing, Thread Mill)
* Intelligent ATC slot mapping from Fusion 360 `turret` field
* TLO defaults to 0 (must be measured on machine)
* Optional tool number prefix in descriptions
* Robust validation and error handling
* Detailed logging for skipped tools
* Automatic fallback descriptions for empty tool names

### Configuration

* **Include Fusion Tool Number**: Toggle option to prefix tool descriptions with Fusion 360 tool numbers

### Important Notes

* TLO (Tool Length Offset) is always set to 0 during import - measure on your machine
* Tool numbers in ncSender represent ATC slots, not Fusion 360's tool identifiers
* Unassigned tools (turret = 0) are imported without ATC slot assignments
* Invalid tools are skipped with detailed error messages

### Requirements

* ncSender v0.3.0 or higher
* Fusion 360 JSON export file

### Installation

1. Download the plugin from the ncSender Plugin Manager
2. Or manually copy to your ncSender plugins directory
3. Restart ncSender
4. Navigate to Tools menu → Fusion 360 Tool Importer

---

## Documentation

* [Plugin Development Guide](https://github.com/siganberg/ncSender/blob/main/docs/PLUGIN_DEVELOPMENT.md)
* [Plugin Architecture](https://github.com/siganberg/ncSender/blob/main/docs/PLUGIN_ARCHITECTURE.md)
