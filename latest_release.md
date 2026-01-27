# Fusion 360 Tool Library Import v2.3.0

## ⚠️ Important Note

**G-Code Translation & Tool Mapping**: The functionality for mapping tools to ATC slots when loading G-code programs has been moved to a separate plugin: **[Dynamic Tool Slot Mapper](https://github.com/cotepat/ncsender-plugin-dynamic-tool-slot-mapper)**

This plugin now focuses exclusively on **importing tool libraries** from Fusion 360. For automatic tool number translation and slot mapping when loading G-code files, please install the separate Dynamic Tool Slot Mapper plugin.

## What's New

This release adds full support for imperial units (inches) in Fusion 360 tool libraries, ensuring accurate conversion to ncSender's internal metric format.

### ✨ New Features

#### Imperial Unit Support
- **Automatic unit detection**: Reads `tool_unit` field from both JSON and clipboard imports
- **Accurate conversion**: Converts inches to millimeters (×25.4) automatically
- **Supports both formats**:
  - JSON exports: Detects `expressions.tool_unit` field
  - Clipboard/TSV: Detects `Unit (tool_unit)` column
- Works seamlessly whether your Fusion 360 document is in metric or imperial

#### Enhanced Precision
- All tool diameters rounded to 0.00001 mm precision
- Eliminates floating-point arithmetic errors
- Ensures consistent values across imports

### 🐛 Bug Fixes

#### Quote Preservation in Descriptions
- Fixed TSV/clipboard import stripping quotes from tool descriptions
- Properly handles CSV escape sequences (`""` → `"`)
- Tool names like `1/8"` now import correctly with quotes intact
- Improved CSV/TSV parser to handle quoted fields correctly

#### Display Improvements
- Increased diameter precision in preview table from 2 to 3 decimal places
- Better visibility of small diameter differences

### 📍 How to Use

**Clipboard Import:**
1. In Fusion 360: Select tools → Copy
2. In ncSender: Plugins → Fusion 360 Tool Importer
3. Click "Paste from Clipboard"
4. Review → Import (unit conversion happens automatically)

**JSON File Import:**
1. In Fusion 360: Export tools as JSON
2. In ncSender: Plugins → Fusion 360 Tool Importer
3. Click "Select Fusion 360 JSON File"
4. Review → Import (unit conversion happens automatically)

### 💡 Technical Details

**Unit Handling:**
- ncSender stores all tool diameters internally in millimeters
- Imperial Fusion 360 exports are automatically converted during import
- ncSender's UI will display in your preferred units (metric/imperial)
- No manual conversion needed

**Example:**
- Fusion 360 (imperial): 0.6mm tool = 0.023622 inches in export
- Plugin detects "inches" unit → converts: 0.023622 × 25.4 = 0.6 mm
- ncSender stores: 0.6 mm
- Display: 0.600 mm (metric mode) or 0.0236 in (imperial mode)

### ⚙️ Requirements

- **ncSender**: 0.3.131 or higher
- **Fusion 360**: Any recent version

---

**Full Changelog**: https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/compare/v2.2.0...v2.3.0
