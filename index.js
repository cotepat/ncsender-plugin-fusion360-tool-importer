/*
 * Fusion 360 Tool Library Import Plugin
 * 
 * This plugin allows importing tool libraries exported from Fusion 360.
 * It converts Fusion 360 tool format to ncSender tool format.
 */

// Tool type mapping: Fusion 360 type -> ncSender type
const TYPE_MAPPING = {
  'flat end mill': 'flat',
  'ball end mill': 'ball',
  'chamfer mill': 'v-bit',
  'face mill': 'surfacing',
  'thread mill': 'thread-mill'
};

// Default settings
const DEFAULT_SETTINGS = {
  includeFusionToolNumber: true
};

/**
 * Convert Fusion 360 tool to ncSender tool format
 */
function convertFusionToolToNcSender(fusionTool, settings, existingTools) {
  // Get tool type
  const fusionType = fusionTool.type?.toLowerCase() || '';
  const ncSenderType = TYPE_MAPPING[fusionType] || 'flat';

  // Get ATC slot from turret
  // Note: In Fusion 360, turret is typically 0 (meaning no ATC slot assigned)
  // We only use it if it's > 0, otherwise leave as null
  const turret = fusionTool['post-process']?.turret;
  const toolNumber = (turret !== undefined && turret !== null && turret > 0) ? turret : null;

  // Get diameter (DC = cutting diameter) - must be greater than 0
  const diameter = fusionTool.geometry?.DC || 0;
  if (diameter <= 0) {
    throw new Error(`Tool has invalid diameter: ${diameter}`);
  }

  // TLO (Tool Length Offset) should be 0 by default
  // It needs to be measured on the machine, not imported from Fusion 360
  const tlo = 0;

  // Get description - must not be empty
  let description = fusionTool.description || '';
  
  // If description is empty, create a default one
  if (!description || description.trim() === '') {
    const fusionNumber = fusionTool['post-process']?.number;
    if (fusionNumber !== undefined && fusionNumber !== null) {
      description = `Tool ${fusionNumber}`;
    } else {
      description = `${fusionType || 'Unknown'} - ${diameter}mm`;
    }
  }

  // Optionally prefix with Fusion tool number
  if (settings.includeFusionToolNumber) {
    const fusionNumber = fusionTool['post-process']?.number;
    if (fusionNumber !== undefined && fusionNumber !== null) {
      // Only add prefix if not already in description
      if (!description.startsWith(`${fusionNumber} -`)) {
        description = `${fusionNumber} - ${description}`;
      }
    }
  }

  // Build ncSender tool object
  // ID will be assigned during import
  const ncSenderTool = {
    id: 0, // Temporary, will be reassigned
    toolNumber: toolNumber,
    name: description.trim(),
    type: ncSenderType,
    diameter: diameter,
    offsets: {
      tlo: tlo,
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

  return ncSenderTool;
}

// Plugin context (will be set in onLoad)
let pluginContext = null;

/**
 * Import handler for Fusion 360 tool library
 */
async function importFusion360Tools(fileContent, fileName) {
  try {
    // Parse JSON
    const fusionData = JSON.parse(fileContent);

    // Check if it's a valid Fusion 360 export
    if (!fusionData.data || !Array.isArray(fusionData.data)) {
      throw new Error('Invalid Fusion 360 tool library format. Expected "data" array.');
    }

    // Get plugin settings
    const settings = pluginContext ? pluginContext.getSettings() || {} : {};
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

    // Convert each Fusion tool to ncSender format
    // Use temporary high IDs that won't conflict with existing tools
    // The import process will handle proper ID assignment
    const convertedTools = [];
    const skippedTools = [];
    let tempIdCounter = 100000; // Start from high number to avoid conflicts

    for (const tool of fusionData.data) {
      // Filter out tools without required fields
      if (!tool.type) {
        skippedTools.push(`Tool missing type field`);
        continue;
      }
      
      if (!tool.geometry?.DC || tool.geometry.DC <= 0) {
        const toolDesc = tool.description || tool['post-process']?.number || 'unknown';
        skippedTools.push(`Tool "${toolDesc}" has invalid diameter: ${tool.geometry?.DC || 0}`);
        continue;
      }

      try {
        // Convert tool
        const converted = convertFusionToolToNcSender(tool, mergedSettings, []);
        // Assign temporary ID (will be reassigned during import merge)
        converted.id = tempIdCounter++;
        convertedTools.push(converted);
      } catch (error) {
        const toolDesc = tool.description || tool['post-process']?.number || 'unknown';
        skippedTools.push(`Tool "${toolDesc}": ${error.message}`);
      }
    }

    // Log skipped tools if any
    if (pluginContext && skippedTools.length > 0) {
      pluginContext.log(`Skipped ${skippedTools.length} invalid tool(s):`);
      skippedTools.forEach(msg => pluginContext.log(`  - ${msg}`));
    }

    if (convertedTools.length === 0) {
      throw new Error('No valid tools found in the file. All tools were skipped due to missing or invalid data.');
    }

    return convertedTools;
  } catch (error) {
    throw new Error(`Failed to import Fusion 360 tools: ${error.message}`);
  }
}

export function onLoad(ctx) {
  pluginContext = ctx;
  ctx.log('Fusion 360 Import plugin loaded');

  // Register tool importer
  ctx.registerToolImporter(
    'Fusion 360 (JSON)',
    ['.json'],
    importFusion360Tools
  );

  // Register configuration UI
  const configUI = `
    <div style="padding: 16px;">
      <h3 style="margin-top: 0; margin-bottom: 16px;">Fusion 360 Import Settings</h3>
      <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <input 
          type="checkbox" 
          id="includeFusionToolNumber" 
          style="cursor: pointer;"
          onchange="updateSetting('includeFusionToolNumber', this.checked)"
        >
        <span>Include Fusion tool number in description (format: "Number - Description")</span>
      </label>
      <p style="margin: 0; font-size: 0.9em; color: #666;">
        When enabled, imported tool descriptions will be prefixed with the Fusion 360 tool number.
      </p>
    </div>
    <script>
      // Load current settings
      (async function() {
        try {
          const response = await fetch('/api/plugins/com.ncsender.fusion360-import/settings');
          if (response.ok) {
            const settings = await response.json();
            const checkbox = document.getElementById('includeFusionToolNumber');
            if (checkbox) {
              checkbox.checked = settings.includeFusionToolNumber || false;
            }
          }
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      })();

      // Update setting
      async function updateSetting(key, value) {
        try {
          const response = await fetch('/api/plugins/com.ncsender.fusion360-import/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: value })
          });
          if (!response.ok) {
            console.error('Failed to save setting');
          }
        } catch (error) {
          console.error('Failed to save setting:', error);
        }
      }
    </script>
  `;

  ctx.registerConfigUI(configUI);

  ctx.log('Registered Fusion 360 tool importer and config UI');
}

export function onUnload() {
  // Cleanup if needed
}

