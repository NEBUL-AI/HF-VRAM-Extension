// inference-calculator.js - JavaScript port of inference.py for VRAM calculations

// Default architectures mapping - parameters to hidden dimensions and layers
const DEFAULT_ARCHITECTURES = {
  "1B": { hidden_dim: 2048, num_layers: 22 },
  "3B": { hidden_dim: 3072, num_layers: 26 },
  "7B": { hidden_dim: 4096, num_layers: 32 },
  "13B": { hidden_dim: 5120, num_layers: 40 },
  "30B": { hidden_dim: 7168, num_layers: 60 },
  "65B": { hidden_dim: 8192, num_layers: 80 },
  "120B": { hidden_dim: 12288, num_layers: 96 },
  "405B": { hidden_dim: 16384, num_layers: 120 },
  "671B": { hidden_dim: 20480, num_layers: 160 }
};

// Bytes per parameter for different quantization levels
const PRECISION_BYTES = {
  "FP32": 4.0,
  "FP16": 2.0,
  "BF16": 2.0,
  "INT8": 1.0,
  "Q8": 1.0,
  "INT4": 0.5,
  "Q4": 0.5,
  "Q5": 0.625,
  "Q6": 0.75,
  "Q2": 0.25
};

// Common GPU VRAM sizes in GB
const COMMON_GPUS = {
  "RTX 3060": 12,
  "RTX 3070": 8,
  "RTX 3080": 10,
  "RTX 3090": 24,
  "RTX 4060": 8,
  "RTX 4070": 12,
  "RTX 4080": 16,
  "RTX 4090": 24,
  "RTX 6000": 48,
  "A100-40G": 40,
  "A100-80G": 80,
  "H100": 80,
  "H200": 141,
  // Map UI values to VRAM sizes
  "rtx-4090": 24,
  "l4": 24,
  "l40s": 48,
  "a100": 80,
  "h200": 141,
  "b200": 96
};

// Function to get closest architecture based on parameter count
function getClosestArchitecture(paramsBillions) {
  const sortedArchs = Object.keys(DEFAULT_ARCHITECTURES)
    .sort((a, b) => parseFloat(a.replace('B', '')) - parseFloat(b.replace('B', '')));
  
  for (const arch of sortedArchs) {
    if (parseFloat(arch.replace('B', '')) >= paramsBillions) {
      return arch;
    }
  }
  
  // Return the largest if none found
  return sortedArchs[sortedArchs.length - 1];
}

// Function to get architecture details
function getArchitectureDetails(paramsBillions) {
  const closestArch = getClosestArchitecture(paramsBillions);
  return [
    DEFAULT_ARCHITECTURES[closestArch].hidden_dim,
    DEFAULT_ARCHITECTURES[closestArch].num_layers
  ];
}

// Function to calculate model weights
function calculateModelWeights(numParams, precision) {
  const bytesPerParam = PRECISION_BYTES[precision];
  return numParams * bytesPerParam;
}

// Function to calculate activation memory
function calculateActivationMemory(modelWeights) {
  // For inference, activation memory is typically 0.2x model weights
  return modelWeights * 0.2;
}

// Function to calculate KV cache
function calculateKVCache(
  hiddenDim,
  numLayers,
  batchSize,
  seqLength,
  precision,
  concurrentRequests = 1
) {
  const bytesPerElement = PRECISION_BYTES[precision];
  
  // 2 is for Key and Value tensors
  const kvCachePerToken = (hiddenDim * 2 * bytesPerElement * numLayers) / 10**9;
  
  return batchSize * seqLength * kvCachePerToken * concurrentRequests;
}

// Function to calculate total VRAM
function calculateTotalVRAM(
  modelWeights,
  activationMemory,
  kvCache,
  isReasoning = false
) {
  const baseVram = modelWeights + activationMemory + kvCache;
  
  // Apply overhead factor
  const overheadFactor = isReasoning ? 1.25 : 1.15;
  
  return baseVram * overheadFactor;
}

// Function to check if model will fit
function willModelFit(totalVram, gpuVram, numGpus = 1) {
  const availableVram = gpuVram * numGpus;
  
  // Allow for some overhead (system, CUDA, etc.)
  const effectiveVram = availableVram * 0.95;
  
  return totalVram <= effectiveVram;
}

// Main function to compute VRAM requirements
function computeVramRequirements(
  paramsBillions,
  precision,
  gpuVram,
  numGpus,
  batchSize,
  seqLength,
  concurrentRequests,
  isReasoning
) {
  // Get architecture details
  const [hiddenDim, numLayers] = getArchitectureDetails(paramsBillions);
  
  // Calculate components
  const modelWeights = calculateModelWeights(paramsBillions, precision);
  const activationMemory = calculateActivationMemory(modelWeights);
  const kvCache = calculateKVCache(
    hiddenDim,
    numLayers,
    batchSize,
    seqLength,
    precision,
    concurrentRequests
  );
  
  // Calculate total VRAM
  const totalVram = calculateTotalVRAM(
    modelWeights,
    activationMemory,
    kvCache,
    isReasoning
  );
  
  // Check if model will fit
  const willFit = willModelFit(totalVram, gpuVram, numGpus);
  
  // Compute effective VRAM per GPU
  const vramPerGpu = numGpus > 0 ? totalVram / numGpus : totalVram;
  
  // Calculate overhead factor
  const overheadFactor = isReasoning ? 1.25 : 1.15;
  
  // Calculate base VRAM (before overhead)
  const baseVram = modelWeights + activationMemory + kvCache;
  
  // Calculate VRAM usage percentage
  const totalAvailableVram = gpuVram * numGpus;
  const vramUsagePercent = totalAvailableVram > 0
    ? (totalVram / totalAvailableVram) * 100
    : Infinity;
  
  // Return detailed result
  return {
    will_it_fit: willFit,
    needed_vram: round(totalVram, 2),
    total_kv_cache: round(kvCache, 2),
    details: {
      model_weights: round(modelWeights, 2),
      activation_memory: round(activationMemory, 2),
      kv_cache: round(kvCache, 2),
      base_vram: round(baseVram, 2),
      overhead_factor: overheadFactor,
      total_vram: round(totalVram, 2),
      vram_per_gpu: round(vramPerGpu, 2),
      vram_usage_percent: round(vramUsagePercent, 2),
      architecture: { hidden_dim: hiddenDim, num_layers: numLayers }
    }
  };
}

