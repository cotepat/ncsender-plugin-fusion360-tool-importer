<div align="center">
  <img src="logo.png" alt="Fusion 360 Tool Library Importer" width="200"/>
  <h1>Fusion 360 Tool Library Importer</h1>
  <p>Import tool libraries from Autodesk Fusion 360 CAM directly into ncSender</p>
</div>

---

> **IMPORTANT DISCLAIMER:** This plugin is part of the ncSender project. If you choose to use it, you do so entirely at your own risk. I am not responsible for any damage, malfunction, or personal injury that may result from the use or misuse of this plugin. Use it with caution and at your own discretion.

## Installation

Install this plugin in ncSender through the Plugins interface. The plugin adds a menu item under **Tools → Fusion 360 Tool Importer**.

## Features

### Import Fusion 360 Tool Libraries

* Import tools directly from Fusion 360 JSON exports with an intuitive dialog interface
* **Duplicate Prevention**: Re-importing the same library updates existing tools instead of creating duplicates
* **Smart Comparison**: Preview new/modified/unchanged tools before importing
* **Selective Import**: Choose to import only new tools or all changes
* Automatic tool type mapping from Fusion 360 to ncSender
* Handles missing or invalid tool data gracefully
* Skip invalid tools with detailed logging

### Intelligent Data Mapping

* **Tool ID**: Fusion 360's tool number becomes ncSender ID (enables duplicate detection)
* **ATC Slots**: Maps Fusion 360's `turret` field to ncSender's `toolNumber`
* **Diameter**: Maps from Fusion 360's `geometry.DC` (cutting diameter)
* **Tool Type**: Automatic mapping between Fusion 360 and ncSender types
* **Tool Description**: Preserves Fusion 360 descriptions with optional tool number prefix
* **TLO**: Defaults to 0 (must be measured on your machine)

### Type Mappings

The plugin automatically maps Fusion 360 tool types to ncSender tool types:

| Fusion 360 Type | ncSender Type |
|----------------|---------------|
| Flat End Mill  | flat          |
| Ball End Mill  | ball          |
| Bull Nose End Mill | ball      |
| Chamfer Mill   | v-bit         |
| Countersink    | v-bit         |
| Dovetail Mill  | v-bit         |
| Tapered Mill   | v-bit         |
| Drill          | drill         |
| Counterbore    | drill         |
| Reamer         | drill         |
| Spot Drill     | drill         |
| Face Mill      | surfacing     |
| Slot Mill      | flat          |
| Form Mill      | flat          |
| Thread Mill    | thread-mill   |
| Tap            | thread-mill   |
| Probe          | probe         |

### Configuration Options

* **Include Fusion 360 tool number**: Optionally prefix tool descriptions with Fusion 360's tool number with leading zeros (format: "001 - Tool Name")
* **Preserve Tool Number**: Keep existing ATC tool number assignments instead of overwriting from Fusion 360 turret field

### Data Validation

* Automatically skips tools with missing or invalid data
* Validates required fields (diameter > 0, valid tool type)
* Generates fallback descriptions for tools with empty names
* Provides detailed error messages for skipped tools

### Important Notes

* **Duplicate Prevention**: Fusion 360's tool number becomes the ncSender tool ID. This means:
  - First import: Creates tools with IDs matching Fusion tool numbers
  - Re-import: Detects existing tools and prompts to replace or cancel
  - No more duplicate tools when re-importing the same library!
  - Update workflow: Modify tools in Fusion, then re-import to sync changes

* **Tool ID vs. ATC Slot**: 
  - **Fusion tool number** → **ncSender ID** (for duplicate detection)
  - **Fusion `turret`** → **ncSender `toolNumber`** (physical ATC slot)
  - Fusion tool number is optionally included in the description prefix

* **Tool Length Offset**: TLO is always set to 0 during import. You must measure tool length offsets on your machine using probing or manual touch-off.

* **Unassigned Tools**: Tools with `turret = 0` in Fusion 360 are imported without an ATC slot assignment (`toolNumber = null`).

## Usage

### Importing Tools

1. In Fusion 360, export your tool library as JSON
2. Open ncSender and select **Tools → Fusion 360 Tool Importer** from the menu
3. Click **Select Fusion 360 JSON File** and choose your exported file
4. Configure import options:
   - **Include Fusion 360 tool number in description**: Prefixes descriptions with padded tool numbers (001, 010, etc.)
   - **Do not overwrite ATC Tool Number**: Preserves existing tool number assignments
5. Review the import preview:
   - **Summary stats**: Total tools, new tools, modified tools
   - **Comparison table**: Shows status, changes, and details for each tool
6. Choose an import option:
   - **Import New**: Only import tools that don't exist yet
   - **Import All**: Import new and update modified tools
   - **Delete Current Library**: Clear all existing tools (use with caution!)
7. Tools are imported and the dialog closes automatically

### Update Workflow

The plugin intelligently detects which tools have changed:

1. **First Import**: All tools are marked as "NEW"
2. **Re-Import**: Tools are compared by ID and marked as:
   - **NEW**: Tool doesn't exist in ncSender yet
   - **MODIFIED**: Tool exists but has changed (description, type, diameter, etc.)
   - **UNCHANGED**: Tool exists and hasn't changed

This allows you to maintain your tool library in Fusion 360 and selectively sync changes to ncSender!

## Exporting from Fusion 360

1. Open Fusion 360
2. Go to the **Manufacture** workspace
3. Open the **Tool Library**
4. Select the tools you want to export (or select all)
5. Right-click and choose **Export**
6. Save as JSON format

## Development

This plugin is part of the ncSender ecosystem: <https://github.com/siganberg/ncSender>

For plugin development documentation, see:
* [Plugin Development Guide](https://github.com/siganberg/ncSender/blob/main/docs/PLUGIN_DEVELOPMENT.md)
* [Plugin Architecture](https://github.com/siganberg/ncSender/blob/main/docs/PLUGIN_ARCHITECTURE.md)

## License

See main ncSender repository for license information.

## Changelog

See [latest_release.md](latest_release.md) for the most recent changes.

## Support

If you encounter issues:
1. Check the ncSender console for error messages
2. Verify your Fusion 360 JSON export is valid
3. Check the import preview for any skipped tools and error messages
4. Report bugs or request features on the [main ncSender repository](https://github.com/siganberg/ncSender/issues)

