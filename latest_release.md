# Fusion 360 Tool Library Import v1.0.0

## Initial Release

### Features

* Import tool libraries from Fusion 360 JSON exports
* Automatic tool type mapping (Flat, Ball, V-Bit, Surfacing, Thread Mill)
* Intelligent ATC slot mapping from Fusion 360 `turret` field
* Optional Fusion 360 tool number prefix in descriptions
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

* ncSender v0.3.114 or higher
* Fusion 360 JSON export file

### Installation

1. Download the plugin from the ncSender Plugin Manager
2. Or manually copy to your ncSender plugins directory
3. Restart ncSender
4. Navigate to Tools tab → Import → Fusion 360 (JSON)

### Known Issues

None at this time.

### Documentation

* [Tool Importer Development Guide](https://github.com/cotepat/ncSender/blob/kilroy/docs/TOOL_IMPORTER_DEVELOPMENT.md)
* [Plugin Development Guide](https://github.com/siganberg/ncSender/blob/main/docs/PLUGIN_DEVELOPMENT.md)

