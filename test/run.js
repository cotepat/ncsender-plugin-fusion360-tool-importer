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

test('planImport flags a slot another library tool holds', () => {
  const { problems } = lib.planImport([slotted(84, 3)], [slotted(200, 3)], magazine8);
  assert.strictEqual(problems.length, 1);
  assert.strictEqual(problems[0].toolId, 200);
  assert.ok(problems[0].message.includes('T84'));
});

test('planImport flags both tools when an import puts two in one slot', () => {
  const { problems } = lib.planImport([], [slotted(200, 3), slotted(201, 3)], magazine8);
  assert.deepStrictEqual([...problems.map(p => p.toolId)].sort(), [200, 201]);
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

test('numberingNotice speaks up only in Slot numbering', () => {
  assert.ok(lib.numberingNotice({ numbering: 'slot' }).includes('M6 T5 loads slot 5'));
  assert.strictEqual(lib.numberingNotice({ numbering: 'toolId' }), '');
});

// ---------- runner ----------
let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
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
