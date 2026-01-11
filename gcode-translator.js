/*
 * G-Code Translator Module
 * 
 * Handles translating Fusion 360 tool numbers to ncSender ATC pocket numbers.
 */

// Plugin context reference
let pluginContext = null;

// Node.js modules (available in server-side code)
let fs, path, os;

/**
 * Initialize the module with plugin context
 */
export function init(ctx) {
  pluginContext = ctx;
}

/**
 * Register the G-code translation event handler
 */
export function registerHandler(ctx) {
  ctx.registerEventHandler('onGcodeProgramLoad', async (content, context) => {
    const settings = ctx.getSettings();
    
    // Check if translation is enabled (default to true)
    const enableTranslation = settings.enableToolNumberTranslation !== undefined ? settings.enableToolNumberTranslation : true;
    
    ctx.log(`Tool number translation enabled: ${enableTranslation}`);
    
    if (!enableTranslation) {
      ctx.log('Tool number translation is disabled - loading original G-code');
      return content;
    }
    
    ctx.log('Fusion 360 Tool Translator: Analyzing G-code...');
    
    // Load tool library and manual mappings
    const toolLibrary = await loadToolLibrary();
    const manualMappings = settings.manualToolMappings || {};
    ctx.log('Initial manual mappings:', JSON.stringify(manualMappings));
    
    // Parse G-code and find all tool changes
    const lines = content.split('\n');
    const toolChanges = parseToolChanges(lines, toolLibrary, manualMappings);
    
    // No tool changes found - skip silently
    if (toolChanges.allTools.length === 0) {
      ctx.log('No tool changes found in G-code');
      return content;
    }
    
    // Check status and show dialog
    const status = determineStatus(toolChanges);
    
    ctx.log('Showing dialog to user...');
    
    // Show status dialog with options (loop for refresh on mapping changes)
    let userChoice;
    let currentToolChanges = toolChanges;
    let currentStatus = status;
    let currentToolLibrary = toolLibrary;
    
    while (true) {
      userChoice = await showStatusDialog(context.filename, currentToolChanges, currentStatus, settings, content, lines, currentToolLibrary);
      
      ctx.log(`User choice received: "${userChoice}" (type: ${typeof userChoice})`);
      
      if (userChoice === 'refresh') {
        // Reload tool library AND settings to get fresh data after changes
        ctx.log('Reloading tool library and mappings...');
        currentToolLibrary = await loadToolLibrary();
        const updatedSettings = ctx.getSettings();
        const updatedManualMappings = updatedSettings.manualToolMappings || {};
        ctx.log('Manual mappings loaded:', JSON.stringify(updatedManualMappings));
        currentToolChanges = parseToolChanges(lines, currentToolLibrary, updatedManualMappings);
        currentStatus = determineStatus(currentToolChanges);
        ctx.log(`Status after refresh: ${currentStatus}, InMagazine: ${currentToolChanges.inMagazine.length}, NotInMagazine: ${currentToolChanges.notInMagazine.length}, Unknown: ${currentToolChanges.unknownTools.length}`);
        continue; // Show dialog again with updated data
      }
      
      break; // User chose bypass or map
    }
    
    if (userChoice === 'bypass') {
      ctx.log('Tool mapping bypassed - loading original G-code');
      return content;
    }
    
    // userChoice === 'map' - sync tool library with mappings and perform translation
    ctx.log('Syncing tool library with mappings...');
    await syncToolLibraryWithMappings(currentToolChanges, ctx);
    
    ctx.log('Starting tool translation...');
    const translatedContent = performTranslation(lines, currentToolChanges, settings, ctx);
    
    return translatedContent;
  });
}

/**
 * Parse tool changes from G-code lines
 */
