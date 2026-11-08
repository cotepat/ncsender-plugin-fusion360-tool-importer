// Zero-dep regression tests for bug fixes 1–5.
// Loads the first <script> block of import.html in a Node vm sandbox so the
// pure functions can be exercised without a DOM or test framework.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'import.html'), 'utf8');

// First <script>...</script> block holds the testable pure functions.
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) {
  console.error('FAIL: could not locate first <script> block in import.html');
  process.exit(1);
}

const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(match[1], sandbox, { filename: 'import.html#script[0]' });

const lib = sandbox.window.__fusionImportInternals;
if (!lib) {
  console.error('FAIL: __fusionImportInternals not exposed on window');
  process.exit(1);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------- Bug 1: XSS via tool description ----------
test('escapeHtml neutralises <script>, attribute injection, and quotes', () => {
  assert.strictEqual(
    lib.escapeHtml('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;'
  );
  assert.strictEqual(
    lib.escapeHtml('" onerror="alert(1)'),
    '&quot; onerror=&quot;alert(1)'
  );
  assert.strictEqual(lib.escapeHtml("it's & that"), 'it&#39;s &amp; that');
  // Numeric / null / undefined inputs (toolId, toolNumber) are coerced safely.
  assert.strictEqual(lib.escapeHtml(42), '42');
  assert.strictEqual(lib.escapeHtml(null), '');
  assert.strictEqual(lib.escapeHtml(undefined), '');
});

// ---------- Bug 2: false-positive metadata/slot diffs ----------
test('computeComparison does not flag legacy tools without metadata as modified', () => {
  // Existing tool predates the importer: no metadata field at all.
  const existing = [{
    toolId: 5,
    name: 'End Mill',
    type: 'flat',
    diameter: 6.35,
    toolNumber: 3
    // no metadata
  }];
  // Fresh import of an identical tool: metadata is always at least an empty shape.
  const fresh = [{
    toolId: 5,
    toolNumber: 3,
    name: 'End Mill',
    type: 'flat',
    diameter: 6.35,
    metadata: { notes: '', sku: '', image: '' }
  }];

  const result = lib.computeComparison(existing, fresh, { preserveToolNumber: true });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].status, 'unchanged',
    `expected 'unchanged', got '${result[0].status}' with changes=${JSON.stringify(result[0].changes)}`);
  assert.deepStrictEqual([...result[0].changes], []);
});

test('computeComparison still flags real changes (description, diameter, slot)', () => {
  const existing = [{
    toolId: 7,
    name: 'Old Name',
    type: 'flat',
    diameter: 6.0,
    toolNumber: 2,
    metadata: { notes: '', sku: '' }
  }];
  const fresh = [{
    toolId: 7,
    toolNumber: 9, // different slot
    name: 'New Name', // different description
    type: 'flat',
    diameter: 6.5, // diameter changed by > 0.001
    metadata: { notes: '', sku: '' }
  }];

  const result = lib.computeComparison(existing, fresh, { preserveToolNumber: false });
  assert.strictEqual(result[0].status, 'modified');
  assert.deepStrictEqual(
    [...result[0].changes].sort(),
    ['Description', 'Diameter', 'Slot'].sort()
  );
});

// ---------- Bug 4: applyPreservedSlots copies existing slot in preserve mode ----------
test('applyPreservedSlots copies existing slot when preserving', () => {
  const existing = [
    { toolId: 1, toolNumber: 5 },
    { toolId: 2, toolNumber: null }
  ];
  const fresh = [
    { toolId: 1, toolNumber: null }, // would render "No Slot" without the fix
    { toolId: 2, toolNumber: null },
    { toolId: 3, toolNumber: null } // not in library
  ];

  const result = lib.applyPreservedSlots(fresh, existing, { preserveToolNumber: true });
  assert.strictEqual(result[0].toolNumber, 5, 'tool 1 should inherit slot 5');
  assert.strictEqual(result[1].toolNumber, null, 'tool 2: existing slot is null, leave as-is');
  assert.strictEqual(result[2].toolNumber, null, 'tool 3: not in library, leave as-is');
});

test('applyPreservedSlots is a no-op when not preserving', () => {
  const existing = [{ toolId: 1, toolNumber: 5 }];
  const fresh = [{ toolId: 1, toolNumber: 9 }];
  const result = lib.applyPreservedSlots(fresh, existing, { preserveToolNumber: false });
  assert.strictEqual(result[0].toolNumber, 9);
});

// ---------- Bug 5: description prefix with leading whitespace ----------
test('convertFusionTool does not double-prefix when description has leading whitespace', () => {
  const fusionTool = {
    'post-process': { number: 5 },
    geometry: { DC: 6.35 },
    description: '  005 - Already Prefixed', // leading spaces would have bypassed startsWith
    type: 'flat end mill'
  };

  const tool = lib.convertFusionTool(fusionTool, {
    includeFusionToolNumber: true,
    preserveToolNumber: true
  });
  assert.strictEqual(tool.name, '005 - Already Prefixed',
    `expected single prefix, got "${tool.name}"`);
});

