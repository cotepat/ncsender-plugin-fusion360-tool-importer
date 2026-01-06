/*
 * Fusion 360 Tool Library Import Plugin
 * 
 * This plugin allows importing tool libraries exported from Fusion 360.
 * It converts Fusion 360 tool format to ncSender tool format.
 */

// Plugin context (will be set in onLoad)
let pluginContext = null;

/**
 * Plugin initialization
 */
export function onLoad(ctx) {
  pluginContext = ctx;
  
  // Register tool menu item
  ctx.registerToolMenu('Fusion 360 Tool Importer', () => {
    showImportDialog();
  });
  
  ctx.log('Fusion 360 Tool Importer loaded');
}

/**
 * Plugin cleanup
 */
export function onUnload(ctx) {
  ctx.log('Fusion 360 Tool Importer unloaded');
}

/**
 * Show the import dialog
 */
function showImportDialog() {
  const settings = pluginContext.getSettings();
  const defaultSettings = {
    includeFusionToolNumber: settings.includeFusionToolNumber !== undefined ? settings.includeFusionToolNumber : true,
    preserveToolNumber: settings.preserveToolNumber !== undefined ? settings.preserveToolNumber : false
  };
  
  const html = `
    <style>
      .fusion-import-container {
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
        text-transform: uppercase;
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
      
      .fusion-tool-number-badge {
        display: inline-block;
        padding: 6px 16px;
        border: 1px solid var(--color-accent, #1abc9c);
        border-radius: 4px;
        background: var(--color-surface, #1a1a1a);
        color: var(--color-text-primary, #e0e0e0);
        font-size: 0.85rem;
        font-weight: 500;
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
    </style>
    
    <div class="fusion-import-container">
      <div class="fusion-header">
        <p>Import tools from Fusion 360 tool library JSON export</p>
      </div>
      
      <!-- File Selector -->
      <div id="fileSelector" class="fusion-file-selector">
        <input type="file" id="fileInput" accept=".json">
        <button id="selectFileBtn" class="fusion-btn fusion-btn-primary">
          Select Fusion 360 JSON File
        </button>
      </div>
      
      <!-- Configuration -->
      <div id="configSection" class="fusion-config fusion-hidden">
        <div class="fusion-config-item">
          <input type="checkbox" id="includeFusionToolNumber" ${defaultSettings.includeFusionToolNumber ? 'checked' : ''}>
          <label for="includeFusionToolNumber">Include Fusion 360 tool number in description</label>
        </div>
        <div class="fusion-config-item">
          <input type="checkbox" id="preserveToolNumber" ${defaultSettings.preserveToolNumber ? 'checked' : ''}>
          <label for="preserveToolNumber">Do not overwrite ATC Tool Number (keep existing values)</label>
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
          <div class="fusion-stat-label">Tools in Current Library</div>
        </div>
        <div class="fusion-stat">
          <div class="fusion-stat-value" id="statNew">0</div>
          <div class="fusion-stat-label">New Tools</div>
        </div>
        <div class="fusion-stat">
          <div class="fusion-stat-value" id="statModified">0</div>
          <div class="fusion-stat-label">Modified Tools</div>
        </div>
      </div>
      
      <!-- Comparison Table -->
      <div id="tableSection" class="fusion-table-container fusion-hidden">
        <table class="fusion-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>ID</th>
              <th>Tool #</th>
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
          Delete Current Library
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
        // Error message timeout
        let errorTimeout = null;
        
        // Tool type mapping: Fusion 360 type -> ncSender type
        // EXACT MATCHES ONLY - based on Fusion 360 type field, not name
        const TYPE_MAPPING = {
          // End mills
          'flat end mill': 'flat',
          'ball end mill': 'ball',
          'bull nose end mill': 'ball',      // Rounded tip, similar to ball
          
          // Angular/Conical tools
          'chamfer mill': 'v-bit',
          'countersink': 'v-bit',            // Conical screw-head recesses
          'dovetail mill': 'v-bit',          // Angular slots
          'tapered mill': 'v-bit',           // Conical mills
          
          // Hole-making tools
          'drill': 'drill',
          'counterbore': 'drill',            // Flat-bottomed holes
          'reamer': 'drill',                 // Hole finishing
          'spot drill': 'drill',             // Hole starting
          
          // Surfacing
          'face mill': 'surfacing',
          
          // Slotting
          'slot mill': 'flat',               // Flat-bottom slotting
          
          // Custom/Special
          'form mill': 'flat',               // Custom profile, default to flat
          
          // Threading
          'thread mill': 'thread-mill',
          'tap': 'thread-mill',
          'tap left hand': 'thread-mill',
          'tap right hand': 'thread-mill',
          
          // Probing
          'probe': 'probe'
        };
        
        let existingTools = [];
        let newTools = [];
        let comparison = [];
        let settings = {
          includeFusionToolNumber: ${defaultSettings.includeFusionToolNumber},
          preserveToolNumber: ${defaultSettings.preserveToolNumber}
        };
        
        // Load existing tools on init
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
        
        // Attach event listeners
        document.getElementById('selectFileBtn').addEventListener('click', selectFile);
        
        document.getElementById('fileInput').onchange = async function(event) {
          const file = event.target.files[0];
          if (!file) return;
          
          // Clear any previous error/success messages
          document.getElementById('errorDisplay').classList.add('fusion-hidden');
          document.getElementById('successDisplay').classList.add('fusion-hidden');
          
          try {
            const content = await file.text();
            const fusionData = JSON.parse(content);
            
            // Convert Fusion tools to ncSender format
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
              // Show file selector again and hide other sections
              document.getElementById('fileSelector').classList.remove('fusion-hidden');
              document.getElementById('configSection').classList.add('fusion-hidden');
              document.getElementById('summarySection').classList.add('fusion-hidden');
              document.getElementById('tableSection').classList.add('fusion-hidden');
              document.getElementById('actionsSection').classList.add('fusion-hidden');
              return;
            }
            
            // Reload existing tools (in case they changed)
            await loadExistingTools();
            
            // Build comparison
            rebuildComparison();
            
            // Show UI
            document.getElementById('fileSelector').classList.add('fusion-hidden');
            document.getElementById('configSection').classList.remove('fusion-hidden');
            document.getElementById('summarySection').classList.remove('fusion-hidden');
            document.getElementById('tableSection').classList.remove('fusion-hidden');
            document.getElementById('actionsSection').classList.remove('fusion-hidden');
            
          } catch (error) {
            showError('Failed to parse JSON file: ' + error.message);
            // Show file selector again and hide other sections
            document.getElementById('fileSelector').classList.remove('fusion-hidden');
            document.getElementById('configSection').classList.add('fusion-hidden');
            document.getElementById('summarySection').classList.add('fusion-hidden');
            document.getElementById('tableSection').classList.add('fusion-hidden');
            document.getElementById('actionsSection').classList.add('fusion-hidden');
          }
        };
        
        function convertFusionTool(fusionTool, settings) {
          const fusionToolNumber = fusionTool['post-process']?.number;
          if (fusionToolNumber === undefined || fusionToolNumber === null) {
            throw new Error('Tool missing Fusion 360 tool number');
          }
          
          const fusionType = fusionTool.type?.toLowerCase() || '';
          
          // Use EXACT TYPE MATCHING ONLY - no name inference
          const ncSenderType = TYPE_MAPPING[fusionType] || 'flat';
          
          const turret = fusionTool['post-process']?.turret;
          const toolNumber = (turret !== undefined && turret !== null && turret > 0) ? turret : null;
          
          const diameter = fusionTool.geometry?.DC || 0;
          if (diameter <= 0) {
            throw new Error(\`Invalid diameter: \${diameter}\`);
          }
          
          let description = fusionTool.description || '';
          if (!description || description.trim() === '') {
            const paddedNumber = String(fusionToolNumber).padStart(3, '0');
            description = \`Tool \${paddedNumber}\`;
          }
          
          if (settings.includeFusionToolNumber) {
            const paddedNumber = String(fusionToolNumber).padStart(3, '0');
            if (!description.startsWith(\`\${paddedNumber} -\`) && !description.startsWith(\`\${fusionToolNumber} -\`)) {
              description = \`\${paddedNumber} - \${description}\`;
            }
          }
          
          return {
            id: fusionToolNumber,
            toolNumber: toolNumber,
            name: description.trim(),
            type: ncSenderType,
            diameter: diameter,
            offsets: {
              tlo: 0,
              x: 0,
              y: 0,
              z: 0
            },
            metadata: {
              notes: fusionTool['post-process']?.comment || '',
              image: '',
              sku: fusionTool['product-id'] || ''
            }
          };
        }
        
        function areToolsDifferent(existing, newTool, preserveToolNumber) {
          if (existing.name !== newTool.name) return true;
          if (existing.type !== newTool.type) return true;
          if (Math.abs(existing.diameter - newTool.diameter) > 0.001) return true;
          if (!preserveToolNumber && existing.toolNumber !== newTool.toolNumber) return true;
          if (existing.metadata.notes !== newTool.metadata.notes) return true;
          if (existing.metadata.sku !== newTool.metadata.sku) return true;
          return false;
        }
        
        function rebuildComparison() {
          comparison = newTools.map(newTool => {
            const existing = existingTools.find(t => t.id === newTool.id);
            let status = 'new';
            const changes = [];
            
            if (existing) {
              // Check what changed
              if (existing.name !== newTool.name) changes.push('Description');
              if (existing.type !== newTool.type) changes.push('Type');
              if (Math.abs(existing.diameter - newTool.diameter) > 0.001) changes.push('Diameter');
              if (!settings.preserveToolNumber && existing.toolNumber !== newTool.toolNumber) changes.push('Tool #');
              if (existing.metadata.notes !== newTool.metadata.notes) changes.push('Notes');
              if (existing.metadata.sku !== newTool.metadata.sku) changes.push('SKU');
              
              status = changes.length > 0 ? 'modified' : 'unchanged';
            }
            
            return {
              status,
              tool: newTool,
              existing: existing || null,
              changes: changes
            };
          });
          
          // Sort by tool ID numerically
          comparison.sort((a, b) => a.tool.id - b.tool.id);
          
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
            const toolNumberDisplay = item.tool.toolNumber !== null 
              ? \`<span class="fusion-tool-number-badge">T\${item.tool.toolNumber}</span>\`
              : '-';
            const changesDisplay = item.changes && item.changes.length > 0 
              ? item.changes.join(', ')
              : '-';
            
            return \`
              <tr>
                <td><span class="fusion-status-badge \${statusClass}">\${item.status}</span></td>
                <td>\${item.tool.id}</td>
                <td>\${toolNumberDisplay}</td>
                <td>\${item.tool.name}</td>
                <td>\${item.tool.type}</td>
                <td>\${item.tool.diameter.toFixed(2)} mm</td>
                <td>\${changesDisplay}</td>
              </tr>
            \`;
          }).join('');
        }
        
        document.getElementById('includeFusionToolNumber').onchange = async function(event) {
          settings.includeFusionToolNumber = event.target.checked;
          await saveSettings();
          
          // Rebuild tools with new setting
          const errors = [];
          newTools = [];
          const fileInput = document.getElementById('fileInput');
          if (fileInput.files[0]) {
            try {
              const content = await fileInput.files[0].text();
              const fusionData = JSON.parse(content);
              for (const fusionTool of fusionData.data || []) {
                try {
                  const ncTool = convertFusionTool(fusionTool, settings);
                  newTools.push(ncTool);
                } catch (error) {
                  errors.push(\`Tool \${fusionTool['post-process']?.number || 'unknown'}: \${error.message}\`);
                }
              }
            } catch (error) {
              showError('Failed to rebuild tools: ' + error.message);
            }
          }
          
          rebuildComparison();
        };
        
        document.getElementById('preserveToolNumber').onchange = async function(event) {
          settings.preserveToolNumber = event.target.checked;
          await saveSettings();
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
        
        async function deleteLibrary() {
          if (!confirm('Are you sure you want to delete ALL tools from the current library?')) {
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
              if (settings.preserveToolNumber && c.existing) {
                tool.toolNumber = c.existing.toolNumber;
              }
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
              const existingIndex = mergedTools.findIndex(t => t.id === importTool.id);
              if (existingIndex >= 0) {
                mergedTools[existingIndex] = importTool;
              } else {
                mergedTools.push(importTool);
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
            
            // Close dialog after showing success message
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
          
          // Clear any existing timeout
          if (errorTimeout) {
            clearTimeout(errorTimeout);
          }
          
          // Auto-dismiss after 5 seconds
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
        
        // Attach event listeners for action buttons
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
