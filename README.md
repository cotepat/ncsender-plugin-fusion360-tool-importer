# Fusion 360 Tool Library Importer

> **IMPORTANT DISCLAIMER:** This plugin is part of the ncSender project. If you choose to use it, you do so entirely at your own risk. I am not responsible for any damage, malfunction, or personal injury that may result from the use or misuse of this plugin. Use it with caution and at your own discretion.

Import tool libraries from Autodesk Fusion 360 CAM directly into ncSender.

## Installation

Install this plugin in ncSender through the Plugins interface.

## Features

### Import Fusion 360 Tool Libraries

* Import tools directly from Fusion 360 JSON exports
* **Duplicate Prevention**: Re-importing the same library updates existing tools instead of creating duplicates
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

| Fusion 360 Type | ncSender Type |
|----------------|---------------|
| Flat End Mill  | flat          |
| Ball End Mill  | ball          |
| Chamfer Mill   | v-bit         |
| Face Mill      | surfacing     |
| Thread Mill    | thread-mill   |

### Configuration Options

* **Include Fusion Tool Number**: Optionally prefix tool descriptions with Fusion 360's tool number (format: "123 - Tool Name")

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

### First Import

1. In Fusion 360, export your tool library as JSON
2. Open ncSender and navigate to the **Tools** tab
3. Click the **Import** button and select **Fusion 360 (JSON)**
4. Choose your exported JSON file
5. Review the imported tools and measure TLO values on your machine

### Re-Importing (Update Workflow)

If you modify tools in Fusion 360 and want to sync changes to ncSender:

1. Export the updated tool library from Fusion 360 as JSON
2. In ncSender, import the same file
3. ncSender will detect existing tools by ID and prompt: **"Replace existing tools and import?"**
4. Click **Yes** to update the tools, or **No** to keep existing tools

This allows you to maintain your tool library in Fusion 360 and sync changes to ncSender!

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
* [Tool Importer Development Guide](https://github.com/siganberg/ncSender/blob/main/docs/TOOL_IMPORTER_DEVELOPMENT.md)
* [Plugin Development Guide](https://github.com/siganberg/ncSender/blob/main/docs/PLUGIN_DEVELOPMENT.md)

## License

See main ncSender repository for license information.

## Changelog

See [latest_release.md](latest_release.md) for the most recent changes.

## Support

If you encounter issues:
1. Check the ncSender console for error messages
2. Verify your Fusion 360 JSON export is valid
3. Review the [Tool Importer Development Guide](https://github.com/siganberg/ncSender/blob/main/docs/TOOL_IMPORTER_DEVELOPMENT.md)
4. Report bugs or request features on the [main ncSender repository](https://github.com/siganberg/ncSender/issues)