test('convertTSVTool does not double-prefix when description has leading whitespace', () => {
  const headers = [
    'Tool Index (tool_index)',
    'Number (tool_number)',
    'Diameter (tool_diameter)',
    'Unit (tool_unit)',
    'Description (tool_description)',
    'Type (tool_type)'
  ];
  const columnMap = {};
  headers.forEach((h, i) => { columnMap[h] = i; });
  const values = ['1', '5', '6.35', 'millimeters', '  005 - Already Prefixed', 'flat end mill'];

  const tool = lib.convertTSVTool(values, columnMap, {
    includeFusionToolNumber: true,
    preserveToolNumber: true
  });
  assert.strictEqual(tool.name, '005 - Already Prefixed',
    `expected single prefix, got "${tool.name}"`);
});

// ---------- Re-importing must not lose what ncSender stores on the tool ----------
const storedTool = () => ({
  id: 26,
  toolId: 26,
  toolNumber: 6,
  name: 'Old name',
  type: 'flat',
  diameter: 25.4,
  offsets: { tlo: -41.25, x: 12, y: -3, z: 1.5 },
  metadata: { notes: 'old note', image: 'facemill.png', sku: 'old-sku' },
  dimensions: { flute_length: 10 },
  specs: { flutes: 4 },
  life: { hours: 12 }
});
const importedTool = () => ({
  toolId: 26,
  toolNumber: 6,
  name: 'New name',
  type: 'surfacing',
  diameter: 25,
  offsets: { tlo: 0, x: 0, y: 0, z: 0 },
  metadata: { notes: 'new note', image: '', sku: 'new-sku' }
});

test('mergeTool takes Fusion fields and keeps everything ncSender stores', () => {
  const merged = lib.mergeTool(storedTool(), importedTool());
  assert.strictEqual(merged.id, 26);
  assert.strictEqual(merged.name, 'New name');
  assert.strictEqual(merged.type, 'surfacing');
  assert.strictEqual(merged.diameter, 25);
  assert.strictEqual(merged.metadata.notes, 'new note');
  assert.strictEqual(merged.metadata.sku, 'new-sku');
  assert.strictEqual(merged.metadata.image, 'facemill.png');
  assert.deepStrictEqual({ ...merged.offsets }, { tlo: -41.25, x: 12, y: -3, z: 1.5 });
  assert.deepStrictEqual({ ...merged.dimensions }, { flute_length: 10 });
  assert.deepStrictEqual({ ...merged.specs }, { flutes: 4 });
  assert.deepStrictEqual({ ...merged.life }, { hours: 12 });
});

test('mergeTool handles a stored tool with no metadata', () => {
  const stored = storedTool();
  delete stored.metadata;
  const merged = lib.mergeTool(stored, importedTool());
  assert.strictEqual(merged.metadata.notes, 'new note');
});

// ---------- Flutes and lengths ----------
test('convertFusionTool reads the flutes and lengths, in mm', () => {
  const tool = lib.convertFusionTool({
    'post-process': { number: 3 },
    geometry: { DC: 0.25, NOF: 2, LCF: 1, OAL: 2.5 },
    unit: 'inches',
    description: '1/4 upcut',
    type: 'flat end mill'
  }, { includeFusionToolNumber: false, preserveToolNumber: true });
  assert.strictEqual(tool.metadata.flutes, 2);
  assert.deepStrictEqual({ ...tool.dimensions }, { flute_length: 25.4, overall_length: 63.5 });
});

test('convertFusionTool reads a V-bit\'s taper angle', () => {
  const tool = lib.convertFusionTool({
    'post-process': { number: 9 },
    geometry: { DC: 0.25, NOF: 4, TA: 30.00000000000001 },
    unit: 'inches',
    type: 'chamfer mill'
  }, { includeFusionToolNumber: false, preserveToolNumber: true });
  assert.strictEqual(tool.type, 'v-bit');
  assert.strictEqual(tool.dimensions.taper_angle, 30);
});

// ---------- Fusion types with no single ncSender match ----------
const fusionTool = (type, geometry, unit = 'inches', server) => lib.convertFusionTool(
  { 'post-process': { number: 1 }, type, unit, geometry, description: type },
  { includeFusionToolNumber: false, preserveToolNumber: true }, server);

test('a roundover (radius mill) is as wide as it cuts, not its tip', () => {
  const tool = fusionTool('radius mill', { DC: 0.007874015748031, RE: 0.25, NOF: 2 });
  assert.strictEqual(tool.type, 'flat');
  assert.ok(Math.abs(tool.diameter - 12.9) < 0.001, String(tool.diameter));
  assert.strictEqual(tool.dimensions.radius, 6.35);
});

