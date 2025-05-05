// finetune-calculator.js - JavaScript port of fine-tune.py for fine-tuning VRAM calculations

// Create a namespace for fine-tuning calculator
const FinetuneCalculator = {};

// Default architectures mapping - parameters to hidden dimensions and layers
FinetuneCalculator.DEFAULT_ARCHITECTURES = {
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

// Bytes per parameter for different precision/quantization levels
FinetuneCalculator.PRECISION_BYTES = {
  "FP32": 4.0,
  "FP16": 2.0,
  "BF16": 2.0,
  "INT8": 1.0,
  "INT4": 0.5
};

// Common GPU VRAM sizes in GB
FinetuneCalculator.COMMON_GPUS = {
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

// Fine-tuning method configurations
FinetuneCalculator.FINETUNING_METHODS = {
  "full": {
    description: "Full fine-tuning of all model parameters",
    model_weight_precision: "FP16",  // Typical precision for model weights
    optimizer_states_factor: 4.0,    // Factor for Adam optimizer states (4x weights)
    activation_factor: 2.0,          // Activations for full training
    adapter_overhead: 0.0            // No adapter modules
  },
  "lora": {
    description: "Low-Rank Adaptation with adapter modules",
    model_weight_precision: "FP16",  // Base model precision
    optimizer_states_factor: 0.1,    // Much smaller optimizer states (only adapters)
    activation_factor: 1.0,          // Reduced activations due to freezing
    adapter_overhead: 0.05           // 5% overhead for adapter modules
  },
  "qlora": {
    description: "Quantized Low-Rank Adaptation with 4-bit quantization",
    model_weight_precision: "INT4",  // Quantized base model
    optimizer_states_factor: 0.1,    // Only adapter modules are optimized
    activation_factor: 0.5,          // Further reduced activations
    adapter_overhead: 0.05           // 5% overhead for adapter modules
  }
};

// Function to get closest architecture based on parameter count
FinetuneCalculator.getClosestArchitecture = function(paramsBillions) {
  const sortedArchs = Object.keys(FinetuneCalculator.DEFAULT_ARCHITECTURES)
    .sort((a, b) => parseFloat(a.replace('B', '')) - parseFloat(b.replace('B', '')));
  
  for (const arch of sortedArchs) {
    if (parseFloat(arch.replace('B', '')) >= paramsBillions) {
      return arch;
    }
  }
  
  // Return the largest if none found
  return sortedArchs[sortedArchs.length - 1];
};

// Function to get architecture details
FinetuneCalculator.getArchitectureDetails = function(paramsBillions) {
  const closestArch = FinetuneCalculator.getClosestArchitecture(paramsBillions);
  return [
    FinetuneCalculator.DEFAULT_ARCHITECTURES[closestArch].hidden_dim,
    FinetuneCalculator.DEFAULT_ARCHITECTURES[closestArch].num_layers
  ];
};

// Function to calculate model weights
FinetuneCalculator.calculateModelWeights = function(numParams, precision) {
  const bytesPerParam = FinetuneCalculator.PRECISION_BYTES[precision];
  return numParams * bytesPerParam;
};

// Function to calculate activation memory
FinetuneCalculator.calculateActivationMemory = function(modelWeights, activationFactor) {
  return modelWeights * activationFactor;
};

// Function to calculate optimizer states
FinetuneCalculator.calculateOptimizerStates = function(modelWeights, optimizerFactor) {
  return modelWeights * optimizerFactor;
};

// Function to calculate gradient accumulation reduction
FinetuneCalculator.calculateGradientAccumulationReduction = function(batchSize, gradAccumSteps = 1) {
  const effectiveBatchSize = batchSize / gradAccumSteps;
  return effectiveBatchSize / batchSize;
};

// Function to calculate KV cache
FinetuneCalculator.calculateKVCache = function(hiddenDim, numLayers, batchSize, seqLength, precision) {
  const bytesPerElement = FinetuneCalculator.PRECISION_BYTES[precision];
  
  // 2 is for Key and Value tensors
  const kvCachePerToken = (hiddenDim * 2 * bytesPerElement * numLayers) / 10**9;
  
  return batchSize * seqLength * kvCachePerToken;
};

// Function to calculate total training VRAM
FinetuneCalculator.calculateTotalTrainingVram = function(
  modelWeights,
  activationMemory,
  optimizerStates,
  kvCache,
  adapterOverhead = 0.0
) {
  // Calculate base VRAM
  let baseVram = modelWeights + activationMemory + optimizerStates + kvCache;
  
  // Add adapter overhead if using adapter-based methods
  if (adapterOverhead > 0) {
    const adapterMemory = modelWeights * adapterOverhead;
    baseVram += adapterMemory;
  }
  
  // Apply overhead factor for training (typically higher than inference)
  const overheadFactor = 1.2; // 20% overhead for training
  
  return baseVram * overheadFactor;
};

// Function to check if model will fit
FinetuneCalculator.willModelFit = function(totalVram, gpuVram, numGpus = 1) {
  const availableVram = gpuVram * numGpus;
  
  // Allow for some overhead (system, CUDA, etc.)
  const effectiveVram = availableVram * 0.95;
  
  return totalVram <= effectiveVram;
};

// Helper function to round numbers to specified decimal places
FinetuneCalculator.round = function(num, decimals) {
  return Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
};

// Main function to compute fine-tuning requirements
FinetuneCalculator.computeFinetuningRequirements = function(
  paramsBillions,
  finetuningMethod,
  gpuVram,
  numGpus,
  batchSize,
  seqLength,
  gradAccumSteps = 1
) {
  // Get method configuration
  if (!FinetuneCalculator.FINETUNING_METHODS[finetuningMethod]) {
    throw new Error(`Unknown fine-tuning method: ${finetuningMethod}`);
  }
  
  const methodConfig = FinetuneCalculator.FINETUNING_METHODS[finetuningMethod];
  
  // Get architecture details
  const [hiddenDim, numLayers] = FinetuneCalculator.getArchitectureDetails(paramsBillions);
  
  // Calculate effective batch size with gradient accumulation
  const effectiveBatchSize = batchSize / gradAccumSteps;
  
  // Calculate components
  const modelPrecision = methodConfig.model_weight_precision;
  const modelWeights = FinetuneCalculator.calculateModelWeights(paramsBillions, modelPrecision);
  const activationMemory = FinetuneCalculator.calculateActivationMemory(
    modelWeights, 
    methodConfig.activation_factor
  );
  const optimizerStates = FinetuneCalculator.calculateOptimizerStates(
    modelWeights, 
    methodConfig.optimizer_states_factor
  );
  const kvCache = FinetuneCalculator.calculateKVCache(
    hiddenDim, 
    numLayers, 
    effectiveBatchSize, 
    seqLength, 
    modelPrecision
  );
  
  // Calculate total VRAM
  const adapterOverhead = methodConfig.adapter_overhead || 0.0;
  
  const totalVram = FinetuneCalculator.calculateTotalTrainingVram(
    modelWeights,
    activationMemory,
    optimizerStates,
    kvCache,
    adapterOverhead
  );
  
  // Distribute across GPUs if multiple GPUs available
  const vramPerGpu = numGpus > 0 ? totalVram / numGpus : totalVram;
  
  // Check if model will fit
  const willFit = FinetuneCalculator.willModelFit(totalVram, gpuVram, numGpus);
  
  // Calculate VRAM usage percentage
  const totalAvailableVram = gpuVram * numGpus;
  const vramUsagePercent = totalAvailableVram > 0
    ? (totalVram / totalAvailableVram) * 100
    : Infinity;
  
  // Construct detailed result
  return {
    will_it_fit: willFit,
    needed_vram: FinetuneCalculator.round(totalVram, 2),
    details: {
      model_weights: FinetuneCalculator.round(modelWeights, 2),
      activation_memory: FinetuneCalculator.round(activationMemory, 2),
      optimizer_states: FinetuneCalculator.round(optimizerStates, 2),
      kv_cache: FinetuneCalculator.round(kvCache, 2),
      method_description: methodConfig.description,
      total_vram: FinetuneCalculator.round(totalVram, 2),
      vram_per_gpu: FinetuneCalculator.round(vramPerGpu, 2),
      vram_usage_percent: FinetuneCalculator.round(vramUsagePercent, 2),
      effective_batch_size: effectiveBatchSize,
      architecture: { hidden_dim: hiddenDim, num_layers: numLayers }
    }
  };
};

// Function to suggest fine-tuning configurations
FinetuneCalculator.suggestFinetuningConfigurations = function(
  paramsBillions,
  finetuningMethod,
  gpuVram,
  numGpus,
  batchSize,
  seqLength,
  gradAccumSteps = 1
) {
  const suggestions = [];
  
  // Check if current configuration fits
  const result = FinetuneCalculator.computeFinetuningRequirements(
    paramsBillions,
    finetuningMethod,
    gpuVram,
    numGpus,
    batchSize,
    seqLength,
    gradAccumSteps
  );
  
  if (result.will_it_fit) {
    // Already fits, no suggestions needed
    return suggestions;
  }
  
  // Try different fine-tuning methods
  for (const method of ["lora", "qlora"]) {
    if (method !== finetuningMethod) {
      const suggestionResult = FinetuneCalculator.computeFinetuningRequirements(
        paramsBillions,
        method,
        gpuVram,
        numGpus,
        batchSize,
        seqLength,
        gradAccumSteps
      );
      
      if (suggestionResult.will_it_fit) {
        suggestions.push({
          type: "change_method",
          method: method,
          needed_vram: suggestionResult.needed_vram
        });
      }
    }
  }
  
  // Try gradient accumulation
  for (const newGradAccum of [2, 4, 8]) {
    if (newGradAccum > gradAccumSteps) {
      const suggestionResult = FinetuneCalculator.computeFinetuningRequirements(
        paramsBillions,
        finetuningMethod,
        gpuVram,
        numGpus,
        batchSize,
        seqLength,
        newGradAccum
      );
      
      if (suggestionResult.will_it_fit) {
        suggestions.push({
          type: "increase_grad_accum",
          grad_accum_steps: newGradAccum,
          needed_vram: suggestionResult.needed_vram
        });
        break;
      }
    }
  }
  
  // Try reducing batch size
  if (batchSize > 1) {
    for (const newBatchSize of [Math.floor(batchSize / 2), 1]) {
      const suggestionResult = FinetuneCalculator.computeFinetuningRequirements(
        paramsBillions,
        finetuningMethod,
        gpuVram,
        numGpus,
        newBatchSize,
        seqLength,
        gradAccumSteps
      );
      
      if (suggestionResult.will_it_fit) {
        suggestions.push({
          type: "reduce_batch_size",
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
      const suggestionResult = FinetuneCalculator.computeFinetuningRequirements(
        paramsBillions,
        finetuningMethod,
        gpuVram,
        numGpus,
        batchSize,
        newSeqLength,
        gradAccumSteps
      );
      
      if (suggestionResult.will_it_fit) {
        suggestions.push({
          type: "reduce_sequence_length",
          sequence_length: newSeqLength,
          needed_vram: suggestionResult.needed_vram
        });
        break;
      }
    }
  }
  
  // Try increasing GPU count
  if (numGpus < 8) {
    for (const newNumGpus of [numGpus + 1, numGpus * 2]) {
      const suggestionResult = FinetuneCalculator.computeFinetuningRequirements(
        paramsBillions,
        finetuningMethod,
        gpuVram,
        newNumGpus,
        batchSize,
        seqLength,
        gradAccumSteps
      );
      
      if (suggestionResult.will_it_fit) {
        suggestions.push({
          type: "increase_gpus",
          num_gpus: newNumGpus,
          needed_vram: suggestionResult.needed_vram
        });
        break;
      }
    }
  }
  
  return suggestions;
};

// Main function to be called from UI
FinetuneCalculator.calculateFinetuningRequirements = function(
  paramsBillions,
  finetuningMethod,
  gpuName,
  numGpus,
  batchSize,
  seqLength,
  gradAccumSteps = 1
) {
  // Handle GPU VRAM input (either direct value or GPU name)
  let gpuVramGB;
  
  if (typeof gpuName === 'string' && FinetuneCalculator.COMMON_GPUS[gpuName] !== undefined) {
    gpuVramGB = FinetuneCalculator.COMMON_GPUS[gpuName];
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
  const result = FinetuneCalculator.computeFinetuningRequirements(
    paramsBillions,
    finetuningMethod,
    gpuVramGB,
    numGpus,
    batchSize,
    seqLength,
    gradAccumSteps
  );
  
  // Get suggestions if needed
  let suggestions = [];
  if (!result.will_it_fit) {
    suggestions = FinetuneCalculator.suggestFinetuningConfigurations(
      paramsBillions,
      finetuningMethod,
      gpuVramGB,
      numGpus,
      batchSize,
      seqLength,
      gradAccumSteps
    );
  }
  
  // Combine results and suggestions
  return { ...result, suggestions };
};

// Export the calculator function
window.calculateFinetuningRequirements = FinetuneCalculator.calculateFinetuningRequirements; 