function parseToolChanges(lines, toolLibrary, manualMappings = {}) {
  const allTools = [];
  const inLibrary = [];
  const inMagazine = [];
  const notInMagazine = [];
  const unknownTools = [];
  
  const seenTools = new Set();
  
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    
    const trimmed = line.trim();
    if (trimmed.startsWith('(') || trimmed.startsWith(';')) return;
    
    if (/M0?6/i.test(line)) {
      const toolMatch = line.match(/T(\d+)/i);
      if (toolMatch) {
        const toolNumber = parseInt(toolMatch[1], 10);
        
        if (seenTools.has(toolNumber)) return;
        seenTools.add(toolNumber);
        
        // Check for manual mapping first
        const hasManualMapping = manualMappings.hasOwnProperty(toolNumber);
        const manualPocketNumber = manualMappings[toolNumber];
        
        const toolInfo = toolLibrary[toolNumber];
        const toolData = {
          line: index + 1,
          toolNumber: toolNumber,
          toolInfo: toolInfo,
          manualMapping: hasManualMapping
        };
        
        allTools.push(toolData);
        
        // If manually mapped, use the manual mapping (even if null)
        if (hasManualMapping) {
          if (manualPocketNumber !== null) {
            pluginContext.log(`[Parse] T${toolNumber} manually mapped to pocket ${manualPocketNumber}`);
            toolData.pocketNumber = manualPocketNumber;
            inMagazine.push(toolData);
          } else {
            pluginContext.log(`[Parse] T${toolNumber} manually set to not in magazine`);
            if (toolInfo) {
              inLibrary.push(toolData);
            }
            notInMagazine.push(toolData);
          }
        } else if (toolInfo) {
          inLibrary.push(toolData);
          
          if (toolInfo.toolNumber !== null && toolInfo.toolNumber !== undefined) {
            toolData.pocketNumber = toolInfo.toolNumber;
            inMagazine.push(toolData);
          } else {
            notInMagazine.push(toolData);
          }
        } else {
          unknownTools.push(toolData);
        }
      }
    }
  });
  
  return {
    allTools,
    inLibrary,
    inMagazine,
    notInMagazine,
    unknownTools
  };
}

/**
 * Determine overall status: red, yellow, or green
 */
function determineStatus(toolChanges) {
  if (toolChanges.unknownTools.length > 0) {
    return 'red'; // Tools not in library at all
  }
  if (toolChanges.notInMagazine.length > 0) {
    return 'yellow'; // Tools exist but not in ATC
  }
  return 'green'; // All tools in ATC
}


/**
 * Load magazine size from ncSender settings
 */
async function getMagazineSize() {
  try {
    // Dynamically import Node.js modules if not already loaded
    if (!fs) {
      const modules = await import('fs');
      fs = modules.default;
      const pathModule = await import('path');
      path = pathModule.default;
      const osModule = await import('os');
      os = osModule.default;
    }
    
    const homeDir = os.homedir();
    const dataDir = path.join(homeDir, 'Library', 'Application Support', 'ncSender');
    const settingsPath = path.join(dataDir, 'settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      pluginContext.log('Settings file does not exist, using default magazine size');
      return 8; // Default
    }
    
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsData);
    
    const magazineSize = settings?.tool?.count || 8;
    pluginContext.log(`Magazine size from settings: ${magazineSize}`);
    return magazineSize;
  } catch (error) {
    pluginContext.log('Error loading magazine size:', error.message);
    return 8; // Default fallback
  }
}

/**
 * Get available ATC pockets
 */
function getAvailablePockets(maxPocketCount) {
  const pockets = [];
  
  for (let i = 1; i <= maxPocketCount; i++) {
    pockets.push({ number: i });
  }
  
  return pockets;
}

/**
 * Show status dialog with Red/Yellow/Green indicators
 */