test('a form mill with a straight V profile is a V-bit with its angle', () => {
  const profile = [{ end: [0, 0] }, { end: [0.125, 0.21650635094611] }, { end: [0.125, 2] }, { end: [0, 2] }];
  const tool = fusionTool('form mill', { DC: 0.25, NOF: 3, profile });
  assert.strictEqual(tool.type, 'v-bit');
  assert.strictEqual(tool.dimensions.taper_angle, 30);
  // A profile that starts with an arc, or doesn't reach the full width, stays flat.
  const arc = fusionTool('form mill', { DC: 0.25, profile: [{ end: [0, 0] }, { end: [0.125, 0.2], center: [0, 0.2] }] });
  const short = fusionTool('form mill', { DC: 0.25, profile: [{ end: [0, 0] }, { end: [0.05, 0.2] }, { end: [0.125, 0.3] }] });
  assert.strictEqual(arc.type, 'flat');
  assert.strictEqual(short.type, 'flat');
  assert.strictEqual(fusionTool('form mill', { DC: 0.25 }).type, 'flat');
});

test('a tapered mill is a V-bit only when it tapers to a point', () => {
  const cove = fusionTool('tapered mill', { DC: 0.75, RE: 0.375, TA: 0 });
  const bowl = fusionTool('tapered mill', { DC: 0.75, RE: 0.25, TA: 0 });
  const taperedBall = fusionTool('tapered mill', { DC: 0.0625, RE: 0.03125, TA: 5.38 });
  const straight = fusionTool('tapered mill', { DC: 0.25, TA: 0 });
  const pointed = fusionTool('tapered mill', { DC: 0.25, TA: 15 });
  // An ncSender without the tapered-ball type gets a ball, which it can save.
  assert.deepStrictEqual([cove.type, bowl.type, taperedBall.type, straight.type, pointed.type], ['ball', 'ball', 'ball', 'flat', 'v-bit']);
  assert.strictEqual(taperedBall.dimensions.taper_angle, 5.38);
  assert.strictEqual(cove.dimensions.radius, 9.525);
});

test('a tapered mill with a round tip and a taper is a Tapered Ball Nose when the server knows it', () => {
  const server = { taperedBall: true, shankDiameter: true };
  // SpeTool W01015 as Fusion exports it: 1/32" R, 5.38 deg per side, 1" flutes, 1/4" shank.
  const w01015 = fusionTool('tapered mill', { DC: 0.0625, RE: 0.03125, TA: 5.380000000000003, LCF: 1, OAL: 2.5, NOF: 2, SFDM: 0.25 }, 'inches', server);
  assert.strictEqual(w01015.type, 'tapered-ball');
  assert.strictEqual(w01015.diameter, 1.5875); // the tip, 2 x the tip radius
  assert.deepStrictEqual({ ...w01015.dimensions }, {
    flute_length: 25.4, overall_length: 63.5, taper_angle: 5.38, radius: 0.79375, shank_diameter: 6.35
  });
  // No taper (cove, bowl) stays a ball; no radius stays a V-bit or flat.
  const cove = fusionTool('tapered mill', { DC: 0.75, RE: 0.375, TA: 0 }, 'inches', server);
  const pointed = fusionTool('tapered mill', { DC: 0.25, TA: 15 }, 'inches', server);
  const ballEnd = fusionTool('ball end mill', { DC: 0.25, RE: 0.125, TA: 3 }, 'inches', server);
  assert.deepStrictEqual([cove.type, pointed.type, ballEnd.type], ['ball', 'v-bit', 'ball']);
});

test('the paste path reads a Tapered Ball Nose and its Shaft Diameter', () => {
  const header = 'Tool Index (tool_index)\tNumber (tool_number)\tDiameter (tool_diameter)\tUnit (tool_unit)\tType (tool_type)\t' +
    'Corner Radius (tool_cornerRadius)\tTaper Angle (tool_taperAngle)\tShaft Diameter (tool_shaftDiameter)';
  const rows = [header, '1\t5\t0.0625\tinches\ttapered mill\t0.03125\t5.38\t0.25'].join('\n');
  const [known] = lib.parseTSVData(rows, { preserveToolNumber: true }, { taperedBall: true });
  const [old] = lib.parseTSVData(rows, { preserveToolNumber: true });
  assert.strictEqual(known.type, 'tapered-ball');
  assert.strictEqual(old.type, 'ball');
  assert.strictEqual(known.dimensions.shank_diameter, 6.35);
  assert.strictEqual(known.dimensions.taper_angle, 5.38);
});

test('a shank diameter Fusion does not give is left out', () => {
  const tool = fusionTool('flat end mill', { DC: 6, SFDM: 0 }, 'millimeters');
  assert.strictEqual(tool.dimensions, undefined);
  assert.strictEqual(fusionTool('flat end mill', { DC: 6, SFDM: 6 }, 'millimeters').dimensions.shank_diameter, 6);
});

test('a shank change is only reported when the server keeps shank_diameter', () => {
  const existing = { toolId: 1, name: 'a', type: 'flat', diameter: 6, metadata: {}, dimensions: {} };
  const incoming = { toolId: 1, name: 'a', type: 'flat', diameter: 6, metadata: {}, dimensions: { shank_diameter: 6 } };
  const old = lib.computeComparison([existing], [incoming], { preserveToolNumber: true });
  const known = lib.computeComparison([existing], [incoming], { preserveToolNumber: true }, [], { shankDiameter: true });
  assert.strictEqual(old[0].status, 'unchanged');
  assert.deepStrictEqual([...known[0].changes], ['Shank Diameter']);
});

