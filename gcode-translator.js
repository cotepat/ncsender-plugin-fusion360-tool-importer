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
    
    // Load tool library
    const toolLibrary = await loadToolLibrary();
    
    // Parse G-code and find all tool changes
    const lines = content.split('\n');
    const toolChanges = parseToolChanges(lines, toolLibrary);
    
    // No tool changes found - skip silently
    if (toolChanges.allTools.length === 0) {
      ctx.log('No tool changes found in G-code');
      return content;
    }
    
    // Check status and show dialog
    const status = determineStatus(toolChanges);
    
    ctx.log('Showing dialog to user...');
    
    // Show status dialog with three options
    const userChoice = await showStatusDialog(context.filename, toolChanges, status, settings);
    
    ctx.log(`User choice received: "${userChoice}" (type: ${typeof userChoice})`);
    
    if (userChoice === 'cancel') {
      ctx.log('Cancelling G-code load');
      throw new Error('G-code loading cancelled by user');
    }
    
    if (userChoice === 'bypass') {
      ctx.log('Tool mapping bypassed - loading original G-code');
      return content;
    }
    
    // userChoice === 'map' - perform translation
    ctx.log('Starting tool translation...');
    const translatedContent = performTranslation(lines, toolChanges, settings, ctx);
    
    return translatedContent;
  });
}

/**
 * Parse tool changes from G-code lines
 */
function parseToolChanges(lines, toolLibrary) {
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
        
        const toolInfo = toolLibrary[toolNumber];
        const toolData = {
          line: index + 1,
          toolNumber: toolNumber,
          toolInfo: toolInfo
        };
        
        allTools.push(toolData);
        
        if (toolInfo) {
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
 * Show status dialog with Red/Yellow/Green indicators
 */
async function showStatusDialog(filename, toolChanges, status, settings) {
    const statusConfig = {
      red: {
        color: '#dc3545',
        bgColor: 'rgba(220, 53, 69, 0.1)',
        icon: '🔴',
        title: 'Tools Not Found in Library',
        message: `${toolChanges.unknownTools.length} tool(s) from G-code are not in your ncSender library. If you proceed with "Map Tools", only tools that exist will be mapped - unknown tools will remain as-is in the G-code.`
      },
      yellow: {
        color: '#ffc107',
        bgColor: 'rgba(255, 193, 7, 0.1)',
        icon: '🟡',
        title: 'Manual Tool Changes Required',
        message: `${toolChanges.notInMagazine.length} tool(s) exist in your library but are not assigned to ATC pockets. These will require manual tool changes during operation.`
      },
      green: {
        color: '#28a745',
        bgColor: 'rgba(40, 167, 69, 0.1)',
        icon: '🟢',
        title: 'All Tools Ready for ATC',
        message: 'All tools are in your library and assigned to ATC pockets. Tool numbers will be automatically translated to your magazine layout.'
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
        
        .tools-section {
          background: var(--color-surface-muted, #1a1a1a);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        
        .section-title {
          font-weight: 600;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .tool-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
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
          <h2>Tool Translation Status</h2>
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
        
        ${toolChanges.inMagazine.length > 0 ? `
        <div class="tools-section">
          <div class="section-title">
            <span>🟢</span>
            <span>In ATC Magazine (${toolChanges.inMagazine.length})</span>
          </div>
          <div class="tool-list">
            ${toolChanges.inMagazine.map(t => `
              <div class="tool-item green">
                <div class="tool-number">T${t.toolNumber}</div>
                <div class="tool-name">${t.toolInfo ? t.toolInfo.name : `Tool ${t.toolNumber}`}</div>
                <div class="tool-badge green">→ T${t.pocketNumber}</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        ${toolChanges.notInMagazine.length > 0 ? `
        <div class="tools-section">
          <div class="section-title">
            <span>🟡</span>
            <span>Manual Change Required (${toolChanges.notInMagazine.length})</span>
          </div>
          <div class="tool-list">
            ${toolChanges.notInMagazine.map(t => `
              <div class="tool-item yellow">
                <div class="tool-number">T${t.toolNumber}</div>
                <div class="tool-name">${t.toolInfo ? t.toolInfo.name : `Tool ${t.toolNumber}`}</div>
                <div class="tool-badge yellow">MANUAL</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        ${toolChanges.unknownTools.length > 0 ? `
        <div class="tools-section">
          <div class="section-title">
            <span>🔴</span>
            <span>Not in Library (${toolChanges.unknownTools.length})</span>
          </div>
          <div class="tool-list">
            ${toolChanges.unknownTools.map(t => `
              <div class="tool-item red">
                <div class="tool-number">T${t.toolNumber}</div>
                <div class="tool-name">Unknown Tool</div>
                <div class="tool-badge red">IMPORT REQUIRED</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <div class="actions">
          <button id="cancelBtn" class="btn btn-secondary">Cancel</button>
          <button id="bypassBtn" class="btn btn-secondary">Bypass Mapping</button>
          <button id="mapBtn" class="btn ${status === 'green' ? 'btn-success' : (status === 'yellow' ? 'btn-warning' : 'btn-primary')}">
            Map Tools
          </button>
        </div>
      </div>
      
      <script>
        (function() {
          document.getElementById('cancelBtn').addEventListener('click', () => {
            window.parent.postMessage({ 
              type: 'close-plugin-dialog',
              data: { action: 'cancel' }
            }, '*');
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
    const response = await pluginContext.showDialog('Tool Translation Status', html, {
      closable: false
    });
    
    pluginContext.log(`Dialog resolved with response:`, JSON.stringify(response));
    
    // Extract action from response
    if (response && response.action) {
      pluginContext.log(`Returning action: ${response.action}`);
      return response.action;
    }
    
    pluginContext.log('No action in response, returning cancel');
    return 'cancel';
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
  
  // Helper function to find M6 tool number near a line
  const findNearbyM6Tool = (lineIndex) => {
    // Check 3 lines before and 3 lines after for M6 command
    for (let offset = -3; offset <= 3; offset++) {
      const checkIndex = lineIndex + offset;
      if (checkIndex >= 0 && checkIndex < lines.length) {
        const checkLine = lines[checkIndex];
        if (/M0?6/i.test(checkLine)) {
          const toolMatch = checkLine.match(/T(\d+)/i);
          if (toolMatch) {
            return parseInt(toolMatch[1], 10);
          }
        }
      }
    }
    return null;
  };
  
  const translatedLines = lines.map((line, index) => {
    if (!line.trim()) return line;
    
    const trimmed = line.trim();
    
    // Handle comments - only translate if they refer to an M6 line nearby
    if (trimmed.startsWith('(') || trimmed.startsWith(';')) {
      const toolMatch = line.match(/T(\d+)/i);
      if (toolMatch) {
        const commentToolNumber = parseInt(toolMatch[1], 10);
        const nearbyM6Tool = findNearbyM6Tool(index);
        
        // Only translate if comment's tool matches a nearby M6 command
        if (nearbyM6Tool === commentToolNumber) {
          const pocketNumber = translationMap[commentToolNumber];
          
          if (pocketNumber !== undefined) {
            // Replace T## with T# [Fusion: tool ##]
            const translatedLine = line.replace(/T(\d+)/i, (match, num) => {
              return `T${pocketNumber} [Fusion: tool ${num}]`;
            });
            commentTranslationCount++;
            return translatedLine;
          }
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