async function showStatusDialog(filename, toolChanges, status, settings, content, lines, toolLibrary) {
    const magazineSize = await getMagazineSize();
    const availablePockets = getAvailablePockets(magazineSize);
    
    const statusConfig = {
      red: {
        color: '#dc3545',
        bgColor: 'rgba(220, 53, 69, 0.1)',
        icon: '🔴',
        title: 'Tools Not Found in Library',
        message: `${toolChanges.unknownTools.length} tool(s) are not in your ncSender library. If you proceed with "Map Tools", tools that exist will be mapped - unknown tools will remain as-is.`
      },
      yellow: {
        color: '#ffc107',
        bgColor: 'rgba(255, 193, 7, 0.1)',
        icon: '🟡',
        title: 'Manual Tool Changes Required',
        message: `${toolChanges.notInMagazine.length} tool(s) are in ncSender library but not in magazine. These will require manual tool changes.`
      },
      green: {
        color: '#28a745',
        bgColor: 'rgba(40, 167, 69, 0.1)',
        icon: '🟢',
        title: 'All Tools Ready for ATC',
        message: 'All tools are in ncSender library and assigned to ATC magazine. Original tool numbers will be mapped to ncSender tools.'
      }
    };
    
    const config = statusConfig[status];
    
    const html = `
      <style>
        .status-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          color: var(--color-text-primary, #e0e0e0);
          padding: 20px;
          max-width: 700px;
          margin: 0 auto;
        }
        
        .status-header {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .status-header h2 {
          margin: 0 0 8px 0;
          font-size: 1.3rem;
        }
        
        .status-filename {
          color: var(--color-text-secondary);
          font-size: 0.9rem;
          word-break: break-all;
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 1.1rem;
          font-weight: 600;
          margin: 16px 0;
          background: ${config.bgColor};
          border: 2px solid ${config.color};
          color: ${config.color};
        }
        
        .status-message {
          background: var(--color-surface-muted, #1a1a1a);
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        
        .status-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        
        .stat-box {
          background: var(--color-surface-muted, #1a1a1a);
          padding: 12px;
          border-radius: 6px;
          text-align: center;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .stat-value.green { color: #28a745; }
        .stat-value.yellow { color: #ffc107; }
        .stat-value.red { color: #dc3545; }
        .stat-value.blue { color: #17a2b8; }
        
        .stat-label {
          font-size: 0.7rem;
          color: var(--color-text-secondary);
          text-transform: uppercase;
        }
        
        .tool-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 250px;
          overflow-y: auto;
          margin-bottom: 20px;
        }
        
        .tool-item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: var(--color-surface, #0a0a0a);
          border-radius: 6px;
          border-left: 3px solid;
        }
        
        .tool-item.green { border-left-color: #28a745; }
        .tool-item.yellow { border-left-color: #ffc107; }
        .tool-item.red { border-left-color: #dc3545; }
        
        .tool-number {
          font-family: monospace;
          font-weight: 600;
        }
        
        .tool-name {
          font-size: 0.9rem;
        }
        
        .tool-badge {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .tool-badge.green {
          background: rgba(40, 167, 69, 0.2);
          color: #28a745;
        }
        
        .tool-badge.yellow {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
        }
        
        .tool-badge.red {
          background: rgba(220, 53, 69, 0.2);
          color: #dc3545;
        }
        
        .tool-map-btn {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          background: transparent !important;
          color: var(--color-text-primary, #e0e0e0) !important;
          border: 1.5px solid var(--color-accent, #1abc9c) !important;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .tool-map-btn.mapped {
          border-color: #28a745 !important;
          color: var(--color-text-primary, #e0e0e0) !important;
        }
        
        .tool-map-btn:hover {
          opacity: 0.7;
          background: rgba(26, 188, 156, 0.1) !important;
        }
        
        .tool-map-btn.mapped:hover {
          background: rgba(40, 167, 69, 0.1) !important;
        }
        
        .mapping-modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 1000;
          align-items: center;
          justify-content: center;
        }
        
        .mapping-modal.show {
          display: flex;
        }
        
        .mapping-modal-content {
          background: var(--color-surface, #2a2a2a);
          border-radius: 8px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        
        .mapping-modal-content h3 {
          margin: 0 0 16px 0;
          font-size: 1.1rem;
          color: var(--color-text-primary, #e0e0e0);
        }
        
        .mapping-modal-content label {
          display: block;
          margin-bottom: 8px;
          font-size: 0.9rem;
          color: var(--color-text-secondary, #aaa);
        }
        
        .pocket-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--color-border, #444);
          border-radius: 4px;
          background: var(--color-surface-muted, #1a1a1a);
          color: var(--color-text-primary, #e0e0e0);
          font-size: 0.95rem;
          margin-bottom: 20px;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .pocket-select:focus {
          outline: none;
          border-color: var(--color-accent, #1abc9c);
        }
        
        .pocket-select option {
          padding: 8px;
        }
        
        .mapping-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        
        .mapping-modal-actions button {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        
        .mapping-modal-actions button:hover {
          opacity: 0.8;
        }
        
        .mapping-modal-actions .cancel-btn {
          background: var(--color-surface-muted, #444);
          color: var(--color-text-primary, #e0e0e0);
        }
        
        .mapping-modal-actions .confirm-btn {
          background: var(--color-accent, #1abc9c);
          color: white;
        }
        
        .actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 20px;
        }
        
        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-primary {
          background: var(--color-accent, #1abc9c);
          color: white;
        }
        
        .btn-primary:hover {
          opacity: 0.9;
        }
        
        .btn-secondary {
          background: var(--color-surface-muted, #2a2a2a);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border, #444);
        }
        
        .btn-secondary:hover {
          background: var(--color-border, #444);
        }
        
        .btn-success {
          background: #28a745;
          color: white;
        }
        
        .btn-warning {
          background: #ffc107;
          color: #000;
        }
      </style>
      
      <div class="status-container">
        <div class="status-header">
          <div class="status-filename">${filename || 'G-Code File'}</div>
          <div class="status-badge">
            <span>${config.icon}</span>
            <span>${config.title}</span>
          </div>
        </div>
        
        <div class="status-message">${config.message}</div>
        
        <div class="status-stats">
          <div class="stat-box">
            <div class="stat-value blue">${toolChanges.allTools.length}</div>
            <div class="stat-label">Total Tools</div>
          </div>
          <div class="stat-box">
            <div class="stat-value green">${toolChanges.inMagazine.length}</div>
            <div class="stat-label">In ATC</div>
          </div>
          <div class="stat-box">
            <div class="stat-value yellow">${toolChanges.notInMagazine.length}</div>
            <div class="stat-label">Manual</div>
          </div>
          <div class="stat-box">
            <div class="stat-value red">${toolChanges.unknownTools.length}</div>
            <div class="stat-label">Unknown</div>
          </div>
        </div>
        
        <div class="tool-list">
          ${toolChanges.inMagazine.map(t => `
            <div class="tool-item green">
              <div class="tool-number">T${t.toolNumber}</div>
              <div class="tool-name">${t.toolInfo ? t.toolInfo.name : `Tool ${t.toolNumber}`}</div>
              <button class="tool-map-btn mapped" data-tool="${t.toolNumber}" data-current-pocket="${t.pocketNumber}">→ T${t.pocketNumber}</button>
            </div>
          `).join('')}
          ${toolChanges.notInMagazine.map(t => `
            <div class="tool-item yellow">
              <div class="tool-number">T${t.toolNumber}</div>
              <div class="tool-name">${t.toolInfo ? t.toolInfo.name : `Tool ${t.toolNumber}`}</div>
              <button class="tool-map-btn ${t.manualMapping ? 'mapped' : ''}" data-tool="${t.toolNumber}" data-current-pocket="">${t.manualMapping ? 'Manual' : 'Map'}</button>
            </div>
          `).join('')}
          ${toolChanges.unknownTools.map(t => `
            <div class="tool-item red">
              <div class="tool-number">T${t.toolNumber}</div>
              <div class="tool-name">Unknown Tool</div>
              <button class="tool-map-btn" data-tool="${t.toolNumber}" data-current-pocket="">Map</button>
            </div>
          `).join('')}
        </div>
        
        <div class="actions">
          <button id="bypassBtn" class="btn btn-secondary">Bypass Mapping</button>
          <button id="mapBtn" class="btn ${status === 'green' ? 'btn-success' : (status === 'yellow' ? 'btn-warning' : 'btn-primary')}">
            Map Tools
          </button>
        </div>
      </div>
      
      <!-- Custom mapping modal -->
      <div id="mappingModal" class="mapping-modal">
        <div class="mapping-modal-content">
          <h3 id="mappingModalTitle">Map Tool</h3>
          <label for="pocketSelect">Select target ATC pocket:</label>
          <select id="pocketSelect" class="pocket-select">
            <option value="">None (Not in magazine)</option>
            ${availablePockets.map(pocket => `
              <option value="${pocket.number}">T${pocket.number}</option>
            `).join('')}
          </select>
          <div class="mapping-modal-actions">
            <button class="cancel-btn" id="modalCancelBtn">Cancel</button>
            <button class="confirm-btn" id="modalConfirmBtn">Confirm</button>
          </div>
        </div>
      </div>
      
      <script>
        (function() {
          const pluginId = 'com.ncsender.fusion360-import';
          const mappingModal = document.getElementById('mappingModal');
          const modalTitle = document.getElementById('mappingModalTitle');
          const pocketSelect = document.getElementById('pocketSelect');
          const modalCancelBtn = document.getElementById('modalCancelBtn');
          const modalConfirmBtn = document.getElementById('modalConfirmBtn');
          
          let currentToolNumber = null;
          let currentToolInfo = null;
          
          // Show custom modal
          function showMappingModal(toolNumber, toolInfo, currentPocket) {
            currentToolNumber = toolNumber;
            currentToolInfo = toolInfo;
            
            const isRemapping = currentPocket && currentPocket !== '';
            modalTitle.textContent = isRemapping 
              ? \`Remap Fusion Tool T\${toolNumber} (currently T\${currentPocket})\`
              : \`Map Fusion Tool T\${toolNumber}\`;
            
            // Pre-select current pocket or default to empty (None)
            pocketSelect.value = currentPocket || '';
            
            mappingModal.classList.add('show');
            setTimeout(() => pocketSelect.focus(), 100);
          }
          
          // Hide modal
          function hideMappingModal() {
            mappingModal.classList.remove('show');
            currentToolNumber = null;
            currentToolInfo = null;
          }
          
          // Handle Enter key in select
          pocketSelect.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              modalConfirmBtn.click();
            }
          });
          
          // Handle Escape key
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mappingModal.classList.contains('show')) {
              hideMappingModal();
            }
          });
          
          // Modal cancel button
          modalCancelBtn.addEventListener('click', () => {
            hideMappingModal();
          });
          
          // Modal confirm button
          modalConfirmBtn.addEventListener('click', async () => {
            const selectedValue = pocketSelect.value;
            
            // Capture data BEFORE hiding modal
            const toolNumberToMap = currentToolNumber;
            const toolInfo = currentToolInfo;
            
            // Handle "None (Not in magazine)" selection
            const pocketNumber = selectedValue === '' ? null : parseInt(selectedValue, 10);
            console.log(\`[Mapping] Confirm clicked: T\${toolNumberToMap} → \${pocketNumber === null ? 'None' : 'T' + pocketNumber}\`);
            
            hideMappingModal();
            
            try {
              // 1. Load current settings
              console.log('[Mapping] Loading current settings...');
              const response = await fetch('/api/plugins/' + pluginId + '/settings');
              const settings = response.ok ? await response.json() : {};
              console.log('[Mapping] Current settings:', settings);
              
              // 2. Update manual mappings in plugin settings
              const manualMappings = settings.manualToolMappings || {};
              
              // Clean up any invalid keys
              if (manualMappings.hasOwnProperty('null')) delete manualMappings['null'];
              if (manualMappings.hasOwnProperty(null)) delete manualMappings[null];
              
              // Set the mapping (null means explicitly "not in magazine")
              manualMappings[toolNumberToMap] = pocketNumber;
              console.log(\`[Mapping] Set manual mapping for tool \${toolNumberToMap} to \${pocketNumber === null ? 'None' : pocketNumber}\`);
              console.log('[Mapping] Updated mappings:', manualMappings);
              
              // 3. Save plugin settings
              console.log('[Mapping] Saving plugin settings...');
              const saveResponse = await fetch('/api/plugins/' + pluginId + '/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ manualToolMappings: manualMappings })
              });
              console.log('[Mapping] Plugin settings save response:', saveResponse.status);
              
              if (!saveResponse.ok) {
                const errorText = await saveResponse.text();
                throw new Error(\`Failed to save plugin settings: HTTP \${saveResponse.status}: \${errorText}\`);
              }
              
              console.log('[Mapping] Manual mapping saved (library will sync when "Map Tools" is clicked)');
              
            } catch (error) {
              console.error('[Mapping] Error:', error);
              alert('Failed to save mapping: ' + error.message);
            } finally {
              // Always refresh the dialog (even if there was an error)
              // Add a small delay to ensure file system writes are complete
              console.log('[Mapping] Refreshing dialog...');
              setTimeout(() => {
                window.parent.postMessage({ 
                  type: 'close-plugin-dialog',
                  data: { action: 'refresh' }
                }, '*');
              }, 150);
            }
          });
          
          document.getElementById('bypassBtn').addEventListener('click', () => {
            window.parent.postMessage({ 
              type: 'close-plugin-dialog',
              data: { action: 'bypass' }
            }, '*');
          });
          
          document.getElementById('mapBtn').addEventListener('click', () => {
            window.parent.postMessage({ 
              type: 'close-plugin-dialog',
              data: { action: 'map' }
            }, '*');
          });
          
          // Store tool info as JSON in data attributes (ALL tools, not just unmapped)
          const toolDataMap = ${JSON.stringify(Object.fromEntries(
            toolChanges.allTools.map(t => [
              t.toolNumber,
              t.toolInfo || null
            ])
          ))};
          
          // Handle Map button clicks
          document.querySelectorAll('.tool-map-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const fusionToolNumber = parseInt(e.target.getAttribute('data-tool'), 10);
              const currentPocket = e.target.getAttribute('data-current-pocket');
              const toolInfo = toolDataMap[fusionToolNumber];
              showMappingModal(fusionToolNumber, toolInfo, currentPocket);
            });
          });
        })();
      </script>
    `;
    
    pluginContext.log('Calling showDialog...');
    const response = await pluginContext.showDialog('Fusion 360 Tool Importer Plugin (Tool Mapping Summary)', html, {
      closable: false
    });
    
    pluginContext.log(`Dialog resolved with response:`, JSON.stringify(response));
    
    // Extract action from response (default to 'bypass' if no response)
    if (response && response.action) {
      pluginContext.log(`Returning action: ${response.action}`);
      return response.action;
    }
    
    pluginContext.log('No action in response, defaulting to bypass');
    return 'bypass';
}