// A fake ncSender: validates the type, then looks for the id, as ToolService.UpdateAsync does.
function fakeServer(types, { routes = true, fail = false } = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, method: init.method, type: JSON.parse(init.body).type });
    if (fail) throw new Error('offline');
    if (!routes) return { status: 404 };
    return { status: types.includes(JSON.parse(init.body).type) ? 404 : 400 };
  };
  return { fetchFn, calls };
}

test('probeToolTypes finds tapered-ball on a server that accepts it, saving nothing', async () => {
  const { fetchFn, calls } = fakeServer(['flat', 'ball', 'tapered-ball']);
  const found = await lib.probeToolTypes(fetchFn, [{ id: 1 }]);
  assert.deepStrictEqual({ ...found }, { taperedBall: true, shankDiameter: true });
  assert.ok(calls.every(c => c.method === 'PUT' && c.url === '/api/tools/2147483647'), JSON.stringify(calls));
});

test('probeToolTypes keeps ball on an older server, a missing route or no connection', async () => {
  const older = await lib.probeToolTypes(fakeServer(['flat', 'ball']).fetchFn, []);
  const noRoute = await lib.probeToolTypes(fakeServer([], { routes: false }).fetchFn, []);
  const offline = await lib.probeToolTypes(fakeServer([], { fail: true }).fetchFn, []);
  assert.deepStrictEqual([older.taperedBall, noRoute.taperedBall, offline.taperedBall], [false, false, false]);
  // A library that already holds a shank diameter keeps it, whatever the type list.
  const withShank = await lib.probeToolTypes(fakeServer(['flat']).fetchFn, [{ id: 1, dimensions: { shank_diameter: 6 } }]);
  assert.deepStrictEqual({ ...withShank }, { taperedBall: false, shankDiameter: true });
});

test('probeToolTypes never sends a tool to an id the library uses', async () => {
  const { fetchFn, calls } = fakeServer(['tapered-ball']);
  const found = await lib.probeToolTypes(fetchFn, [{ id: 2147483647 }]);
  assert.strictEqual(found.taperedBall, false);
  assert.strictEqual(calls.length, 0);
});

test('a tapered mill with no taper given stays a V-bit; a dovetail keeps no taper angle', () => {
  assert.strictEqual(fusionTool('tapered mill', { DC: 0.25 }).type, 'v-bit');
  const header = 'Tool Index (tool_index)\tNumber (tool_number)\tDiameter (tool_diameter)\tUnit (tool_unit)\tType (tool_type)';
  const [pasted] = lib.parseTSVData([header, '1\t9\t6\tmillimeters\ttapered mill'].join('\n'), { preserveToolNumber: true });
  assert.strictEqual(pasted.type, 'v-bit');
  assert.strictEqual(fusionTool('dovetail mill', { DC: 0.5, TA: 14 }).dimensions, undefined);
});

test('odd form mill profiles stay flat instead of failing the import', () => {
  const v = (segment) => fusionTool('form mill', { DC: 6, profile: [{ end: [0, 0] }, segment] }, 'millimeters').type;
  assert.strictEqual(v({ end: [3, 5], ccw: true }), 'flat');
  assert.strictEqual(v({ end: [3, 0.001] }), 'flat');
  assert.strictEqual(v({ end: [3, 5] }), 'v-bit');
  assert.strictEqual(fusionTool('form mill', { DC: 6, profile: [null, { end: [3, 1] }] }, 'millimeters').type, 'flat');
  assert.strictEqual(fusionTool('form mill', { DC: 6, profile: [{ end: [0, 0] }, null] }, 'millimeters').type, 'flat');
});

test('a re-import that changes a tool\'s type keeps its slot and its other dimensions', () => {
  const stored = { ...storedTool(), type: 'v-bit', toolNumber: 4, dimensions: { stickout: 30, flute_length: null } };
  const incoming = { ...importedTool(), type: 'ball', toolNumber: null, dimensions: { radius: 9.525 } };
  const [row] = lib.computeComparison([stored], [incoming], { preserveToolNumber: true });
  assert.ok(row.changes.includes('Type') && row.changes.includes('Corner Radius'));
  const preserved = lib.applyPreservedSlots([incoming], [stored], { preserveToolNumber: true });
  const { library } = lib.planImport([stored], preserved, { magazineSize: 8, probeSlot: null });
  assert.strictEqual(library[0].type, 'ball');
  assert.strictEqual(library[0].toolNumber, 4);
  assert.deepStrictEqual({ ...library[0].dimensions }, { stickout: 30, flute_length: null, radius: 9.525 });
});

test('a pasted roundover in inches, and one with a blank Corner Radius', () => {
  const header = 'Tool Index (tool_index)\tNumber (tool_number)\tDiameter (tool_diameter)\tUnit (tool_unit)\tType (tool_type)\tCorner Radius (tool_cornerRadius)';
  const [inch, blank] = lib.parseTSVData([header, '1\t30\t0.007874\tinches\tradius mill\t0.25', '2\t31\t0.2\tmillimeters\tradius mill\t'].join('\n'), { preserveToolNumber: true });
  assert.ok(Math.abs(inch.diameter - 12.9) < 0.001, String(inch.diameter));
  assert.strictEqual(inch.dimensions.radius, 6.35);
  assert.strictEqual(blank.diameter, 0.2);
});

