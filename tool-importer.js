/*
 * Tool Importer Module
 * 
 * Handles importing tool libraries from Fusion 360 JSON exports.
 */

// Plugin context reference
let pluginContext = null;

/**
 * Initialize the module with plugin context
 */
export function init(ctx) {
  pluginContext = ctx;
}

/**
 * Show the import dialog
 */
export function showImportDialog() {
  const settings = pluginContext.getSettings();
  const defaultSettings = {
    includeFusionToolNumber: settings.includeFusionToolNumber !== undefined ? settings.includeFusionToolNumber : false,
    preserveToolNumber: settings.preserveToolNumber !== undefined ? settings.preserveToolNumber : true
  };
  
  const html = `
    <style>
      .fusion-import-container {
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        color: var(--color-text-primary, #e0e0e0);
        padding: 20px;
        max-width: 900px;
        margin: 0 auto;
        max-height: 80vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      
      .fusion-header {
        text-align: center;
        margin-bottom: 16px;
      }
      
      .fusion-header p {
        margin: 0;
        color: var(--color-text-secondary, #999);
        font-size: 0.9rem;
      }
      
      .fusion-file-selector {
        text-align: center;
        padding: 30px 20px;
        border: 2px dashed var(--color-border, #444);
        border-radius: 8px;
        margin-bottom: 16px;
        background: var(--color-surface-muted, #1a1a1a);
      }
      
      .fusion-file-selector input[type="file"] {
        display: none;
      }
      
      .fusion-btn {
        padding: 12px 24px;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        user-select: none;
        -webkit-user-select: none;
      }
      
      .fusion-btn-primary {
        background: var(--color-accent, #1abc9c);
        color: white;
      }
      
      .fusion-btn-primary:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      
      .fusion-btn-secondary {
        background: var(--color-surface-muted, #2a2a2a);
        color: var(--color-text-primary, #e0e0e0);
        border: 1px solid var(--color-border, #444);
      }
      
      .fusion-btn-secondary:hover {
        background: var(--color-border, #444);
      }
      
      .fusion-btn-delete {
        background: #dc3545 !important;
        color: white !important;
        border: 1px solid #dc3545 !important;
      }
      
      .fusion-btn-delete:hover {
        background: #c82333 !important;
      }
      
      .fusion-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .fusion-config {
        background: var(--color-surface-muted, #1a1a1a);
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 24px;
      }
      
      .fusion-config-item {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      
      .fusion-config-item:last-child {
        margin-bottom: 0;
      }
      
      .fusion-config-item input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }
      
      .fusion-config-item label {
        cursor: pointer;
        user-select: none;
      }
      
      .fusion-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      
      .fusion-stat {
        background: var(--color-surface-muted, #1a1a1a);
        padding: 12px;
        border-radius: 6px;
        text-align: center;
      }
      
      .fusion-stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-accent, #1abc9c);
        margin-bottom: 2px;
      }
      
      .fusion-stat-label {
        font-size: 0.85rem;
        color: var(--color-text-secondary, #999);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .fusion-table-container {
        max-height: 350px;
        overflow-y: auto;
        border: 1px solid var(--color-border, #444);
        border-radius: 8px;
        margin-bottom: 16px;
        flex-shrink: 0;
      }
      
      .fusion-table {
        width: 100%;
        border-collapse: collapse;
      }
      
      .fusion-table thead {
        position: sticky;
        top: 0;
        background: var(--color-surface-muted, #1a1a1a);
        z-index: 10;
      }
      
      .fusion-table th {
        padding: 12px;
        text-align: left;
        font-weight: 600;
        border-bottom: 2px solid var(--color-border, #444);
        font-size: 0.85rem;
        letter-spacing: 0.5px;
      }
      
      .fusion-table td {
        padding: 12px;
        border-bottom: 1px solid var(--color-border, #333);
      }
      
      .fusion-table tbody tr:hover {
        background: var(--color-border, #2a2a2a);
      }
      
      .fusion-status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
      }
      
      .fusion-status-new {
        background: rgba(26, 188, 156, 0.2);
        color: #1abc9c;
      }
      
      .fusion-status-modified {
        background: rgba(255, 193, 7, 0.2);
        color: #ffc107;
      }
      
      .fusion-status-unchanged {
        background: rgba(108, 117, 125, 0.2);
        color: #6c757d;
      }
      
      .fusion-tool-id-cell {
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
        justify-content: center;
      }
      
      .fusion-tool-id-text {
        font-size: 1rem;
        font-weight: 600;
      }
      
      .fusion-tool-number-badge {
        display: inline-block;
        padding: 2px 6px;
        border: 1px solid #f59e0b;
        border-radius: 3px;
        background: #f59e0b;
        color: #000;
        font-size: 0.65rem;
        font-weight: 600;
        text-transform: uppercase;
        width: fit-content;
      }
      
      .fusion-tool-slot-placeholder {
        font-size: 0.65rem;
        color: var(--color-text-secondary, #999);
        opacity: 0.6;
      }
      
      .fusion-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 24px;
      }
      
      .fusion-error {
        background: rgba(220, 53, 69, 0.1);
        border: 1px solid #dc3545;
        color: #dc3545;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 16px;
        font-size: 0.9rem;
      }
      
      .fusion-success {
        background: rgba(26, 188, 156, 0.1);
        border: 1px solid #1abc9c;
        color: #1abc9c;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 16px;
        font-size: 0.9rem;
      }
      
      .fusion-hidden {
        display: none;
      }
      
      .fusion-confirm-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      
      .fusion-confirm-dialog {
        background: var(--color-surface, #1e1e1e);
        border: 1px solid var(--color-border, #444);
        border-radius: 8px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      }
      
      .fusion-confirm-message {
        color: var(--color-text-primary, #e0e0e0);
        font-size: 1rem;
        margin-bottom: 24px;
        line-height: 1.5;
      }
      
      .fusion-confirm-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
    </style>
    
    <div class="fusion-import-container">
      <div class="fusion-header">
        <p>Import tools from Fusion 360 tool library (JSON file or clipboard paste)</p>
      </div>
      
      <!-- File Selector -->
      <div id="fileSelector" class="fusion-file-selector">
        <input type="file" id="fileInput" accept=".json">
        <button id="selectFileBtn" class="fusion-btn fusion-btn-primary">
          Select Fusion 360 JSON File
        </button>
        <div style="margin-top: 12px;">
          <button id="pasteClipboardBtn" class="fusion-btn fusion-btn-secondary">
            Paste tool(s) from clipboard
          </button>
        </div>
      </div>
      
      <!-- Configuration -->
      <div id="configSection" class="fusion-config fusion-hidden">
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 0.95rem; color: var(--color-text-primary);">Import Settings</h3>
        <div class="fusion-config-item">
          <input type="checkbox" id="includeFusionToolNumber" ${defaultSettings.includeFusionToolNumber ? 'checked' : ''}>
          <label for="includeFusionToolNumber">Include Fusion 360 tool number in description</label>
        </div>
        <div class="fusion-config-item">
          <input type="checkbox" id="preserveToolNumber" ${defaultSettings.preserveToolNumber ? 'checked' : ''}>
          <label for="preserveToolNumber">Do not overwrite ncSender Slot number with Fusion 360 turret number (keep existing)</label>
        </div>
      </div>
      
      <!-- Error Display -->
      <div id="errorDisplay" class="fusion-error fusion-hidden"></div>
      
      <!-- Success Display -->
      <div id="successDisplay" class="fusion-success fusion-hidden"></div>
      
      <!-- Summary Stats -->
      <div id="summarySection" class="fusion-summary fusion-hidden">
        <div class="fusion-stat">
          <div class="fusion-stat-value" id="statTotal">0</div>
          <div class="fusion-stat-label">Tools in File</div>
        </div>
        <div class="fusion-stat">
          <div class="fusion-stat-value" id="statLibrary">0</div>
          <div class="fusion-stat-label">In Library</div>
        </div>
        <div class="fusion-stat">
          <div class="fusion-stat-value" id="statNew">0</div>
          <div class="fusion-stat-label">New</div>
        </div>
        <div class="fusion-stat">
          <div class="fusion-stat-value" id="statModified">0</div>
          <div class="fusion-stat-label">Modified</div>
        </div>
      </div>
      
      <!-- Comparison Table -->
      <div id="tableSection" class="fusion-table-container fusion-hidden">
        <table class="fusion-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Tool ID</th>
              <th>Description</th>
              <th>Type</th>
              <th>Diameter</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody id="tableBody">
          </tbody>
        </table>
      </div>
      
      <!-- Actions -->
      <div id="actionsSection" class="fusion-actions fusion-hidden">
        <button id="closeBtn" class="fusion-btn fusion-btn-secondary">
          Close
        </button>
        <button id="deleteLibraryBtn" class="fusion-btn fusion-btn-delete">
          Delete Library
        </button>
        <button id="importNewBtn" class="fusion-btn fusion-btn-secondary">
          Import New (<span id="newCount">0</span>)
        </button>
        <button id="importAllBtn" class="fusion-btn fusion-btn-primary">
          Import All (<span id="modifiedCount">0</span>)
        </button>
      </div>
    </div>
    
    <script>
      (function() {
        let errorTimeout = null;
        
        const TYPE_MAPPING = {
          'flat end mill': 'flat',
          'ball end mill': 'ball',
          'bull nose end mill': 'ball',
          'chamfer mill': 'v-bit',
          'countersink': 'v-bit',
          'dovetail mill': 'v-bit',
          'tapered mill': 'v-bit',
          'drill': 'drill',
          'counterbore': 'drill',
          'reamer': 'drill',
          'spot drill': 'drill',
          'face mill': 'surfacing',
          'slot mill': 'flat',
          'form mill': 'flat',
          'thread mill': 'thread-mill',
          'tap': 'thread-mill',
          'tap left hand': 'thread-mill',
          'tap right hand': 'thread-mill',
          'probe': 'probe'
        };
        
        let existingTools = [];
        let newTools = [];
        let comparison = [];
        let dataSource = null; // 'file' or 'clipboard'
        let originalData = null; // Store original data for rebuilding
        let settings = {
          includeFusionToolNumber: ${defaultSettings.includeFusionToolNumber},
          preserveToolNumber: ${defaultSettings.preserveToolNumber}
        };
        
        loadExistingTools();
        
        async function loadExistingTools() {
          try {
            const response = await fetch('/api/tools');
            if (response.ok) {
              existingTools = await response.json();
            }
          } catch (error) {
            console.error('Failed to load existing tools:', error);
          }
        }
        
        function selectFile() {
          document.getElementById('fileInput').click();
        }
        
        document.getElementById('selectFileBtn').addEventListener('click', selectFile);
        
        document.getElementById('pasteClipboardBtn').addEventListener('click', async function(event) {
          event.preventDefault();
          event.stopPropagation();
          
          document.getElementById('errorDisplay').classList.add('fusion-hidden');
          document.getElementById('successDisplay').classList.add('fusion-hidden');
          
          try {
            // Directly read clipboard - this executes immediately without showing a menu
            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText || clipboardText.trim() === '') {
              showError('Clipboard is empty');
              return;
            }
            
            dataSource = 'clipboard';
            originalData = clipboardText;
            const tools = parseTSVData(clipboardText, settings);
            
            if (tools.length === 0) {
              showError('No valid tools found in clipboard data');
              return;
            }
            
            newTools = tools;
            await loadExistingTools();
            rebuildComparison();
            
            document.getElementById('fileSelector').classList.add('fusion-hidden');
            document.getElementById('configSection').classList.remove('fusion-hidden');
            document.getElementById('summarySection').classList.remove('fusion-hidden');
            document.getElementById('tableSection').classList.remove('fusion-hidden');
            document.getElementById('actionsSection').classList.remove('fusion-hidden');
            
          } catch (error) {
            if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
              showError('Please allow clipboard access or copy the data first');
            } else {
              showError('Failed to read clipboard: ' + error.message);
            }
          }
        });
        
        // Prevent context menu on paste button
        document.getElementById('pasteClipboardBtn').addEventListener('contextmenu', function(event) {
          event.preventDefault();
        });
        
        document.getElementById('fileInput').onchange = async function(event) {
          const file = event.target.files[0];
          if (!file) return;
          
          document.getElementById('errorDisplay').classList.add('fusion-hidden');
          document.getElementById('successDisplay').classList.add('fusion-hidden');
          
          try {
            const content = await file.text();
            const fusionData = JSON.parse(content);
            
            dataSource = 'file';
            originalData = fusionData;
            newTools = [];
            const errors = [];
            
            for (const fusionTool of fusionData.data || []) {
              try {
                const ncTool = convertFusionTool(fusionTool, settings);
                newTools.push(ncTool);
              } catch (error) {
                errors.push(\`Tool \${fusionTool['post-process']?.number || 'unknown'}: \${error.message}\`);
              }
            }
            
            if (errors.length > 0) {
              showError('Some tools could not be imported:\\n' + errors.join('\\n'));
            }
            
            if (newTools.length === 0) {
              showError('No valid tools found in file');
              document.getElementById('fileSelector').classList.remove('fusion-hidden');
              document.getElementById('configSection').classList.add('fusion-hidden');
              document.getElementById('summarySection').classList.add('fusion-hidden');
              document.getElementById('tableSection').classList.add('fusion-hidden');
              document.getElementById('actionsSection').classList.add('fusion-hidden');
              return;
            }
            
            await loadExistingTools();
            rebuildComparison();
            
            document.getElementById('fileSelector').classList.add('fusion-hidden');
            document.getElementById('configSection').classList.remove('fusion-hidden');
            document.getElementById('summarySection').classList.remove('fusion-hidden');
            document.getElementById('tableSection').classList.remove('fusion-hidden');
            document.getElementById('actionsSection').classList.remove('fusion-hidden');
            
          } catch (error) {
            showError('Failed to parse JSON file: ' + error.message);
            document.getElementById('fileSelector').classList.remove('fusion-hidden');
            document.getElementById('configSection').classList.add('fusion-hidden');
            document.getElementById('summarySection').classList.add('fusion-hidden');
            document.getElementById('tableSection').classList.add('fusion-hidden');
            document.getElementById('actionsSection').classList.add('fusion-hidden');
          }
        };
        
        function parseTSVData(tsvText, settings) {
          const lines = tsvText.split('\\n').filter(line => line.trim() !== '');
          if (lines.length < 2) {
            return [];
          }
          
          // Parse header row
          const headerLine = lines[0];
          const headers = parseTSVLine(headerLine);
          
          // Find column indices
          const columnMap = {};
          headers.forEach((header, index) => {
            // Remove quotes and extract field name
            const cleanHeader = header.replace(/^"|"$/g, '').trim();
            columnMap[cleanHeader] = index;
          });
          
          // Parse data rows and deduplicate by toolId (keep first occurrence)
          const tools = [];
          const seenToolIds = new Set();
          const errors = [];
          
          for (let i = 1; i < lines.length; i++) {
            try {
              const values = parseTSVLine(lines[i]);
              const tool = convertTSVTool(values, columnMap, settings);
              if (tool) {
                // Only add tool if we haven't seen this toolId before
                // This handles multiple rows for the same tool (different presets)
                if (!seenToolIds.has(tool.toolId)) {
                  seenToolIds.add(tool.toolId);
                  tools.push(tool);
                }
              }
            } catch (error) {
              errors.push(\`Row \${i + 1}: \${error.message}\`);
            }
          }
          
          if (errors.length > 0 && tools.length === 0) {
            throw new Error('Failed to parse any tools:\\n' + errors.slice(0, 5).join('\\n'));
          }
          
          return tools;
        }
        
        function parseTSVLine(line) {
          const values = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              // Check if this is an escaped quote (two quotes in a row)
              if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                // This is an escaped quote - add one quote to output and skip the next one
                current += '"';
                i++; // Skip the next quote
              } else {
                // This is a field delimiter quote - toggle inQuotes state
                inQuotes = !inQuotes;
              }
            } else if (char === '\\t' && !inQuotes) {
              values.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current); // Add last value
          
          return values;
        }
        
        function convertTSVTool(values, columnMap, settings) {
          // Helper to get value by column name
          const getValue = (columnName) => {
            const index = columnMap[columnName];
            if (index === undefined || index >= values.length) return '';
            const value = values[index];
            // Parser already handles escaped quotes, just trim
            return value.trim();
          };
          
          // Get required fields
          const toolIndexStr = getValue('Tool Index (tool_index)');
          if (!toolIndexStr || toolIndexStr === '') {
            throw new Error('Missing tool index');
          }
          
          const toolIndex = parseInt(toolIndexStr, 10);
          if (isNaN(toolIndex)) {
            throw new Error(\`Invalid tool index: \${toolIndexStr}\`);
          }
          
          // Get tool number (this is the Fusion 360 tool number that appears in G-code, e.g., T21)
          const toolNumberStr = getValue('Number (tool_number)');
          let fusionToolNumber = null;
          let toolNumber = null; // ATC pocket number (from turret field, if available)
          
          if (toolNumberStr && toolNumberStr !== '') {
            const num = parseInt(toolNumberStr, 10);
            if (!isNaN(num) && num > 0) {
              fusionToolNumber = num; // This becomes toolId
            }
          }
          
          // If no tool number, fall back to tool index
          if (fusionToolNumber === null) {
            fusionToolNumber = toolIndex;
          }
          
          // Get turret number (ATC slot) from TSV if available - but only if not preserving
          if (!settings.preserveToolNumber) {
            const turretStr = getValue('Turret (tool_turret)');
            if (turretStr && turretStr !== '') {
              const turretNum = parseInt(turretStr, 10);
              if (!isNaN(turretNum) && turretNum > 0) {
                toolNumber = turretNum;
              }
            }
          }
          
          // Get diameter and unit
          const diameterStr = getValue('Diameter (tool_diameter)');
          const diameter = parseFloat(diameterStr);
          if (isNaN(diameter) || diameter <= 0) {
            throw new Error(\`Invalid diameter: \${diameterStr}\`);
          }
          
          // Get unit and convert to mm if needed
          const unitStr = getValue('Unit (tool_unit)') || '';
          const unit = unitStr.toLowerCase().trim();
          
          let diameterInMm = diameter;
          if (unit.includes('inch')) {
            // Convert inches to millimeters
            diameterInMm = diameter * 25.4;
          }
          
          // Round to 0.00001 mm precision to avoid floating point errors
          diameterInMm = Math.round(diameterInMm * 100000) / 100000;
          
          // Get type
          const toolType = getValue('Type (tool_type)') || '';
          const ncSenderType = TYPE_MAPPING[toolType.toLowerCase()] || 'flat';
          
          // Get description
          let description = getValue('Description (tool_description)') || '';
          if (!description || description.trim() === '') {
            const presetName = getValue('Preset Name (preset_name)') || '';
            if (presetName) {
              description = presetName;
            } else {
              const paddedNumber = String(fusionToolNumber).padStart(3, '0');
              description = \`Tool \${paddedNumber}\`;
            }
          }
          
          // Add Fusion tool number to description if enabled
          if (settings.includeFusionToolNumber) {
            const paddedNumber = String(fusionToolNumber).padStart(3, '0');
            if (!description.startsWith(\`\${paddedNumber} -\`) && !description.startsWith(\`\${fusionToolNumber} -\`)) {
              description = \`\${paddedNumber} - \${description}\`;
            }
          }
          
          // Get comment/notes
          const comment = getValue('Comment (tool_comment)') || '';
          
          // Get product ID/SKU
          const productId = getValue('Product ID (tool_productId)') || '';
          
          return {
            toolId: fusionToolNumber,
            toolNumber: toolNumber,
            name: description.trim(),
            type: ncSenderType,
            diameter: diameterInMm,
            offsets: { tlo: 0, x: 0, y: 0, z: 0 },
            metadata: {
              notes: comment,
              image: '',
              sku: productId
            }
          };
        }
        
        function convertFusionTool(fusionTool, settings) {
          const fusionToolNumber = fusionTool['post-process']?.number;
          if (fusionToolNumber === undefined || fusionToolNumber === null) {
            throw new Error('Tool missing Fusion 360 tool number');
          }
          
          const fusionType = fusionTool.type?.toLowerCase() || '';
          const ncSenderType = TYPE_MAPPING[fusionType] || 'flat';
          
          // Only get turret if not preserving existing slot assignments
          let toolNumber = null;
          if (!settings.preserveToolNumber) {
            const turret = fusionTool['post-process']?.turret;
            toolNumber = (turret !== undefined && turret !== null && turret > 0) ? turret : null;
          }
          
          const diameter = fusionTool.geometry?.DC || 0;
          if (diameter <= 0) {
            throw new Error(\`Invalid diameter: \${diameter}\`);
          }
          
          // Get unit and convert to mm if needed
          // Check expressions.tool_unit (can be "'millimeters'" or "'inches'" with quotes)
          const toolUnit = fusionTool.expressions?.tool_unit || '';
          let diameterInMm = diameter;
          // Remove quotes and single quotes, then check if it's inches
          const unitStr = toolUnit.replace(/['"]/g, '').toLowerCase().trim();
          if (unitStr.includes('inch')) {
            // Convert inches to millimeters
            diameterInMm = diameter * 25.4;
          }
          
          // Round to 0.00001 mm precision to avoid floating point errors
          diameterInMm = Math.round(diameterInMm * 100000) / 100000;
          
          let description = fusionTool.description || '';
          if (!description || description.trim() === '') {
            // Try preset name as fallback (matches TSV import behavior)
            const presetName = fusionTool['preset-name'] || '';
            if (presetName) {
              description = presetName;
            } else {
              const paddedNumber = String(fusionToolNumber).padStart(3, '0');
              description = \`Tool \${paddedNumber}\`;
            }
          }
          
          if (settings.includeFusionToolNumber) {
            const paddedNumber = String(fusionToolNumber).padStart(3, '0');
            if (!description.startsWith(\`\${paddedNumber} -\`) && !description.startsWith(\`\${fusionToolNumber} -\`)) {
              description = \`\${paddedNumber} - \${description}\`;
            }
          }
          
          return {
            toolId: fusionToolNumber,
            toolNumber: toolNumber,
            name: description.trim(),
            type: ncSenderType,
            diameter: diameterInMm,
            offsets: { tlo: 0, x: 0, y: 0, z: 0 },
            metadata: {
              notes: fusionTool['post-process']?.comment || '',
              image: '',
              sku: fusionTool['product-id'] || ''
            }
          };
        }
        
        function rebuildComparison() {
          comparison = newTools.map(newTool => {
            const existing = existingTools.find(t => t.toolId === newTool.toolId);
            let status = 'new';
            const changes = [];
            
            if (existing) {
              if (existing.name !== newTool.name) changes.push('Description');
              if (existing.type !== newTool.type) changes.push('Type');
              if (Math.abs(existing.diameter - newTool.diameter) > 0.001) changes.push('Diameter');
              // Only flag slot changes if we're actually updating slots (not preserving)
              if (!settings.preserveToolNumber && existing.toolNumber !== newTool.toolNumber) changes.push('Slot');
              if (existing.metadata?.notes !== newTool.metadata.notes) changes.push('Notes');
              if (existing.metadata?.sku !== newTool.metadata.sku) changes.push('SKU');
              
              status = changes.length > 0 ? 'modified' : 'unchanged';
            }
            
            return { status, tool: newTool, existing: existing || null, changes };
          });
          
          comparison.sort((a, b) => a.tool.toolId - b.tool.toolId);
          updateUI();
        }
        
        function updateUI() {
          const newCount = comparison.filter(c => c.status === 'new').length;
          const modifiedCount = comparison.filter(c => c.status === 'modified').length;
          
          document.getElementById('statTotal').textContent = newTools.length;
          document.getElementById('statLibrary').textContent = existingTools.length;
          document.getElementById('statNew').textContent = newCount;
          document.getElementById('statModified').textContent = modifiedCount;
          document.getElementById('newCount').textContent = newCount;
          document.getElementById('modifiedCount').textContent = newCount + modifiedCount;
          
          const tbody = document.getElementById('tableBody');
          tbody.innerHTML = comparison.map(item => {
            const statusClass = \`fusion-status-\${item.status}\`;
            
            // Build Tool ID cell with slot badge (matching ncSender display)
            const slotBadge = item.tool.toolNumber !== null 
              ? \`<span class="fusion-tool-number-badge">Slot\${item.tool.toolNumber}</span>\`
              : \`<span class="fusion-tool-slot-placeholder">No Slot</span>\`;
            
            const toolIdCell = \`
              <div class="fusion-tool-id-cell">
                <span class="fusion-tool-id-text">\${item.tool.toolId}</span>
                \${slotBadge}
              </div>
            \`;
            
            const changesDisplay = item.changes && item.changes.length > 0 
              ? item.changes.join(', ')
              : '-';
            
            return \`
              <tr>
                <td><span class="fusion-status-badge \${statusClass}">\${item.status}</span></td>
                <td>\${toolIdCell}</td>
                <td>\${item.tool.name}</td>
                <td>\${item.tool.type}</td>
                <td>\${item.tool.diameter.toFixed(3)} mm</td>
                <td>\${changesDisplay}</td>
              </tr>
            \`;
          }).join('');
        }
        
        document.getElementById('includeFusionToolNumber').onchange = async function(event) {
          settings.includeFusionToolNumber = event.target.checked;
          await saveSettings();
          
          try {
            if (dataSource === 'file' && originalData) {
              // Rebuild from JSON file data
              newTools = [];
              for (const fusionTool of originalData.data || []) {
                try {
                  const ncTool = convertFusionTool(fusionTool, settings);
                  newTools.push(ncTool);
                } catch (error) {}
              }
            } else if (dataSource === 'clipboard' && originalData) {
              // Rebuild from TSV clipboard data
              newTools = parseTSVData(originalData, settings);
            } else {
              // Fallback: try to read from file input
              const fileInput = document.getElementById('fileInput');
              if (fileInput.files[0]) {
                const content = await fileInput.files[0].text();
                const fusionData = JSON.parse(content);
                originalData = fusionData;
                dataSource = 'file';
                newTools = [];
                for (const fusionTool of fusionData.data || []) {
                  try {
                    const ncTool = convertFusionTool(fusionTool, settings);
                    newTools.push(ncTool);
                  } catch (error) {}
                }
              }
            }
          } catch (error) {
            showError('Failed to rebuild tools: ' + error.message);
          }
          
          rebuildComparison();
        };
        
        document.getElementById('preserveToolNumber').onchange = async function(event) {
          settings.preserveToolNumber = event.target.checked;
          await saveSettings();
          
          // Rebuild tools from original data with new setting
          try {
            if (dataSource === 'file' && originalData) {
              newTools = [];
              for (const fusionTool of originalData.data || []) {
                try {
                  const ncTool = convertFusionTool(fusionTool, settings);
                  
                  // If preserving and tool exists in library, use its current slot
                  if (settings.preserveToolNumber) {
                    const existing = existingTools.find(t => t.toolId === ncTool.toolId);
                    if (existing) {
                      ncTool.toolNumber = existing.toolNumber;
                    }
                  }
                  
                  newTools.push(ncTool);
                } catch (error) {}
              }
            } else if (dataSource === 'clipboard' && originalData) {
              newTools = parseTSVData(originalData, settings);
              
              // If preserving, update slots for existing tools
              if (settings.preserveToolNumber) {
                newTools = newTools.map(ncTool => {
                  const existing = existingTools.find(t => t.toolId === ncTool.toolId);
                  if (existing) {
                    return { ...ncTool, toolNumber: existing.toolNumber };
                  }
                  return ncTool;
                });
              }
            }
          } catch (error) {
            showError('Failed to rebuild tools: ' + error.message);
          }
          
          rebuildComparison();
        };
        
        async function saveSettings() {
          try {
            await fetch('/api/plugins/com.ncsender.fusion360-import/settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(settings)
            });
          } catch (error) {
            console.error('Failed to save settings:', error);
          }
        }
        
        function showConfirmDialog(message) {
          return new Promise((resolve) => {
            const container = document.querySelector('.fusion-import-container');
            if (!container) {
              resolve(false);
              return;
            }
            
            // Prevent scrolling on the container
            const originalOverflow = container.style.overflow;
            container.style.overflow = 'hidden';
            
            const overlay = document.createElement('div');
            overlay.className = 'fusion-confirm-overlay';
            overlay.innerHTML = \`
              <div class="fusion-confirm-dialog">
                <div class="fusion-confirm-message">\${message}</div>
                <div class="fusion-confirm-actions">
                  <button class="fusion-btn fusion-btn-secondary" id="confirmCancel">Cancel</button>
                  <button class="fusion-btn fusion-btn-primary" id="confirmOK">OK</button>
                </div>
              </div>
            \`;
            
            container.appendChild(overlay);
            
            const cleanup = () => {
              if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
              container.style.overflow = originalOverflow;
            };
            
            const handleCancel = () => {
              cleanup();
              resolve(false);
            };
            
            const handleOK = () => {
              cleanup();
              resolve(true);
            };
            
            overlay.querySelector('#confirmCancel').addEventListener('click', handleCancel);
            overlay.querySelector('#confirmOK').addEventListener('click', handleOK);
            
            // Close on overlay click (outside dialog)
            overlay.addEventListener('click', (e) => {
              if (e.target === overlay) {
                handleCancel();
              }
            });
            
            // Close on Escape key
            const handleEscape = (e) => {
              if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', handleEscape);
              }
            };
            document.addEventListener('keydown', handleEscape);
          });
        }
        
        async function deleteLibrary() {
          const confirmed = await showConfirmDialog('Are you sure you want to delete ALL tools from the current library?');
          if (!confirmed) {
            return;
          }
          
          try {
            const response = await fetch('/api/tools', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify([])
            });
            if (!response.ok) {
              throw new Error('Failed to delete library');
            }
            
            existingTools = [];
            rebuildComparison();
            showSuccess('Library deleted successfully');
          } catch (error) {
            showError('Failed to delete library: ' + error.message);
          }
        }
        
        async function importNew() {
          const toolsToImport = comparison
            .filter(c => c.status === 'new')
            .map(c => c.tool);
          
          if (toolsToImport.length === 0) {
            showError('No new tools to import');
            return;
          }
          
          await performImport(toolsToImport);
        }
        
        async function importAll() {
          const toolsToImport = comparison
            .filter(c => c.status === 'new' || c.status === 'modified')
            .map(c => {
              const tool = { ...c.tool };
              
              // If preserveToolNumber is checked and tool exists, use existing slot
              if (settings.preserveToolNumber && c.existing) {
                tool.toolNumber = c.existing.toolNumber;
              }
              // Otherwise: tool.toolNumber is already correct from conversion
              // (null if preserving, or Fusion turret if not)
              
              return tool;
            });
          
          if (toolsToImport.length === 0) {
            showError('No tools to import');
            return;
          }
          
          await performImport(toolsToImport);
        }
        
        async function performImport(toolsToImport) {
          try {
            const mergedTools = [...existingTools];
            
            toolsToImport.forEach(importTool => {
              const existingIndex = mergedTools.findIndex(t => t.toolId === importTool.toolId);
              if (existingIndex >= 0) {
                // Update existing tool: preserve id and merge other properties
                const existingTool = mergedTools[existingIndex];
                mergedTools[existingIndex] = { 
                  ...importTool, 
                  id: existingTool.id  // Preserve the existing internal id
                };
              } else {
                // New tool - remove id if present, let ncSender migration generate it
                const { id, ...newTool } = importTool;
                mergedTools.push(newTool);
              }
            });
            
            const response = await fetch('/api/tools', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mergedTools)
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to import tools');
            }
            
            showSuccess(\`Successfully imported \${toolsToImport.length} tool(s)!\`);
            
            setTimeout(() => {
              window.parent.postMessage({ type: 'close-plugin-dialog' }, '*');
            }, 1500);
            
          } catch (error) {
            showError('Import failed: ' + error.message);
          }
        }
        
        function showError(message) {
          const errorDiv = document.getElementById('errorDisplay');
          errorDiv.textContent = message;
          errorDiv.classList.remove('fusion-hidden');
          document.getElementById('successDisplay').classList.add('fusion-hidden');
          
          if (errorTimeout) clearTimeout(errorTimeout);
          errorTimeout = setTimeout(() => {
            errorDiv.classList.add('fusion-hidden');
          }, 3000);
        }
        
        function showSuccess(message) {
          const successDiv = document.getElementById('successDisplay');
          successDiv.textContent = message;
          successDiv.classList.remove('fusion-hidden');
          document.getElementById('errorDisplay').classList.add('fusion-hidden');
        }
        
        document.getElementById('closeBtn').addEventListener('click', () => {
          window.parent.postMessage({ type: 'close-plugin-dialog' }, '*');
        });
        document.getElementById('deleteLibraryBtn').addEventListener('click', deleteLibrary);
        document.getElementById('importNewBtn').addEventListener('click', importNew);
        document.getElementById('importAllBtn').addEventListener('click', importAll);
      })();
    </script>
  `;
  
  pluginContext.showDialog('Fusion 360 Tool Importer', html, { closable: true });
}

