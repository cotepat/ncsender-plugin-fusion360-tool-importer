# Fusion 360 Tool Library Import v2.0.0

## Version 2.0.0 - G-Code Translation & Tool Mapping (Major Feature Release)

### 🎉 Major Changes

This release completely reimagines the plugin as a **self-contained utility** that requires **NO changes to the ncSender core application**. The plugin now provides its own complete user interface and workflow.

**Breaking Change**: The plugin is no longer a "tool-importer" category plugin. Instead, it's a "utility" plugin that adds **Plugins → Fusion 360 Tool Importer**.

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

### 📍 How to Access

**Current (v2.0.0)**: **Plugins → Fusion 360 Tool Importer**

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