test('the paste path widens a roundover by its Corner Radius too', () => {
  const header = 'Tool Index (tool_index)\tNumber (tool_number)\tDiameter (tool_diameter)\tUnit (tool_unit)\tType (tool_type)\tCorner Radius (tool_cornerRadius)';
  const [tool] = lib.parseTSVData([header, '1\t30\t0.2\tmillimeters\tradius mill\t6.35'].join('\n'), { preserveToolNumber: true });
  assert.strictEqual(tool.type, 'flat');
  assert.strictEqual(tool.diameter, 12.9);
  assert.strictEqual(tool.dimensions.radius, 6.35);
});

test('convertFusionTool leaves out flutes and lengths Fusion does not give', () => {
  const tool = lib.convertFusionTool({
    'post-process': { number: 3 },
    geometry: { DC: 6, NOF: 0, TA: 0 },
    unit: 'millimeters',
    type: 'flat end mill'
  }, { includeFusionToolNumber: false, preserveToolNumber: true });
  assert.strictEqual(tool.metadata.flutes, undefined);
  assert.strictEqual(tool.dimensions, undefined);
});

test('convertTSVTool reads the flutes and lengths', () => {
  const header = 'Tool Index (tool_index)\tNumber (tool_number)\tDiameter (tool_diameter)\tUnit (tool_unit)\t' +
    'Number of Flutes (tool_numberOfFlutes)\tFlute Length (tool_fluteLength)\tOverall Length (tool_overallLength)';
  const [tool] = lib.parseTSVData([header, '1\t4\t6\tmillimeters\t1\t22\t50'].join('\n'), { preserveToolNumber: true });
  assert.strictEqual(tool.metadata.flutes, 1);
  assert.deepStrictEqual({ ...tool.dimensions }, { flute_length: 22, overall_length: 50 });
});

test('convertTSVTool converts inch lengths and drops blank, bad or negative values', () => {
  const header = 'Tool Index (tool_index)\tNumber (tool_number)\tDiameter (tool_diameter)\tUnit (tool_unit)\t' +
    'Number of Flutes (tool_numberOfFlutes)\tFlute Length (tool_fluteLength)\tOverall Length (tool_overallLength)';
  const [inch, bad] = lib.parseTSVData([header, '1\t4\t0.25\tinches\t2\t1\t2.5', '2\t5\t6\tmillimeters\t\tabc\t-1'].join('\n'), { preserveToolNumber: true });
  assert.strictEqual(inch.metadata.flutes, 2);
  assert.deepStrictEqual({ ...inch.dimensions }, { flute_length: 25.4, overall_length: 63.5 });
  assert.strictEqual(bad.metadata.flutes, undefined);
  assert.strictEqual(bad.dimensions, undefined);
});

test('mergeTool takes the flutes and lengths and keeps the other dimensions', () => {
  const stored = { ...storedTool(), dimensions: { flute_length: 10, stickout: 30 } };
  const merged = lib.mergeTool(stored, {
    ...importedTool(),
    metadata: { notes: '', image: '', sku: '', flutes: 3 },
    dimensions: { flute_length: 22, overall_length: 50 }
  });
  assert.strictEqual(merged.metadata.flutes, 3);
  assert.strictEqual(merged.metadata.image, 'facemill.png');
  assert.deepStrictEqual({ ...merged.dimensions }, { flute_length: 22, stickout: 30, overall_length: 50 });
});

test('computeComparison flags new flutes and lengths, not missing ones', () => {
  const existing = [{ toolId: 4, name: 'Bit', type: 'flat', diameter: 6, metadata: { flutes: 2 }, dimensions: { flute_length: 22 } }];
  const changed = [{ toolId: 4, name: 'Bit', type: 'flat', diameter: 6, metadata: { flutes: 3 }, dimensions: { flute_length: 22, overall_length: 50 } }];
  const without = [{ toolId: 4, name: 'Bit', type: 'flat', diameter: 6, metadata: {} }];
  const result = lib.computeComparison(existing, changed, { preserveToolNumber: true });
  assert.deepStrictEqual([...result[0].changes], ['Flutes', 'Overall Length']);
  assert.strictEqual(lib.computeComparison(existing, without, { preserveToolNumber: true })[0].status, 'unchanged');
});

