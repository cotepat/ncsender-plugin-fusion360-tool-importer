/*
 * Fusion 360 Tool Importer Plugin
 * 
 * This plugin imports tool libraries from Fusion 360 JSON exports.
 * 
 * Version: 2.2.0
 */

import * as toolImporter from './tool-importer.js';

/**
 * Plugin initialization
 */
export function onLoad(ctx) {
  // Initialize tool importer module
  toolImporter.init(ctx);
  
  // Register tool menu item for importing
  ctx.registerToolMenu('Fusion 360 Tool Importer', () => {
    toolImporter.showImportDialog();
  }, { icon: 'logo.png' });
  
  ctx.log('Fusion 360 Tool Importer v2.2.0 loaded');
}

/**
 * Plugin cleanup
 */
export function onUnload(ctx) {
  ctx.log('Fusion 360 Tool Importer unloaded');
}
