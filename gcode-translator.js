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
    
    if (!enableTranslation) {
      return content;
    }
    
    ctx.log('Fusion 360 Tool Translator: Analyzing G-code...');
    
    const toolLibrary = await loadToolLibrary();
    
    // Parse G-code and find all tool changes
    const lines = content.split('\n');
    let manualMappings = {}; // Empty - will be populated if user maps tools in dialog
    const toolChanges = parseToolChanges(lines, toolLibrary, manualMappings);
    
    // No tool changes found - skip silently
    if (toolChanges.allTools.length === 0) {
      ctx.log('No tool changes found in G-code');
      return content;
    }
    
    const status = determineStatus(toolChanges);
    
    // Show status dialog (loop for refresh on mapping changes)
    let userChoice;
    let currentToolChanges = toolChanges;
    let currentStatus = status;
    let currentToolLibrary = toolLibrary;
    
    while (true) {
      userChoice = await showStatusDialog(context.filename, currentToolChanges, currentStatus, settings, content, lines, currentToolLibrary, manualMappings);
      
      // Handle object response with action and sessionMappings
      const action = typeof userChoice === 'string' ? userChoice : userChoice?.action;
      
      if (action === 'refresh') {
        currentToolLibrary = await loadToolLibrary();
        
        if (userChoice.sessionMappings !== undefined) {
          manualMappings = userChoice.sessionMappings;
        }
        
        currentToolChanges = parseToolChanges(lines, currentToolLibrary, manualMappings);
        currentStatus = determineStatus(currentToolChanges);
        continue;
      }
      
      break;
    }
    
    const action = typeof userChoice === 'string' ? userChoice : userChoice?.action;
    
    if (action === 'bypass') {
      ctx.log('Tool mapping bypassed - loading original G-code');
      return content;
    }
    
    // userChoice === 'map' - perform translation with current tool library state
    // (no sync needed - library was already updated by individual mapping clicks)
    ctx.log('Starting tool translation...');
    const translatedContent = performTranslation(lines, currentToolChanges, settings, ctx);
    
    return translatedContent;
  });
}

/**
 * M6 Pattern - matches M6 tool change commands (same as ncSender core)
 * 
 * Matches:
 * - M6 T1, M6 T01, M06 T1 (with spaces)
 * - M6T1, M06T1 (no space)
 * - T1 M6, T1 M06 (T before M6)
 * 
 * Does NOT match:
 * - M60, M61, M600 (other M-codes)
 */
const M6_PATTERN = /(?:^|[^A-Z])M0*6(?:\s*T0*(\d+)|(?=[^0-9T])|$)|(?:^|[^A-Z])T0*(\d+)\s*M0*6(?:[^0-9]|$)/i;