test('planImport saves the flutes and lengths over ncSender\'s stored dimensions', () => {
  // ncSender's GET /api/tools sends every dimension, the unset ones as null.
  const stored = { ...storedTool(), metadata: { notes: '', image: '', sku: '' },
    dimensions: { flute_length: null, overall_length: null, taper_angle: null, radius: null, stickout: 5 } };
  const incoming = { ...importedTool(), metadata: { notes: '', image: '', sku: '', flutes: 2 }, dimensions: { flute_length: 22 } };
  assert.deepStrictEqual([...lib.computeComparison([stored], [incoming], { preserveToolNumber: true })[0].changes],
    ['Description', 'Type', 'Diameter', 'Flutes', 'Flute Length']);
  const { library } = lib.planImport([stored], [incoming], { magazineSize: 8, probeSlot: null });
  assert.strictEqual(library[0].metadata.flutes, 2);
  assert.deepStrictEqual({ ...library[0].dimensions },
    { flute_length: 22, overall_length: null, taper_angle: null, radius: null, stickout: 5 });
});

test('planImport keeps tools that are not imported and adds new ones', () => {
  const other = { id: 3, toolId: 3, toolNumber: null, name: 'Other', type: 'flat', diameter: 6 };
  const added = { ...importedTool(), toolId: 200, toolNumber: null };
  const { library, problems } = lib.planImport([other, storedTool()], [importedTool(), added], { magazineSize: 8, probeSlot: null });
  assert.deepStrictEqual([...library.map(t => t.toolId)], [3, 26, 200]);
  assert.strictEqual(library[0], other);
  assert.strictEqual(library[1].offsets.tlo, -41.25);
  assert.strictEqual(problems.length, 0);
});

// ---------- Duplicate Fusion numbers ----------
test('splitDuplicates keeps the first tool and reports the rest', () => {
  const tools = [
    { toolId: 5, name: 'First' },
    { toolId: 6, name: 'Other' },
    { toolId: 5, name: 'Second' }
  ];
  const { unique, duplicates } = lib.splitDuplicates(tools);
  assert.deepStrictEqual([...unique.map(t => t.name)], ['First', 'Other']);
  assert.strictEqual(duplicates.length, 1);
  assert.strictEqual(duplicates[0].tool.name, 'Second');
  assert.strictEqual(duplicates[0].keptName, 'First');
});

test('computeComparison shows a duplicate right after the tool that was kept', () => {
  const unique = [
    { toolId: 5, name: 'First', metadata: {} },
    { toolId: 6, name: 'Other', metadata: {} }
  ];
  const duplicates = [{ tool: { toolId: 5, name: 'Second', metadata: {} }, keptName: 'First' }];
  const result = lib.computeComparison([], unique, { preserveToolNumber: true }, duplicates);
  assert.deepStrictEqual([...result.map(r => r.status)], ['new', 'duplicate', 'new']);
  assert.ok(result[1].changes[0].includes('First'));
});

test('parseTSVData returns every row so duplicates can be reported', () => {
  const header = 'Tool Index (tool_index)\tNumber (tool_number)\tDiameter (tool_diameter)\tDescription (tool_description)';
  const tsv = [header, '1\t5\t6\tFirst', '2\t5\t8\tSecond'].join('\n');
  const tools = lib.parseTSVData(tsv, { preserveToolNumber: true });
  assert.strictEqual(tools.length, 2);
});

// ---------- Slots ----------
const magazine8 = { magazineSize: 8, probeSlot: null };
const slotted = (toolId, toolNumber) => ({ toolId, toolNumber, name: `T${toolId}`, type: 'flat', diameter: 6, metadata: {} });

test('applyPreservedSlots keeps the slot when the Fusion turret is blank and preserve is off', () => {
  const result = lib.applyPreservedSlots([slotted(84, null)], [slotted(84, 3)], { preserveToolNumber: false });
  assert.strictEqual(result[0].toolNumber, 3);
});

test('applyPreservedSlots follows a slot that changed in the library since parsing', () => {
  const result = lib.applyPreservedSlots([slotted(84, 3)], [slotted(84, undefined)], { preserveToolNumber: true });
  assert.strictEqual(result[0].toolNumber, null);
});

test('planImport flags a slot past the magazine', () => {
  const { problems } = lib.planImport([], [slotted(201, 20)], magazine8);
  assert.strictEqual(problems.length, 1);
  assert.strictEqual(problems[0].toolId, 201);
  assert.ok(problems[0].message.includes('past the 8-slot magazine'));
});

test('planImport allows the probe slot past the magazine', () => {
  const { problems } = lib.planImport([], [slotted(201, 99)], { magazineSize: 8, probeSlot: 99 });
  assert.strictEqual(problems.length, 0);
});

test('planImport skips the range check when the magazine size is unknown', () => {
  const { problems } = lib.planImport([], [slotted(201, 20)], { magazineSize: 0, probeSlot: null });
  assert.strictEqual(problems.length, 0);
});

test('planImport flags both tools when Fusion gives two of them one turret', () => {
  const { problems, evictions } = lib.planImport([], [slotted(200, 3), slotted(201, 3)], magazine8);
  assert.deepStrictEqual([...problems.map(p => p.toolId)].sort(), [200, 201]);
  assert.ok(problems[0].message.includes('Fusion gives turret 3'));
  assert.strictEqual(evictions.length, 0);
});

test('planImport allows a swap made in one import', () => {
  const { problems } = lib.planImport([slotted(84, 3), slotted(88, 2)], [slotted(84, 2), slotted(88, 3)], magazine8);
  assert.strictEqual(problems.length, 0);
});