// Function to suggest configurations
function suggestConfigurations(
  paramsBillions,
  precision,
  gpuVram,
  numGpus,
  batchSize,
  seqLength,
  concurrentRequests,
  isReasoning
) {
  const suggestions = [];
  
  // Check if current configuration fits
  const result = computeVramRequirements(
    paramsBillions,
    precision,
    gpuVram,
    numGpus,
    batchSize,
    seqLength,
    concurrentRequests,
    isReasoning
  );
  
  if (result.will_it_fit) {
    // Already fits, no suggestions needed
    return suggestions;
  }
  
  // Try reducing batch size
  if (batchSize > 1) {
    for (const newBatchSize of [Math.floor(batchSize / 2), 1]) {
      const suggestionResult = computeVramRequirements(
        paramsBillions,
        precision,
        gpuVram,
        numGpus,
        newBatchSize,
        seqLength,
        concurrentRequests,
        isReasoning
      );
      
      if (suggestionResult.will_it_fit) {
        suggestions.push({
          type: 'reduce_batch_size',
          batch_size: newBatchSize,
          needed_vram: suggestionResult.needed_vram
        });
        break;
      }
    }
  }
  
  // Try reducing sequence length
  if (seqLength > 512) {
    for (const newSeqLength of [Math.floor(seqLength / 2), 1024, 512]) {
      const suggestionResult = computeVramRequirements(
        paramsBillions,
        precision,
        gpuVram,
        numGpus,
        batchSize,
        newSeqLength,
        concurrentRequests,
        isReasoning
      );
      
      if (suggestionResult.will_it_fit) {
        suggestions.push({
          type: 'reduce_sequence_length',
          sequence_length: newSeqLength,
          needed_vram: suggestionResult.needed_vram
        });
        break;
      }
    }
  }
  
  // Try more aggressive quantization
  const precisionOptions = ['Q4', 'Q2'];
  for (const newPrecision of precisionOptions) {
    if (PRECISION_BYTES[newPrecision] < PRECISION_BYTES[precision]) {
      const suggestionResult = computeVramRequirements(
        paramsBillions,
        newPrecision,
        gpuVram,
        numGpus,
        batchSize,
        seqLength,
        concurrentRequests,
        isReasoning
      );
      
      if (suggestionResult.will_it_fit) {
        suggestions.push({
          type: 'more_quantization',
          precision: newPrecision,
          needed_vram: suggestionResult.needed_vram
        });
        break;
      }
    }
  }
  
  // Try increasing GPU count
  if (numGpus < 8) {
    for (const newNumGpus of [numGpus + 1, numGpus * 2]) {
      const suggestionResult = computeVramRequirements(
        paramsBillions,
        precision,
        gpuVram,
        newNumGpus,
        batchSize,
        seqLength,
        concurrentRequests,
        isReasoning
      );
      
      if (suggestionResult.will_it_fit) {
        suggestions.push({
          type: 'increase_gpus',
          num_gpus: newNumGpus,
          needed_vram: suggestionResult.needed_vram
        });
        break;
      }
    }
  }
  
  return suggestions;
}

// Helper function to round numbers to specified decimal places
function round(num, decimals) {
  return Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
}

// Main function to be called from UI
function calculateVramRequirements(
  paramsBillions,
  precision,
  gpuName,
  numGpus,
  batchSize,
  seqLength,
  concurrentRequests,
  isReasoning
) {
  // Handle GPU VRAM input (either direct value or GPU name)
  let gpuVramGB;
  
  if (typeof gpuName === 'string' && COMMON_GPUS[gpuName] !== undefined) {
    gpuVramGB = COMMON_GPUS[gpuName];
  } else {
    try {
      gpuVramGB = parseFloat(gpuName);
      if (isNaN(gpuVramGB)) {
        gpuVramGB = 24.0; // Default to RTX 4090 if invalid
      }
    } catch (error) {
      gpuVramGB = 24.0; // Default to RTX 4090 if invalid
    }
  }
  
  // Compute VRAM requirements
  const result = computeVramRequirements(
    paramsBillions,
    precision,
    gpuVramGB,
    numGpus,
    batchSize,
    seqLength,
    concurrentRequests,
    isReasoning
  );
  
  // Get suggestions if needed
  let suggestions = [];
  if (!result.will_it_fit) {
    suggestions = suggestConfigurations(
      paramsBillions,
      precision,
      gpuVramGB,
      numGpus,
      batchSize,
      seqLength,
      concurrentRequests,
      isReasoning
    );
  }
  
  // Combine results and suggestions
  return { ...result, suggestions };
}

// Export the calculator function
window.calculateVramRequirements = calculateVramRequirements; 