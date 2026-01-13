# Fusion 360 Tool Library Import v2.1.0

## What's New

This release introduces a completely redesigned G-code translation interface with **visual slot carousel** and **interactive tool mapping**, matching ncSender's native tool library UI. Plus, **clipboard import** for lightning-fast tool updates!

### ✨ Major Features

#### Visual Slot Management
- 🟢 **Green slots**: Tool is in slot AND used in your G-code
- ⚙️ **Grey slots**: Tool is in slot but NOT used in G-code  
- **Empty (—)**: No tool assigned to slot
- **Click any tool** to assign/reassign slots with dropdown
- **Smart swapping**: Automatically handles conflicts when slots are occupied

#### Clipboard Import
- Copy tools directly from Fusion 360 tool library (no file export needed!)
- Paste in ncSender and see instant preview
- Perfect for quick tool updates

#### Improved Tool Mapping
- Click-to-map: Click tool row → select slot → done!
- Unknown tools can be mapped temporarily (session-only, won't persist)
- Library tools persist automatically when mapped
- Handles all swap scenarios automatically

### 🐛 Bug Fixes

- Fixed swap functionality to properly exchange tools between slots
- Fixed unknown tool mapping to "Not in magazine"
- Fixed session mappings not clearing when unassigned
- Fixed Tool ID display showing correct Fusion 360 tool number
- Fixed status badge colors to match indicators
- Fixed carousel not updating when unknown tools are mapped
- Fixed JSON import to match clipboard import behavior

### 📍 How to Use

**Visual Slot Management:**
1. Load G-code → See slot carousel at top
2. Click any tool row to assign/change slot
3. Select from dropdown (shows swaps if needed)
4. Click "Map Tools" to translate

**Clipboard Import:**
1. In Fusion 360: Select tools → Copy
2. In ncSender: Plugins → Fusion 360 Tool Importer
3. Click "Paste from Clipboard"
4. Review → Import

### ⚙️ Requirements

- **ncSender**: 0.3.131 or higher
- **Fusion 360**: Any recent version

---

**Full Changelog**: https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/compare/v2.0.5...v2.1.0