test('planImport does not judge slots the import leaves alone', () => {
  const existing = [slotted(1, 20), slotted(2, 5), slotted(3, 5)];
  const { problems } = lib.planImport(existing, [slotted(1, 20), slotted(2, 5)], magazine8);
  assert.strictEqual(problems.length, 0);
});

// ---------- Turret numbers taking over occupied slots ----------
test('take over: the holder loses only its slot', () => {
  const holder = { ...storedTool(), toolId: 51, id: 51, toolNumber: 3 };
  const { library, problems, evictions } = lib.planImport([holder], [slotted(21, 3)], magazine8);
  assert.strictEqual(problems.length, 0);
  assert.deepStrictEqual([...evictions.map(e => ({ ...e }))], [{ toolId: 51, slot: 3, byToolId: 21 }]);
  const saved = library.find(t => t.toolId === 51);
  assert.strictEqual(saved.toolNumber, null);
  assert.strictEqual(saved.offsets.tlo, -41.25);
  assert.strictEqual(saved.name, 'Old name');
  assert.strictEqual(library.find(t => t.toolId === 21).toolNumber, 3);
  assert.strictEqual(holder.toolNumber, 3, 'the library read is not mutated');
});

test('take over: a holder Fusion leaves without a turret still loses the slot', () => {
  const settings = { preserveToolNumber: false };
  const existing = [slotted(51, 3)];
  const file = lib.applyPreservedSlots([slotted(51, null), slotted(21, 3)], existing, settings);
  const { problems, evictions } = lib.planImport(existing, file, magazine8, file);
  assert.strictEqual(problems.length, 0);
  assert.strictEqual(evictions[0].toolId, 51);
});

test('take over: stops when Fusion gives a holder the same turret', () => {
  // Tool 51 is unchanged, so it is in the file but not among the tools imported.
  const file = [slotted(51, 3), slotted(21, 3)];
  const { problems, evictions } = lib.planImport([slotted(51, 3)], [slotted(21, 3)], magazine8, file);
  assert.strictEqual(evictions.length, 0);
  assert.strictEqual(problems.length, 1);
  assert.ok(problems[0].message.includes('Tool ID 51'));
});

test('take over: a slot past the magazine is still a problem', () => {
  const { problems } = lib.planImport([], [slotted(201, 20)], magazine8);
  assert.strictEqual(problems.length, 1);
});

test('take over: a holder moving elsewhere in the same import is not evicted', () => {
  const existing = [slotted(51, 3), slotted(21, 2)];
  const { library, evictions } = lib.planImport(existing, [slotted(21, 3), slotted(51, 2)], magazine8);
  assert.strictEqual(evictions.length, 0);
  assert.strictEqual(library.find(t => t.toolId === 51).toolNumber, 2);
});

test('take over: a three-way rotation evicts nobody', () => {
  const existing = [slotted(1, 1), slotted(2, 2), slotted(3, 3)];
  const { library, problems, evictions } = lib.planImport(existing, [slotted(1, 2), slotted(2, 3), slotted(3, 1)], magazine8);
  assert.strictEqual(problems.length + evictions.length, 0);
  assert.deepStrictEqual([...library.map(t => t.toolNumber)], [2, 3, 1]);
});

test('take over: a move can evict a third tool and leave its old slot free', () => {
  const existing = [slotted(1, 1), slotted(2, 2)];
  const { library, evictions } = lib.planImport(existing, [slotted(1, 2)], magazine8);
  assert.deepStrictEqual([...evictions.map(e => e.toolId)], [2]);
  assert.deepStrictEqual([...library.map(t => t.toolNumber)], [2, null]);
});

test('take over: every tool already sharing the slot loses it, listed once', () => {
  const existing = [slotted(1, 3), slotted(2, 3)];
  const { library, evictions } = lib.planImport(existing, [slotted(9, 3)], magazine8);
  assert.deepStrictEqual([...evictions.map(e => e.toolId)], [1, 2]);
  assert.strictEqual(library.filter(t => t.toolNumber === 3).length, 1);
});

test('take over: a holder is listed once when two tools want its slot', () => {
  const { problems, evictions } = lib.planImport([slotted(1, 3)], [slotted(8, 3), slotted(9, 3)], magazine8);
  assert.strictEqual(evictions.length, 1);
  assert.strictEqual(problems.length, 2);
});

test('take over: importing the result again changes nothing', () => {
  const settings = { preserveToolNumber: false };
  const source = [slotted(51, null), slotted(21, 3)];
  const first = lib.planImport([slotted(51, 3)], lib.applyPreservedSlots(source, [slotted(51, 3)], settings), magazine8);
  const again = lib.applyPreservedSlots(source, first.library, settings);
  const second = lib.planImport(first.library, again, magazine8);
  assert.strictEqual(second.evictions.length + second.problems.length, 0);
  assert.strictEqual(lib.computeComparison(first.library, again, settings).filter(c => c.status !== 'unchanged').length, 0);
});

