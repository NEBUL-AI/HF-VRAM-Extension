// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Nebul GenAI Sidepanel Script

// Initialize the side panel when it's loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Nebul side panel loaded');
  
  // DOM elements for model info
  const modelNameElement = document.getElementById('model-name');
  const modelSizeElement = document.getElementById('model-size');
  
  // DOM elements for calculation - Inference
  const calculateButton = document.getElementById('calculate-button');
  const resultsSection = document.getElementById('calc-results');
  
  // DOM elements for calculation - Fine-tuning
  const ftCalculateButton = document.getElementById('ft-calculate-button');
  
  // Function to format large numbers with commas for readability
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  // Function to update the model info UI
  function updateModelInfoUI(modelInfo) {
    if (modelInfo) {
      // Update model name
      if (modelInfo.modelName) {
        modelNameElement.innerHTML = `<span>${modelInfo.modelName}</span>`;
      } else {
        modelNameElement.innerHTML = `<span class="placeholder-text">Not available</span>`;
      }
      
      // Update model size - show both human-readable and exact parameter count
      if (modelInfo.modelSize) {
        let sizeDisplay = `<span>${modelInfo.modelSize}</span>`;
        
        // Add the integer representation if available
        if (modelInfo.modelSizeInt && modelInfo.modelSizeInt > 0) {
          sizeDisplay += ` <span class="text-gray-500">(${formatNumber(modelInfo.modelSizeInt)} parameters)</span>`;
        }
        
        modelSizeElement.innerHTML = sizeDisplay;
      } else {
        modelSizeElement.innerHTML = `<span class="placeholder-text">Not available</span>`;
      }
    }
  }
  
  // Check if there's already model info in storage
  chrome.storage.session.get(['modelInfo'], (result) => {
    if (result.modelInfo) {
      updateModelInfoUI(result.modelInfo);
    }
  });
  
  // Listen for messages from the service worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in side panel:', message);
    
    // Handle model info updates
    if (message.action === 'modelInfoUpdated') {
      updateModelInfoUI(message.data);
      sendResponse({ received: true });
    }
    
    return true; // Keep the messaging channel open for async responses
  });
  
  // Add click handler for the calculate button (inference)
  calculateButton.addEventListener('click', () => {
    performInferenceCalculation();
  });
  
  // Add click handler for the fine-tuning calculate button
  ftCalculateButton.addEventListener('click', () => {
    performFinetuningCalculation();
  });
  
  // Add click handler for the details toggle
  const detailsToggle = document.getElementById('details-toggle');
  const detailsContent = document.getElementById('details-content');
  
  detailsToggle.addEventListener('click', () => {
    detailsContent.classList.toggle('expanded');
    const toggleIcon = detailsToggle.querySelector('.toggle-icon');
    toggleIcon.textContent = detailsContent.classList.contains('expanded') ? '▲' : '▼';
  });
  
  // Function to extract parameter count in billions from model info
  function extractParameterCount() {
    let paramsBillions = 0;
    const modelSizeText = modelSizeElement.textContent;
    
    // Extract parameters in billions from modelInfo if available
    if (modelSizeText && !modelSizeText.includes('Navigate to a model page')) {
      const sizeMatch = modelSizeText.match(/(\d+(\.\d+)?)B/);
      if (sizeMatch) {
        paramsBillions = parseFloat(sizeMatch[1]);
      } else {
        // Try to get from modelSizeInt if available
        chrome.storage.session.get(['modelInfo'], (result) => {
          if (result.modelInfo && result.modelInfo.modelSizeInt) {
            paramsBillions = result.modelInfo.modelSizeInt / 1000000000;
          }
        });
      }
    }
    
    // If we couldn't extract the size, use a default value
    if (paramsBillions <= 0) {
      paramsBillions = 7; // Default to 7B parameters
    }
    
    return paramsBillions;
  }
  
  // Function to gather input values and trigger inference calculation
  function performInferenceCalculation() {
    // Get model parameter count from model info
    const paramsBillions = extractParameterCount();
    
    // Get input values
    const precision = document.getElementById('precision').value.toUpperCase();
    const gpuName = document.getElementById('gpu').value;
    const numGpus = parseInt(document.getElementById('number-of-gpus').value, 10);
    const batchSize = parseInt(document.getElementById('batch-size').value, 10);
    const seqLength = parseInt(document.getElementById('sequence-length').value, 10);
    const concurrentRequests = parseInt(document.getElementById('concurrent-requests').value, 10);
    const isReasoning = true; // Default to reasoning model for LLMs
    
    console.log('Calculating inference VRAM for:', {
      paramsBillions,
      precision,
      gpuName,
      numGpus,
      batchSize,
      seqLength,
      concurrentRequests,
      isReasoning
    });
    
    // Perform the calculation
    try {
      const result = calculateVramRequirements(
        paramsBillions,
        precision,
        gpuName,
        numGpus,
        batchSize,
        seqLength,
        concurrentRequests,
        isReasoning
      );
      
      // Display the results
      displayResults(result);
    } catch (error) {
      console.error('Error calculating VRAM requirements:', error);
      alert('Error calculating VRAM requirements. Please check the console for details.');
    }
  }
  
  // Function to gather input values and trigger fine-tuning calculation
  function performFinetuningCalculation() {
    // Get model parameter count from model info
    const paramsBillions = extractParameterCount();
    
    // Get input values
    const finetuningMethod = document.getElementById('fine-tuning-method').value;
    const gpuName = document.getElementById('ft-gpu').value;
    const numGpus = parseInt(document.getElementById('ft-number-of-gpus').value, 10);
    const batchSize = parseInt(document.getElementById('ft-batch-size').value, 10);
    const seqLength = parseInt(document.getElementById('ft-sequence-length').value, 10);
    const gradAccumSteps = parseInt(document.getElementById('grad-accum-steps').value, 10);
    
    console.log('Calculating fine-tuning VRAM for:', {
      paramsBillions,
      finetuningMethod,
      gpuName,
      numGpus,
      batchSize,
      seqLength,
      gradAccumSteps
    });
    
    // Perform the calculation
    try {
      // Check if function is available
      if (typeof calculateFinetuningRequirements !== 'function') {
        console.log('calculateFinetuningRequirements function not found. Attempting to load it dynamically.');
        
        // Try to load it from the FinetuneCalculator namespace
        if (typeof FinetuneCalculator !== 'undefined' && 
            typeof FinetuneCalculator.calculateFinetuningRequirements === 'function') {
          window.calculateFinetuningRequirements = FinetuneCalculator.calculateFinetuningRequirements;
          console.log('Successfully loaded from FinetuneCalculator namespace.');
        } else {
          throw new Error('Could not load the fine-tuning calculator. Please refresh the page and try again.');
        }
      }
      
      const result = calculateFinetuningRequirements(
        paramsBillions,
        finetuningMethod,
        gpuName,
        numGpus,
        batchSize,
        seqLength,
        gradAccumSteps
      );
      
      // Display the results
      displayFinetuningResults(result);
    } catch (error) {
      console.error('Error calculating fine-tuning VRAM requirements:', error);
      alert(error.message || 'Error calculating fine-tuning VRAM requirements. Please check the console for details.');
    }
  }
  
  // Function to display inference calculation results
  function displayResults(result) {
    displayCalculationResults(result, false);
  }
  
  // Function to display fine-tuning calculation results
  function displayFinetuningResults(result) {
    displayCalculationResults(result, true);
  }
  
  // Common function to display calculation results
  function displayCalculationResults(result, isFinetuning) {
    // Show the results section
    resultsSection.classList.remove('hidden');
    
    // Update the will-it-fit indicator
    const fitIndicator = document.getElementById('will-it-fit-indicator');
    fitIndicator.className = 'fit-indicator ' + (result.will_it_fit ? 'fit-yes' : 'fit-no');
    
    // Update main results
    document.getElementById('will-it-fit').textContent = result.will_it_fit ? 'Yes' : 'No';
    document.getElementById('needed-vram').textContent = `${result.needed_vram} GB`;
    
    // Set KV Cache (different display for inference vs fine-tuning)
    const kvCacheElement = document.getElementById('total-kv-cache');
    if (isFinetuning) {
      if (result.details.optimizer_states) {
        kvCacheElement.parentElement.querySelector('.result-label').textContent = 'Optimizer States:';
        kvCacheElement.textContent = `${result.details.optimizer_states} GB`;
      } else {
        kvCacheElement.parentElement.querySelector('.result-label').textContent = 'KV Cache:';
        kvCacheElement.textContent = `${result.details.kv_cache} GB`;
      }
    } else {
      kvCacheElement.parentElement.querySelector('.result-label').textContent = 'KV Cache:';
      kvCacheElement.textContent = `${result.total_kv_cache} GB`;
    }
    
    // Update details
    const details = result.details;
    const detailsContent = document.getElementById('details-content');
    
    let detailsHtml = `
      <div class="detail-item">
        <div class="detail-label">Model Weights:</div>
        <div class="detail-value">${details.model_weights} GB</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Activation Memory:</div>
        <div class="detail-value">${details.activation_memory} GB</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">KV Cache:</div>
        <div class="detail-value">${details.kv_cache} GB</div>
      </div>
    `;
    
    // Add fine-tuning specific details
    if (isFinetuning) {
      detailsHtml += `
        <div class="detail-item">
          <div class="detail-label">Optimizer States:</div>
          <div class="detail-value">${details.optimizer_states} GB</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Gradient Checkpointing:</div>
          <div class="detail-value">${details.gradient_checkpointing ? 'Enabled' : 'Disabled'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Effective Batch Size:</div>
          <div class="detail-value">${details.effective_batch_size}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Method:</div>
          <div class="detail-value">${details.method_description}</div>
        </div>
      `;
    }
    
    // Add common details
    detailsHtml += `
      <div class="detail-item">
        <div class="detail-label">Total VRAM:</div>
        <div class="detail-value">${details.total_vram} GB</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">VRAM per GPU:</div>
        <div class="detail-value">${details.vram_per_gpu} GB</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">VRAM Usage:</div>
        <div class="detail-value">${details.vram_usage_percent}%</div>
      </div>
    `;
    
    detailsContent.innerHTML = detailsHtml;
    
    // Display suggestions if available
    const suggestionsSection = document.getElementById('suggestions-section');
    const suggestionsContent = document.getElementById('suggestions-content');
    
    if (result.suggestions && result.suggestions.length > 0) {
      suggestionsSection.classList.remove('hidden');
      
      let suggestionsHtml = '';
      result.suggestions.forEach(suggestion => {
        let suggestionText = '';
        
        switch (suggestion.type) {
          case 'reduce_batch_size':
            suggestionText = `Reduce batch size to ${suggestion.batch_size} (${suggestion.needed_vram} GB)`;
            break;
          case 'reduce_sequence_length':
            suggestionText = `Reduce sequence length to ${suggestion.sequence_length} (${suggestion.needed_vram} GB)`;
            break;
          case 'more_quantization':
            suggestionText = `Use ${suggestion.precision} precision (${suggestion.needed_vram} GB)`;
            break;
          case 'increase_gpus':
            suggestionText = `Use ${suggestion.num_gpus} GPUs (${suggestion.needed_vram} GB)`;
            break;
          case 'change_method':
            suggestionText = `Use ${suggestion.method} method (${suggestion.needed_vram} GB)`;
            break;
          case 'increase_grad_accum':
            suggestionText = `Increase gradient accumulation steps to ${suggestion.grad_accum_steps} (${suggestion.needed_vram} GB)`;
            break;
        }
        
        suggestionsHtml += `<div class="suggestion-item">${suggestionText}</div>`;
      });
      
      suggestionsContent.innerHTML = suggestionsHtml;
    } else {
      suggestionsSection.classList.add('hidden');
    }
  }
});