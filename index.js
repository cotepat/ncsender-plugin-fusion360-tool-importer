/*
 * Fusion 360 Tool Importer & Translator Plugin
 * 
 * This plugin provides two main features:
 * 1. Import tool libraries from Fusion 360 JSON exports
 * 2. Translate Fusion tool numbers to ncSender ATC pocket numbers
 * 
 * Version: 2.0.2
 */

import * as toolImporter from './tool-importer.js';
import * as gcodeTranslator from './gcode-translator.js';

/**
 * Plugin initialization
 */
export function onLoad(ctx) {
  // Initialize modules
  toolImporter.init(ctx);
  gcodeTranslator.init(ctx);
  
  // Register tool menu item for importing
  ctx.registerToolMenu('Fusion 360 Tool Importer', () => {
    toolImporter.showImportDialog();
  }, { icon: 'logo.png' });
  
  // Register G-code translation handler
  gcodeTranslator.registerHandler(ctx);
  
  // Register plugin settings UI
  registerPluginSettings(ctx);
  
  ctx.log('Fusion 360 Tool Importer & Translator v2.0.2 loaded');
}

/**
 * Register plugin settings UI
 */
function registerPluginSettings(ctx) {
  const html = `
    <style>
      .plugin-settings {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        padding: 20px;
        color: var(--color-text-primary, #e0e0e0);
      }
      
      .setting-group {
        margin-bottom: 24px;
      }
      
      .setting-group h3 {
        margin: 0 0 12px 0;
        font-size: 1.1rem;
        color: var(--color-text-primary);
      }
      
      .setting-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        background: var(--color-surface-muted, #1a1a1a);
        border-radius: 8px;
        margin-bottom: 12px;
      }
      
      .setting-item input[type="checkbox"] {
        margin-top: 2px;
        cursor: pointer;
      }
      
      .setting-label {
        flex: 1;
        cursor: pointer;
      }
      
      .setting-label strong {
        display: block;
        margin-bottom: 4px;
        color: var(--color-text-primary);
      }
      
      .setting-label .description {
        font-size: 0.9rem;
        color: var(--color-text-secondary);
        line-height: 1.4;
      }
      
      .save-status {
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.9rem;
        margin-top: 12px;
        display: none;
      }
      
      .save-status.success {
        background: rgba(40, 167, 69, 0.2);
        color: #28a745;
        display: block;
      }
      
      .save-status.error {
        background: rgba(220, 53, 69, 0.2);
        color: #dc3545;
        display: block;
      }
    </style>
    
    <div class="plugin-settings">
      <div class="setting-group">
        <h3>G-Code Translation</h3>
        
        <div class="setting-item">
          <input type="checkbox" id="enableToolNumberTranslation">
          <label for="enableToolNumberTranslation" class="setting-label">
            <strong>Enable Tool Number Mapping</strong>
            <div class="description">
              Automatically map Fusion 360 tool numbers (e.g., T84) to ncSender ATC pockets (e.g., T1) when loading G-code files (e.g. T84 is in ATC pocket 1).
              This addresses a limitation of ncSender which ties tool numbers to ATC pockets (T1 is always in ATC pocket 1).
              This option will translate all tool numbers in the G-code file to the corresponding ncSender ATC pocket number.
              If you want to use the original tool number (e.g. T84 instead of T1), you can disable this option.
            </div>
          </label>
        </div>
      </div>
      
      <div id="saveStatus" class="save-status"></div>
    </div>
    
    <script>
      (function() {
        const checkbox = document.getElementById('enableToolNumberTranslation');
        const saveStatus = document.getElementById('saveStatus');
        const pluginId = 'com.ncsender.fusion360-import';
        
        // Load current setting from HTTP API
        fetch('/api/plugins/' + pluginId + '/settings')
          .then(response => response.json())
          .then(settings => {
            checkbox.checked = settings.enableToolNumberTranslation !== undefined ? settings.enableToolNumberTranslation : true;
          })
          .catch(error => {
            console.error('Failed to load settings:', error);
            // Default to true
            checkbox.checked = true;
          });
        
        // Save on change via HTTP API
        checkbox.addEventListener('change', async () => {
          try {
            const response = await fetch('/api/plugins/' + pluginId + '/settings', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                enableToolNumberTranslation: checkbox.checked
              })
            });
            
            if (!response.ok) {
              throw new Error('Failed to save settings');
            }
            
            saveStatus.textContent = 'Settings saved successfully';
            saveStatus.className = 'save-status success';
            
            setTimeout(() => {
              saveStatus.style.display = 'none';
            }, 2000);
          } catch (error) {
            console.error('Failed to save settings:', error);
            saveStatus.textContent = 'Failed to save settings';
            saveStatus.className = 'save-status error';
            saveStatus.style.display = 'block';
          }
        });
      })();
    </script>
  `;
  
  ctx.registerConfigUI(html);
}

/**
 * Plugin cleanup
 */
export function onUnload(ctx) {
  ctx.log('Fusion 360 Tool Importer & Translator unloaded');
}