/**
 * Sync tool library with current mappings before translation
 */
async function syncToolLibraryWithMappings(toolChanges, ctx) {
  try {
    // Dynamically import Node.js modules if needed
    if (!fs) {
      const modules = await import('fs');
      fs = modules.default;
      const pathModule = await import('path');
      path = pathModule.default;
      const osModule = await import('os');
      os = osModule.default;
    }
    
    const homeDir = os.homedir();
    const dataDir = path.join(homeDir, 'Library', 'Application Support', 'ncSender');
    const toolsPath = path.join(dataDir, 'tools.json');
    
    if (!fs.existsSync(toolsPath)) {
      ctx.log('Tools file does not exist, skipping library sync');
      return;
    }
    
    // Load current library
    const toolsData = fs.readFileSync(toolsPath, 'utf8');
    const allTools = JSON.parse(toolsData);
    
    if (!Array.isArray(allTools)) {
      ctx.log('Invalid tools data, skipping library sync');
      return;
    }
    
    // Update tool numbers based on current mappings
    let updateCount = 0;
    
    // Update tools that are in magazine
    toolChanges.inMagazine.forEach(toolData => {
      const toolIndex = allTools.findIndex(t => t.id === toolData.toolNumber);
      if (toolIndex >= 0) {
        const oldPocket = allTools[toolIndex].toolNumber;
        const newPocket = toolData.pocketNumber;
        
        if (oldPocket !== newPocket) {
          allTools[toolIndex].toolNumber = newPocket;
          ctx.log(`  Updated library: T${toolData.toolNumber} → pocket ${newPocket}`);
          updateCount++;
        }
      }
    });
    
    // Update tools that are manually set to not in magazine
    toolChanges.notInMagazine.forEach(toolData => {
      if (toolData.manualMapping) {
        const toolIndex = allTools.findIndex(t => t.id === toolData.toolNumber);
        if (toolIndex >= 0) {
          const oldPocket = allTools[toolIndex].toolNumber;
          
          if (oldPocket !== null) {
            allTools[toolIndex].toolNumber = null;
            ctx.log(`  Updated library: T${toolData.toolNumber} → not in magazine`);
            updateCount++;
          }
        }
      }
    });
    
    if (updateCount > 0) {
      // Save updated library
      fs.writeFileSync(toolsPath, JSON.stringify(allTools, null, 2), 'utf8');
      ctx.log(`✓ Synced ${updateCount} tool(s) in library`);
    } else {
      ctx.log('No library updates needed');
    }
  } catch (error) {
    ctx.log('Error syncing tool library:', error.message);
    // Don't fail the whole operation if library sync fails
  }
}

