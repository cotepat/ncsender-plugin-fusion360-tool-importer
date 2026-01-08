/*
 * Fusion 360 Tool Importer & Translator Plugin
 * 
 * This plugin provides two main features:
 * 1. Import tool libraries from Fusion 360 JSON exports
 * 2. Translate Fusion tool numbers to ncSender ATC pocket numbers
 * 
 * Version: 2.0.0
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
  
  ctx.log('Fusion 360 Tool Importer & Translator v2.0.0 loaded');
}

/**
 * Plugin cleanup
 */
export function onUnload(ctx) {
  ctx.log('Fusion 360 Tool Importer & Translator unloaded');
}