test('markSlotLosses shows an unchanged tool that loses its slot as modified', () => {
  const rows = [
    { status: 'unchanged', tool: { toolId: 51 }, changes: [] },
    { status: 'modified', tool: { toolId: 21 }, changes: ['Slot'] },
    { status: 'unchanged', tool: { toolId: 22 }, changes: [] }
  ];
  const marked = lib.markSlotLosses(rows, [{ toolId: 51, slot: 3, byToolId: 21 }]);
  assert.strictEqual(marked[0].status, 'modified');
  assert.deepStrictEqual([...marked[0].changes], ['Slot']);
  assert.strictEqual(marked[1], rows[1]);
  assert.strictEqual(marked[2], rows[2]);
});

test('markSlotLosses leaves a duplicate row alone', () => {
  const rows = [{ status: 'duplicate', tool: { toolId: 51 }, changes: ['x'] }];
  assert.strictEqual(lib.markSlotLosses(rows, [{ toolId: 51, slot: 3, byToolId: 21 }])[0], rows[0]);
});

test('planImport does not save the keptSlot marker on a new tool', () => {
  const { library } = lib.planImport([], [{ ...slotted(200, null), keptSlot: true }], magazine8);
  assert.ok(!('keptSlot' in library[0]));
});

test('applyPreservedSlots re-reads a kept slot but leaves a Fusion turret alone', () => {
  const settings = { preserveToolNumber: false };
  const kept = lib.applyPreservedSlots([slotted(84, null)], [slotted(84, 3)], settings);
  assert.strictEqual(kept[0].keptSlot, true);
  const moved = lib.applyPreservedSlots(kept, [slotted(84, 5)], settings);
  assert.strictEqual(moved[0].toolNumber, 5);
  const turret = lib.applyPreservedSlots([slotted(84, 2)], [slotted(84, 5)], settings);
  assert.strictEqual(turret[0].toolNumber, 2);
  assert.ok(!turret[0].keptSlot);
});

test('applyPreservedSlots drops a kept slot once the tool has left the library', () => {
  const kept = lib.applyPreservedSlots([slotted(84, null)], [slotted(84, 3)], { preserveToolNumber: true });
  const gone = lib.applyPreservedSlots(kept, [], { preserveToolNumber: true });
  assert.strictEqual(gone[0].toolNumber, null);
});

test('convertFusionTool reads the turret only when overwriting, and only a positive whole number', () => {
  const turretOf = (turret, preserveToolNumber = false) => lib.convertFusionTool(
    { 'post-process': { number: 5, turret }, geometry: { DC: 6 } }, { preserveToolNumber }
  ).toolNumber;
  assert.strictEqual(turretOf(3), 3);
  assert.strictEqual(turretOf('3'), 3);
  assert.strictEqual(turretOf(3, true), null);
  [0, -1, 2.5, null, undefined, 'abc'].forEach(t => assert.strictEqual(turretOf(t), null, String(t)));
});

// ---------- Numbering ----------
test('readMachine reads numbering, magazine size and probe slot', () => {
  const machine = lib.readMachine({ tool: { numbering: 'toolId', count: 8, probe: true, probeToolNumber: 90 } });
  assert.strictEqual(machine.numbering, 'toolId');
  assert.strictEqual(machine.magazineSize, 8);
  assert.strictEqual(machine.probeSlot, 90);
});

test('readMachine treats missing settings as Slot numbering with no known magazine', () => {
  const machine = lib.readMachine(null);
  assert.strictEqual(machine.numbering, 'slot');
  assert.strictEqual(machine.magazineSize, 0);
  assert.strictEqual(machine.probeSlot, null);
});

test('numberingNotice always says which numbering it found', () => {
  const notice = (tool) => lib.numberingNotice(lib.readMachine({ tool }));
  assert.ok(notice({ numbering: 'slot' }).includes('M6 T5 loads slot 5'));
  assert.ok(notice({ numbering: 'toolId' }).includes('Tool ID numbering'));
});

test('numberingNotice does not pass off unreadable settings as Slot numbering', () => {
  const notice = lib.numberingNotice(lib.readMachine(null));
  assert.ok(notice.includes('Could not read'));
  assert.ok(!notice.includes('M6 T5 loads slot 5'));
});

// ---------- Dialog scripts share the page's global scope ----------
test('the helpers script can run twice in one page (dialog reopened)', () => {
  const page = { window: {} };
  vm.createContext(page);
  vm.runInContext(match[1], page);
  vm.runInContext(match[1], page);
  assert.strictEqual(typeof page.window.__fusionImportInternals.planImport, 'function');
});

test('the helpers script does not clash with names from another plugin', () => {
  const page = { window: {} };
  vm.createContext(page);
  vm.runInContext('const escapeHtml = 1; const TYPE_MAPPING = 2; function planImport() {}', page);
  vm.runInContext(match[1], page);
  vm.runInContext('const parseTSVData = 3; const mergeTool = 4;', page);
  assert.strictEqual(typeof page.window.__fusionImportInternals.escapeHtml, 'function');
});

// ---------- runner ----------
let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log(`  ok  ${t.name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${t.name}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