/**
 * Parse tool changes from G-code lines using ncSender's official M6 pattern
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
    
    // Skip comments (semicolon or parenthetical)
    if (trimmed.startsWith(';')) return;
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) return;

    // Match M6 command using ncSender's official pattern
    const match = trimmed.match(M6_PATTERN);
    if (match) {
      // Extract tool number from either capture group
      const toolNumberStr = match[1] || match[2];
      if (toolNumberStr) {
        const toolNumber = parseInt(toolNumberStr, 10);
        
        if (seenTools.has(toolNumber)) return;
        seenTools.add(toolNumber);
        
        // Check for manual mapping first (use string key for consistency)
        const toolNumberKey = String(toolNumber);
        const hasManualMapping = manualMappings.hasOwnProperty(toolNumberKey);
        const manualPocketNumber = manualMappings[toolNumberKey];
        
        const toolInfo = toolLibrary[toolNumber];
        pluginContext.log(`[Parse] G-code T${toolNumber}: toolInfo=${toolInfo ? 'found' : 'NOT FOUND'}, hasManual=${hasManualMapping}`);
        const toolData = {
          line: index + 1,
          toolNumber: toolNumber,
          toolInfo: toolInfo,
          manualMapping: hasManualMapping
        };
        
        allTools.push(toolData);
        
        // If manually mapped, use the manual mapping (even if -1 for "not in magazine")
        if (hasManualMapping) {
          if (manualPocketNumber !== -1) {
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
async function showStatusDialog(filename, toolChanges, status, settings, content, lines, toolLibrary, sessionMappings) {
    const magazineSize = await getMagazineSize();
    const availablePockets = getAvailablePockets(magazineSize);
    
    // Build slot state: which slots are filled and which tools are used in G-code
    const usedToolNumbers = new Set(toolChanges.allTools.map(t => t.toolNumber));
    const slotState = [];
    for (let i = 1; i <= magazineSize; i++) {
      // Check for tool in library
      let toolInSlot = Object.values(toolLibrary).find(t => t.toolNumber === i);
      
      // Also check for session-mapped unknown tools
      if (!toolInSlot) {
        const unknownToolNumber = Object.keys(sessionMappings).find(key => sessionMappings[key] === i);
        if (unknownToolNumber) {
          toolInSlot = { toolId: unknownToolNumber, toolNumber: i, isTemporary: true };
        }
      }
      
      slotState.push({
        slotNumber: i,
        tool: toolInSlot || null,
        isUsed: toolInSlot && (usedToolNumbers.has(toolInSlot.toolId) || usedToolNumbers.has(parseInt(toolInSlot.toolId)))
      });
    }
    
    // Combine all tools for table display
    const allToolsForTable = [
      ...toolChanges.inMagazine.map(t => ({ ...t, statusClass: 'green', statusLabel: 'Ready' })),
      ...toolChanges.notInMagazine.map(t => ({ ...t, statusClass: 'yellow', statusLabel: 'No Slot' })),
      ...toolChanges.unknownTools.map(t => ({ ...t, statusClass: 'red', statusLabel: 'Unknown' }))
    ];
    
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
        message: `${toolChanges.notInMagazine.length} tool(s) are in ncSender library but not assigned to slots. These will require manual tool changes.`
      },
      green: {
        color: '#28a745',
        bgColor: 'rgba(40, 167, 69, 0.1)',
        icon: '🟢',
        title: 'All Tools Ready for ATC',
        message: 'All tools are in ncSender library and assigned to slots. Original tool numbers will be mapped to ncSender slots.'
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
        
        /* Slot Carousel */
        .slot-carousel-section {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 16px;
          background: var(--color-surface-muted, #1a1a1a);
          border-radius: 8px;
          margin-bottom: 16px;
          overflow-x: auto;
        }
        
        .slot-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 60px;
          height: 60px;
          background: var(--color-surface, #0a0a0a);
          border: 2px solid var(--color-border, #444);
          border-radius: 6px;
          overflow: hidden;
          flex-shrink: 0;
        }
        
        .slot-box--used {
          background: var(--color-accent, #1abc9c);
          border-color: var(--color-accent, #1abc9c);
        }
        
        .slot-box--unused {
          background: var(--color-surface-muted, #2a2a2a);
          border-color: var(--color-border, #444);
          opacity: 0.5;
        }
        
        .slot-box-content {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          width: 100%;
          padding: 0 8px;
        }
        
        .slot-tool-id {
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
        }
        
        .slot-empty {
          font-size: 1.2rem;
          color: var(--color-text-secondary, #666);
        }
        
        .slot-box-label {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-secondary, #999);
          background: var(--color-surface-muted, #1a1a1a);
          width: 100%;
          text-align: center;
          padding: 3px 0;
          letter-spacing: 0.03em;
        }
        
        .slot-box--used .slot-box-label {
          background: color-mix(in srgb, var(--color-accent, #1abc9c) 80%, #000);
          color: rgba(255, 255, 255, 0.95);
        }
        
        /* Tools Table */
        .tools-table-container {
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid var(--color-border, #444);
          border-radius: 8px;
          margin-bottom: 16px;
        }
        
        .tools-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .tools-table thead {
          position: sticky;
          top: 0;
          background: var(--color-surface-muted, #1a1a1a);
          z-index: 10;
        }
        
        .tools-table th {
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid var(--color-border, #444);
          font-size: 0.85rem;
        }
        
        .tools-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--color-border, #333);
        }
        
        .tools-table tbody tr:hover {
          background: var(--color-border, #2a2a2a);
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          border: 1px solid transparent;
        }
        
        .status-badge--green {
          background: rgba(40, 167, 69, 0.2);
          color: #28a745;
          border-color: #28a745;
        }
        
        .status-badge--yellow {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
          border-color: #ffc107;
        }
        
        .status-badge--red {
          background: rgba(220, 53, 69, 0.2);
          color: #dc3545;
          border-color: #dc3545;
        }
        
        .tool-list {
          display: none;
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
        
        .tool-id-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
          justify-content: center;
          min-width: 80px;
        }
        
        .tool-id-text {
          font-size: 1rem;
          font-weight: 600;
        }
        
        .tool-number-badge {
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
        
        .tool-slot-placeholder {
          font-size: 0.65rem;
          color: var(--color-text-secondary);
          opacity: 0.6;
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
        
        .tool-map-btn.manual {
          border-color: #ffc107 !important;
          color: var(--color-text-primary, #e0e0e0) !important;
        }
        
        .tool-map-btn.manual:hover {
          background: rgba(255, 193, 7, 0.1) !important;
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
        
        /* Slot Selector Popup */
        .slot-selector-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99998;
          display: none;
        }
        
        .slot-selector-overlay.show {
          display: block;
        }
        
        .slot-selector-popup {
          position: fixed;
          background: var(--color-surface, #2a2a2a);
          border: 1px solid var(--color-border, #444);
          border-radius: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          min-width: 200px;
          max-height: 300px;
          display: flex;
          flex-direction: column;
          z-index: 99999;
        }
        
        .slot-selector-header {
          padding: 10px 12px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-text-secondary, #999);
          border-bottom: 1px solid var(--color-border, #444);
          flex-shrink: 0;
        }
        
        .slot-selector-list {
          overflow-y: auto;
          flex: 1;
        }
        
        .slot-selector-item {
          padding: 8px 12px;
          font-size: 0.85rem;
          color: var(--color-text-primary, #e0e0e0);
          cursor: pointer;
          transition: background 0.1s ease;
        }
        
        .slot-selector-item:hover {
          background: var(--color-surface-muted, #1a1a1a);
        }
        
        .slot-selector-item--active {
          background: var(--color-accent, #1abc9c);
          color: white;
        }
        
        .slot-selector-item--active:hover {
          background: var(--color-accent, #1abc9c);
        }
        
        .slot-selector-item--occupied {
          color: #f59e0b;
        }
        
        .tool-id-cell {
          cursor: pointer;
          user-select: none;
        }
        
        .tool-id-cell:hover {
          opacity: 0.8;
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
        
        <!-- Slot Carousel -->
        <div class="slot-carousel-section">
          ${slotState.map(slot => `
            <div class="slot-box ${slot.tool ? (slot.isUsed ? 'slot-box--used' : 'slot-box--unused') : ''}">
              <div class="slot-box-content">
                ${slot.tool ? `<span class="slot-tool-id">#${slot.tool.toolId}</span>` : `<span class="slot-empty">—</span>`}
              </div>
              <div class="slot-box-label">SLOT${slot.slotNumber}</div>
            </div>
          `).join('')}
        </div>
        
        <!-- Tools Table -->
        <div class="tools-table-container">
          <table class="tools-table">
            <thead>
              <tr>
                <th>Tool ID</th>
                <th>Description</th>
                <th>Type</th>
                <th>Diameter</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${allToolsForTable.map(t => {
                const slotBadge = t.pocketNumber !== null && t.pocketNumber !== undefined
                  ? `<span class="tool-number-badge">Slot${t.pocketNumber}</span>`
                  : `<span class="tool-slot-placeholder">No Slot</span>`;
                
                return `
                  <tr class="tool-row tool-row--${t.statusClass}">
                    <td>
                      <div class="tool-id-cell">
                        <span class="tool-id-text">${t.toolNumber}</span>
                        ${slotBadge}
                      </div>
                    </td>
                    <td>${t.toolInfo ? t.toolInfo.name : `Tool ${t.toolNumber}`}</td>
                    <td>${t.toolInfo ? t.toolInfo.type : '-'}</td>
                    <td>${t.toolInfo ? t.toolInfo.diameter.toFixed(2) + ' mm' : '-'}</td>
                    <td><span class="status-badge status-badge--${t.statusClass}">${t.statusLabel}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="actions">
          <button id="bypassBtn" class="btn btn-secondary">Bypass Mapping</button>
          <button id="mapBtn" class="btn ${status === 'green' ? 'btn-success' : (status === 'yellow' ? 'btn-warning' : 'btn-primary')}">
            Map Tools
          </button>
        </div>
      </div>
      
      <!-- Slot Selector Popup -->
      <div id="slotSelectorOverlay" class="slot-selector-overlay">
        <div id="slotSelectorPopup" class="slot-selector-popup">
          <div class="slot-selector-header">Assign to Slot</div>
          <div class="slot-selector-list" id="slotSelectorList">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>

      <script>
        (function() {
          // Session mappings for tools not in library (temporary, won't persist)
          const sessionMappings = ${JSON.stringify(sessionMappings || {})};
          
          // Tool data and slot state
          const allToolsData = ${JSON.stringify(allToolsForTable)};
          const magazineSize = ${magazineSize};
          const toolLibrary = ${JSON.stringify(Object.fromEntries(
            Object.values(toolLibrary).map(t => [t.toolId, t])
          ))};
          
          let currentTool = null;
          const overlay = document.getElementById('slotSelectorOverlay');
          const popup = document.getElementById('slotSelectorPopup');
          const listContainer = document.getElementById('slotSelectorList');
          
          // Show slot selector
          function showSlotSelector(toolData, event) {
            currentTool = toolData;
            
            // Build slot list
            let html = \`
              <div class="slot-selector-item \${toolData.pocketNumber === null ? 'slot-selector-item--active' : ''}" data-slot="">
                None (Not in magazine)
              </div>
            \`;
            
            for (let i = 1; i <= magazineSize; i++) {
              // Check for library tool in this slot
              const toolInSlot = Object.values(toolLibrary).find(t => t.toolNumber === i);
              
              // Check for unknown tool (session mapping) in this slot
              const unknownToolInSlot = Object.keys(sessionMappings).find(key => sessionMappings[key] === i);
              
              const isOccupied = (toolInSlot && toolInSlot.toolId !== toolData.toolNumber) || 
                                 (unknownToolInSlot && parseInt(unknownToolInSlot) !== toolData.toolNumber);
              const isActive = toolData.pocketNumber === i;
              
              let occupiedInfo = '';
              if (toolInSlot && toolInSlot.toolId !== toolData.toolNumber) {
                occupiedInfo = \` (Swap with #\${toolInSlot.toolId})\`;
              } else if (unknownToolInSlot && parseInt(unknownToolInSlot) !== toolData.toolNumber) {
                occupiedInfo = \` (Swap with T\${unknownToolInSlot})\`;
              }
              
              html += \`
                <div class="slot-selector-item \${isActive ? 'slot-selector-item--active' : ''} \${isOccupied ? 'slot-selector-item--occupied' : ''}" data-slot="\${i}">
                  Slot\${i}\${occupiedInfo}
                </div>
              \`;
            }
            
            listContainer.innerHTML = html;
            
            // Position popup near click
            const rect = event.target.closest('.tool-id-cell').getBoundingClientRect();
            popup.style.top = (rect.bottom + 5) + 'px';
            popup.style.left = rect.left + 'px';
            
            overlay.classList.add('show');
          }
          
          // Close slot selector
          function closeSlotSelector() {
            overlay.classList.remove('show');
            currentTool = null;
          }
          
          // Handle slot selection
          async function selectSlot(slotNumber) {
            if (!currentTool) return;
            
            const toolNumber = currentTool.toolNumber;
            const toolInfo = currentTool.toolInfo;
            const oldSlotNumber = currentTool.pocketNumber;
            
            // If same slot, just close
            if (slotNumber === oldSlotNumber) {
              closeSlotSelector();
              return;
            }
            
            closeSlotSelector();
            
            try {
              if (toolInfo) {
                // Tool in library - update it (persists)
                console.log(\`[Slot] Updating tool #\${toolInfo.toolId} from Slot \${oldSlotNumber || 'none'} → Slot \${slotNumber || 'none'}\`);
                
                // Check if target slot is occupied by another tool (in library OR session mapping)
                const conflictingTool = slotNumber !== null
                  ? Object.values(toolLibrary).find(t => t.toolNumber === slotNumber && t.id !== toolInfo.id)
                  : null;
                
                // Also check if an unknown tool (session mapping) occupies this slot
                const conflictingUnknownToolNumber = slotNumber !== null
                  ? Object.keys(sessionMappings).find(key => sessionMappings[key] === slotNumber)
                  : null;
                
                if (conflictingTool) {
                  // 3-step swap process with library tool (matching ncSender behavior):
                  // Step 1: Unassign conflicting tool temporarily
                  console.log(\`[Slot] Step 1: Unassigning #\${conflictingTool.toolId} from Slot \${slotNumber}\`);
                  await fetch(\`/api/tools/\${conflictingTool.id}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...conflictingTool, toolNumber: null })
                  });
                  
                  // Step 2: Assign current tool to new slot
                  console.log(\`[Slot] Step 2: Assigning #\${toolInfo.toolId} to Slot \${slotNumber}\`);
                  await fetch(\`/api/tools/\${toolInfo.id}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...toolInfo, toolNumber: slotNumber })
                  });
                  
                  // Step 3: Assign conflicting tool to old slot (complete the swap)
                  if (oldSlotNumber !== null) {
                    console.log(\`[Slot] Step 3: Assigning #\${conflictingTool.toolId} to Slot \${oldSlotNumber}\`);
                    await fetch(\`/api/tools/\${conflictingTool.id}\`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...conflictingTool, toolNumber: oldSlotNumber })
                    });
                  }
                } else if (conflictingUnknownToolNumber) {
                  // Swap with unknown tool (session mapping only)
                  console.log(\`[Slot] Swapping with unknown tool T\${conflictingUnknownToolNumber} (session mapping)\`);
                  
                  // Update session mapping for unknown tool (key is already a string from Object.keys)
                  if (oldSlotNumber !== null) {
                    console.log(\`[Slot] Moving unknown tool T\${conflictingUnknownToolNumber} from Slot \${slotNumber} to Slot \${oldSlotNumber}\`);
                    sessionMappings[conflictingUnknownToolNumber] = oldSlotNumber;
                  } else {
                    console.log(\`[Slot] Removing unknown tool T\${conflictingUnknownToolNumber} from Slot \${slotNumber}\`);
                    delete sessionMappings[conflictingUnknownToolNumber];
                  }
                  
                  // Assign current tool to new slot
                  console.log(\`[Slot] Assigning #\${toolInfo.toolId} to Slot \${slotNumber}\`);
                  await fetch(\`/api/tools/\${toolInfo.id}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...toolInfo, toolNumber: slotNumber })
                  });
                } else {
                  // Simple assignment, no swap needed
                  console.log(\`[Slot] Simple assignment: #\${toolInfo.toolId} → Slot \${slotNumber || 'none'}\`);
                  await fetch(\`/api/tools/\${toolInfo.id}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...toolInfo, toolNumber: slotNumber })
                  });
                }
              } else {
                // Tool not in library - temporary mapping (doesn't persist)
                console.log(\`[Slot] Temporary mapping for unknown tool T\${toolNumber} → Slot \${slotNumber || 'none'}\`);
                
                if (slotNumber === null) {
                  // Removing slot assignment for unknown tool
                  console.log(\`[Slot] Removing slot assignment for unknown tool T\${toolNumber}\`);
                  delete sessionMappings[String(toolNumber)];
                } else {
                  // Check if target slot is occupied
                  const conflictingTool = Object.values(toolLibrary).find(t => t.toolNumber === slotNumber);
                  
                  const toolNumberKey = String(toolNumber);
                  const conflictingUnknownToolNumber = Object.keys(sessionMappings).find(key => 
                    sessionMappings[key] === slotNumber && key !== toolNumberKey
                  );
                  
                  if (conflictingTool) {
                    // Swap with library tool
                    console.log(\`[Slot] Swapping unknown tool T\${toolNumber} with library tool #\${conflictingTool.toolId}\`);
                    
                    // Update library tool
                    if (oldSlotNumber !== null) {
                      await fetch(\`/api/tools/\${conflictingTool.id}\`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...conflictingTool, toolNumber: oldSlotNumber })
                      });
                    } else {
                      await fetch(\`/api/tools/\${conflictingTool.id}\`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...conflictingTool, toolNumber: null })
                      });
                    }
                    
                    // Update session mapping (use string key)
                    sessionMappings[toolNumberKey] = slotNumber;
                  } else if (conflictingUnknownToolNumber) {
                    // Swap two unknown tools
                    console.log(\`[Slot] Swapping unknown tools T\${toolNumber} ↔ T\${conflictingUnknownToolNumber}\`);
                    
                    if (oldSlotNumber !== null) {
                      sessionMappings[conflictingUnknownToolNumber] = oldSlotNumber;
                    } else {
                      delete sessionMappings[conflictingUnknownToolNumber];
                    }
                    
                    sessionMappings[toolNumberKey] = slotNumber;
                  } else {
                    // Simple assignment to slot (use string key)
                    sessionMappings[toolNumberKey] = slotNumber;
                  }
                }
              }
              
              // Refresh dialog
              window.parent.postMessage({
                type: 'close-plugin-dialog',
                data: { action: 'refresh', sessionMappings: sessionMappings }
              }, '*');
              
            } catch (error) {
              console.error('[Slot] Error:', error);
              alert('Failed to update slot: ' + error.message);
            }
          }
          
          // Event listeners
          overlay.addEventListener('click', closeSlotSelector);
          
          popup.addEventListener('click', (e) => {
            e.stopPropagation();
          });
          
          // Tool ID cell clicks
          document.querySelectorAll('.tool-id-cell').forEach((cell, index) => {
            cell.addEventListener('click', (e) => {
              showSlotSelector(allToolsData[index], e);
            });
          });
          
          // Slot selector item clicks
          listContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.slot-selector-item');
            if (item) {
              const slotStr = item.getAttribute('data-slot');
              const slotNumber = slotStr === '' ? null : parseInt(slotStr, 10);
              selectSlot(slotNumber);
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
          
        })();
      </script>
    `;
    
    pluginContext.log('Calling showDialog...');
    const response = await pluginContext.showDialog('Fusion 360 Tool Importer Plugin (Tool Mapping Summary)', html, {
      closable: false
    });
    
    pluginContext.log(`Dialog resolved with response:`, JSON.stringify(response));
    
    // Return full response (includes action and sessionMappings)
    if (response && response.action) {
      pluginContext.log(`Returning response with action: ${response.action}`);
      return response;
    }
    
    pluginContext.log('No action in response, defaulting to bypass');
    return { action: 'bypass' };
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
      // Handle migration: use toolId if available, fallback to id for old tools
      const toolIndex = allTools.findIndex(t => {
        const toolId = t.toolId !== undefined ? t.toolId : t.id;
        return toolId === toolData.toolNumber;
      });
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
    
    // Update tools that are manually set to not in magazine (pocket = -1)
    toolChanges.notInMagazine.forEach(toolData => {
      if (toolData.manualMapping) {
        // Handle migration: use toolId if available, fallback to id for old tools
        const toolIndex = allTools.findIndex(t => {
          const toolId = t.toolId !== undefined ? t.toolId : t.id;
          return toolId === toolData.toolNumber;
        });
        if (toolIndex >= 0) {
          const oldPocket = allTools[toolIndex].toolNumber;
          
          // Set to null in library (not -1, since library uses null for "not in magazine")
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
        if (M6_PATTERN.test(line)) {
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
      // Handle migration: if toolId is missing, use id as fallback (for old tools)
      const toolId = tool.toolId !== undefined ? tool.toolId : tool.id;
      if (toolId !== undefined) {
        library[toolId] = tool;
      }
    });
    
    pluginContext.log(`Loaded ${tools.length} tool(s) from library`);
    return library;
  } catch (error) {
    pluginContext.log('Error loading tool library:', error.message);
    return {};
  }
}

