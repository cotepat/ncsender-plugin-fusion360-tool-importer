# Fusion 360 Tool Library Import v3.0.4

## ⚠️ Before You Update

- **ncSender 2.0.173 or newer is now required.** ncSender refuses the update on older versions, so update ncSender first.
- **"Do not overwrite ncSender Slot number" now has a clear meaning.** Checked (the default), an import never changes a slot. Unchecked, Fusion 360 turret numbers replace slots, so a tool can take a slot from another tool. Check this setting before your next import.

## What's New

### 🔧 Turret numbers can replace slots
With "Do not overwrite" unchecked:
- A tool whose turret number points to an occupied slot takes it. The tool that was there ends up with no slot but keeps everything else.
- A tool with no turret number (blank or 0) keeps its slot. To free a slot, use the Tool Library.
- Tools can swap or move slots in one import.
- The import stops if a turret number is past your magazine, or if Fusion 360 gives two tools the same turret number. The table shows why.
- The preview lists every tool that will lose its slot, including tools that aren't in your Fusion 360 file.

### 🐛 Fixes
- **Stored tool data is kept.** Re-importing a tool used to reset its tool length and TLS offsets and drop its image, life, dimensions and specs. Now only what Fusion 360 exports is updated: name, type, diameter, notes and SKU.
- **Your library can't be lost to a failed read.** The importer reads the library again right before saving and stops if it can't, rather than saving over it.
- **Duplicate Fusion 360 tool numbers are shown.** They used to be dropped silently. The first tool is kept and the others are listed as `duplicate`. JSON imports used to keep the last one, so that behavior changes.
- **No more false MODIFIED.** Tools with no notes or SKU in ncSender no longer show as modified when nothing changed.
- Tool names can no longer inject HTML into the dialog, and the tool number prefix is no longer added twice.
- The dialog no longer clashes with other plugins' dialogs or errors when reopened.

### ℹ️ Tool numbering note
The dialog now shows which Tool Numbering mode ncSender is using (Slot or Tool ID), since that decides what `M6 T5` loads.

## ⚙️ Requirements

- **ncSender**: 2.0.173 or higher
- **Fusion 360**: Any recent version

---

**Full Changelog**: https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/compare/v3.0.0...v3.0.4
