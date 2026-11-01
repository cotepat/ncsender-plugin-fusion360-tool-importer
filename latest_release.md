# Fusion 360 Tool Library Import v3.1.0

## What's New

### 🔩 Flutes, lengths and taper angles are imported
Each tool's **number of flutes**, **flute length**, **overall length** and **taper angle** (45° for a 90° V-bit) now come over from Fusion 360, from a JSON file or a paste.
- ncSender's Tool Library doesn't show them yet, but it keeps them with the tool. Plugins can use them: for example, to work out feeds and speeds from the flute count, or a V-bit's angle for a chamfer, instead of guessing from the tool's name.
- Lengths are saved in mm, whatever units the Fusion 360 library uses.
- Re-importing updates them, and the preview lists them as changes (**Flutes**, **Flute Length**, **Overall Length**, **Taper Angle**, **Corner Radius**).
- A tool that Fusion 360 gives no value for keeps what ncSender already has. Other stored data (offsets, image, life, stickout and the rest) is kept, as before.

### 🛠️ Bits filed under the right type
- **Roundover bits** (Fusion's *radius mill*) used to come in as 0.2 mm flat end mills, because Fusion's diameter for them is only the tip. They now come in as wide as they cut (tip + 2 × radius), with the radius kept.
- **Form mills** whose profile is a straight V from the tip (a V-groove bit drawn as a form mill) now come in as V-bits, with their angle.
- **Tapered mills** without a point (bowl, cove, tapered ball nose) now come in as ball end mills instead of V-bits. Their taper angle is kept.
- Each tool's **corner radius** comes along too.

To add them to the tools you already have, import your library once more and click **Import All**: the preview shows those tools as MODIFIED, and **Import New** skips them.

## ⚙️ Requirements

- **ncSender**: 2.0.173 or higher
- **Fusion 360**: Any recent version

---

**Full Changelog**: https://github.com/cotepat/ncsender-plugin-fusion360-tool-importer/compare/v3.0.4...v3.1.0