/**
 * Perform the actual translation
 */
function performTranslation(lines, toolChanges, settings, ctx) {
  const translationMap = {};
  
  // Build translation map from tools in magazine
  toolChanges.inMagazine.forEach(t => {
    translationMap[t.toolNumber] = t.pocketNumber;
  });
  
  let translationCount = 0;
  let commentTranslationCount = 0;
  
  const translatedLines = lines.map((line, index) => {
    if (!line.trim()) return line;
    
    const trimmed = line.trim();
    
    // Handle comments - translate all T## in comments and preserve original
    if (trimmed.startsWith('(') || trimmed.startsWith(';')) {
      const toolMatch = line.match(/T(\d+)/i);
      if (toolMatch) {
        const toolNumber = parseInt(toolMatch[1], 10);
        const pocketNumber = translationMap[toolNumber];
        
        if (pocketNumber !== undefined) {
          // Replace T## with T# [Fusion: tool ##]
          const translatedLine = line.replace(/T(\d+)/i, (match, num) => {
            return `T${pocketNumber} [Fusion: tool ${num}]`;
          });
          commentTranslationCount++;
          return translatedLine;
        }
      }
      return line;
    }
    
    // Handle any line with T## tool command (including M6, standalone T##, etc.)
    let translatedLine = line;
    let wasTranslated = false;
    
    // Translate T## commands
    const toolMatch = line.match(/T(\d+)/i);
    if (toolMatch) {
      const toolNumber = parseInt(toolMatch[1], 10);
      const pocketNumber = translationMap[toolNumber];
      
      if (pocketNumber !== undefined) {
        translatedLine = translatedLine.replace(/T\d+/i, `T${pocketNumber}`);
        wasTranslated = true;
        
        // Only log M6 commands to avoid spam
        if (/M0?6/i.test(line)) {
          ctx.log(`  T${toolNumber} → T${pocketNumber}`);
        }
      }
    }
    
    // Also translate H## height offset commands (G43 H##)
    const heightMatch = translatedLine.match(/H(\d+)/i);
    if (heightMatch) {
      const heightNumber = parseInt(heightMatch[1], 10);
      const pocketNumber = translationMap[heightNumber];
      
      if (pocketNumber !== undefined) {
        translatedLine = translatedLine.replace(/H\d+/i, `H${pocketNumber}`);
        wasTranslated = true;
      }
    }
    
    if (wasTranslated) {
      translationCount++;
      return translatedLine;
    }
    
    return line;
  });
  
  ctx.log(`✓ Translated ${translationCount} tool change(s) and ${commentTranslationCount} comment(s)`);
  
  return translatedLines.join('\n');
}

/**
 * Load tool library from disk
 */
async function loadToolLibrary() {
  try {
    // Dynamically import Node.js modules
    if (!fs) {
      const modules = await import('fs');
      fs = modules.default;
      const pathModule = await import('path');
      path = pathModule.default;
      const osModule = await import('os');
      os = osModule.default;
    }
    
    const homeDir = os.homedir();
    const dataDir = path.join(homeDir, 'Library', 'Application Support', 'ncSender');
    const toolsPath = path.join(dataDir, 'tools.json');
    
    if (!fs.existsSync(toolsPath)) {
      pluginContext.log('Tools file does not exist');
      return {};
    }
    
    const toolsData = fs.readFileSync(toolsPath, 'utf8');
    const tools = JSON.parse(toolsData);
    
    const library = {};
    
    if (!Array.isArray(tools)) {
      return {};
    }
    
    tools.forEach(tool => {
      library[tool.id] = tool;
    });
    
    pluginContext.log(`Loaded ${tools.length} tool(s) from library`);
    return library;
  } catch (error) {
    pluginContext.log('Error loading tool library:', error.message);
    return {};
  }
}

