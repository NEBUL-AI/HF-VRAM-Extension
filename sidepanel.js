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
  const modelDeveloperElement = document.getElementById('model-developer');
  
  // DOM elements for calculation - Inference
  const calculateButton = document.getElementById('calculate-button');
  const resultsSection = document.getElementById('calc-results');
  
  // DOM elements for calculation - Fine-tuning
  const ftCalculateButton = document.getElementById('ft-calculate-button');
  
  // Set up tabs functionality
  const inferenceTab = document.querySelector('.tab[data-mode="inference"]');
  const finetuningTab = document.querySelector('.tab[data-mode="fine-tuning"]');
  
  if (inferenceTab && finetuningTab) {
    inferenceTab.addEventListener('click', () => {
      // Check if we're on a model page before showing the inference tab
      chrome.storage.session.get(['modelInfo'], (result) => {
        if (result.modelInfo && result.modelInfo.onModelPage === false) {
          // If not on a model page, don't change anything, just keep showing welcome message
          showWelcomeUI();
        } else {
          // If on a model page, switch to inference tab
          handleTabChange('inference');
        }
      });
    });
    
    finetuningTab.addEventListener('click', () => {
      // Check if we're on a model page before showing the fine-tuning tab
      chrome.storage.session.get(['modelInfo'], (result) => {
        if (result.modelInfo && result.modelInfo.onModelPage === false) {
          // If not on a model page, don't change anything, just keep showing welcome message
          showWelcomeUI();
        } else {
          // If on a model page, switch to fine-tuning tab
          handleTabChange('fine-tuning');
        }
      });
    });
  } else {
    console.warn('Tab elements not found with new selectors, trying legacy selectors');
    
    // Fallback to legacy selectors
    const legacyInferenceTab = document.querySelector('.mode-option[data-mode="inference"]');
    const legacyFinetuningTab = document.querySelector('.mode-option[data-mode="fine-tuning"]');
    
    if (legacyInferenceTab && legacyFinetuningTab) {
      console.log('Found tabs using legacy selectors');
      
      legacyInferenceTab.addEventListener('click', () => {
        chrome.storage.session.get(['modelInfo'], (result) => {
          if (result.modelInfo && result.modelInfo.onModelPage === false) {
            showWelcomeUI();
          } else {
            handleTabChange('inference');
          }
        });
      });
      
      legacyFinetuningTab.addEventListener('click', () => {
        chrome.storage.session.get(['modelInfo'], (result) => {
          if (result.modelInfo && result.modelInfo.onModelPage === false) {
            showWelcomeUI();
          } else {
            handleTabChange('fine-tuning');
          }
        });
      });
    }
  }
  
  function handleTabChange(mode) {
    // Get the tab elements - updated selectors for new HTML structure
    const inferenceTab = document.querySelector('.tab[data-mode="inference"]');
    const finetuningTab = document.querySelector('.tab[data-mode="fine-tuning"]');
    
    // Get the content elements
    const inferenceContent = document.getElementById('inference-fields');
    const finetuningContent = document.getElementById('fine-tuning-fields');
    
    // Update tab UI state
    if (mode === 'inference') {
      if (inferenceTab) {
        inferenceTab.classList.add('selected', 'active');
        finetuningTab.classList.remove('selected', 'active');
      }
      
      // Show inference content, hide fine-tuning content
      if (inferenceContent && finetuningContent) {
        inferenceContent.classList.remove('hidden');
        inferenceContent.classList.add('visible');
        finetuningContent.classList.remove('visible');
        finetuningContent.classList.add('hidden');
      }
    } else {
      if (finetuningTab) {
        finetuningTab.classList.add('selected', 'active');
        inferenceTab.classList.remove('selected', 'active');
      }
      
      // Show fine-tuning content, hide inference content
      if (inferenceContent && finetuningContent) {
        finetuningContent.classList.remove('hidden');
        finetuningContent.classList.add('visible');
        inferenceContent.classList.remove('visible');
        inferenceContent.classList.add('hidden');
      }
    }
  }
  
  // Function to format large numbers with commas for readability
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  // Security function to sanitize user input and prevent XSS attacks
  function sanitizeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // Remove any HTML tags and decode HTML entities
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.textContent.trim();
  }
  
  // Security function to validate and sanitize URLs
  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }
    
    try {
      const urlObj = new URL(url);
      // Only allow https URLs from trusted domains
      if (urlObj.protocol === 'https:' && 
          (urlObj.hostname.endsWith('huggingface.co') || 
           urlObj.hostname.endsWith('hf.co') ||
           urlObj.hostname.endsWith('amazonaws.com'))) { // AWS S3 for HF images
        return url;
      }
    } catch (e) {
      // Invalid URL
    }
    
    return ''; // Return empty string for invalid/untrusted URLs
  }
  
  // Function to update the model info UI
  function updateModelInfoUI(modelInfo) {
    if (modelInfo) {
      // Check if we're on a model page
      if (modelInfo.onModelPage === false) {
        // We're not on a model page, show the welcome UI
        showWelcomeUI();
        return;
      }
      
      // We're on a model page, show the model info
      showModelInfoUI();
      
      // Update model name - use textContent to prevent XSS
      if (modelInfo.modelName) {
        const sanitizedModelName = sanitizeText(modelInfo.modelName);
        modelNameElement.innerHTML = `<span></span>`;
        modelNameElement.querySelector('span').textContent = sanitizedModelName;
      } else {
        modelNameElement.innerHTML = `<span class="placeholder-text">Not available</span>`;
      }
      
      // Update developer name - use textContent to prevent XSS
      if (modelInfo.developerName) {
        const sanitizedDeveloperName = sanitizeText(modelInfo.developerName);
        modelDeveloperElement.innerHTML = `<span></span>`;
        modelDeveloperElement.querySelector('span').textContent = sanitizedDeveloperName;
        
        // Show developer logo if available
        const developerLogo = document.getElementById('developer-logo');
        
        // Hide logo by default
        developerLogo.style.display = 'none';
        
        if (modelInfo.developerLogoUrl) {
          // Validate and sanitize the logo URL
          const sanitizedLogoUrl = sanitizeUrl(modelInfo.developerLogoUrl);
          if (sanitizedLogoUrl) {
            // Display the developer logo if URL is valid and from trusted domain
            developerLogo.src = sanitizedLogoUrl;
            developerLogo.alt = sanitizeText(modelInfo.developerName) + ' Logo';
            developerLogo.style.display = 'block';
          }
        }
      } else {
        modelDeveloperElement.innerHTML = `<span class="placeholder-text">Not available</span>`;
        // Hide logo if developer name is not available
        document.getElementById('developer-logo').style.display = 'none';
      }
      
      // Update model size - show both human-readable and exact parameter count
      if (modelInfo.modelSize) {
        const sanitizedModelSize = sanitizeText(modelInfo.modelSize);
        let sizeDisplay = `<span></span>`;
        
        // Add the integer representation if available
        if (modelInfo.modelSizeInt && modelInfo.modelSizeInt > 0) {
          // sizeDisplay += ` <span class="text-gray-500">(${formatNumber(modelInfo.modelSizeInt)} parameters)</span>`;
          sizeDisplay += ``;
        }
        
        modelSizeElement.innerHTML = sizeDisplay;
        modelSizeElement.querySelector('span').textContent = sanitizedModelSize;
      } else {
        modelSizeElement.innerHTML = `<span class="placeholder-text">Not available</span>`;
      }
    }
  }
  
  // Function to show the welcome UI when not on a model page
  function showWelcomeUI() {
    console.log('Showing welcome UI');
    
    // Get references to the model info and calculation cards using the new structure
    const modelInfoCard = document.querySelector('.card:nth-child(2)'); // First card after header
    const calculationCard = document.querySelector('.card:nth-child(3)'); // Second card after header
    const resultsSection = document.getElementById('calc-results');
    const welcomeCard = document.getElementById('welcome-card');
    
    // Debug logs
    console.log('UI Elements:', {
      modelInfoCard: modelInfoCard ? 'found' : 'not found',
      calculationCard: calculationCard ? 'found' : 'not found',
      resultsSection: resultsSection ? 'found' : 'not found',
      welcomeCard: welcomeCard ? 'found' : 'not found',
      allCards: document.querySelectorAll('.card').length + ' cards found'
    });
    
    // Try alternative selectors for cards if the first attempt failed
    if (!modelInfoCard || !calculationCard) {
      const allCards = document.querySelectorAll('.card');
      console.log('Using alternative card selection, found', allCards.length, 'cards');
      
      if (allCards.length >= 2) {
        // Hide all cards
        allCards.forEach((card, index) => {
          if (index > 0) { // Skip the first one if it's the welcome card
            card.style.display = 'none';
          }
        });
      }
    } else {
      // Hide model info and calculation cards
      modelInfoCard.style.display = 'none';
      calculationCard.style.display = 'none';
    }
    
    if (resultsSection) resultsSection.classList.add('hidden');
    
    // If welcome card doesn't exist, create it
    if (!welcomeCard) {
      const newWelcomeCard = document.createElement('div');
      newWelcomeCard.id = 'welcome-card';
      newWelcomeCard.className = 'card animate-fadeIn';
      newWelcomeCard.innerHTML = `
        <div class="card-header">
          <h2 class="card-title">Welcome to VRAM Calculator</h2>
        </div>
        <p style="margin-bottom: 12px;">This extension helps you calculate the GPU VRAM requirements for running AI models.</p>
        <p style="margin-bottom: 12px;">Navigate to any <a href="https://huggingface.co/models" target="_blank" style="color: var(--primary); text-decoration: none; font-weight: 500;">model page on Hugging Face</a> to analyze VRAM needs for inference or fine-tuning.</p>
      `;
      
      // Insert after the header
      const container = document.querySelector('.container');
      const header = document.querySelector('.header');
      
      if (header && header.parentNode) {
        console.log('Inserting welcome card after header');
        // Try to insert at the beginning of the container
        if (container && container.firstChild) {
          container.insertBefore(newWelcomeCard, container.firstChild.nextSibling);
        } else {
          header.parentNode.insertBefore(newWelcomeCard, modelInfoCard || header.nextSibling);
        }
      } else if (container) {
        console.log('Inserting welcome card at the beginning of container');
        container.insertBefore(newWelcomeCard, container.firstChild);
      } else {
        console.log('Fallback: Appending welcome card to body');
        document.body.appendChild(newWelcomeCard);
      }
    } else {
      // Show the welcome card if it exists
      welcomeCard.style.display = 'block';
    }
  }
  
  // Function to show the model info UI when on a model page
  function showModelInfoUI() {
    console.log('Showing model info UI');
    
    // Get references to the model info and calculation cards
    const modelInfoCard = document.querySelector('.card:nth-child(2)'); // First card after header
    const calculationCard = document.querySelector('.card:nth-child(3)'); // Second card after header
    const welcomeCard = document.getElementById('welcome-card');
    
    // Debug logs
    console.log('UI Elements for Model Info:', {
      modelInfoCard: modelInfoCard ? 'found' : 'not found',
      calculationCard: calculationCard ? 'found' : 'not found',
      welcomeCard: welcomeCard ? 'found' : 'not found',
      allCards: document.querySelectorAll('.card').length + ' cards found'
    });
    
    // Try alternative selectors for cards if the first attempt failed
    if (!modelInfoCard || !calculationCard) {
      const allCards = document.querySelectorAll('.card');
      console.log('Using alternative card selection for model UI, found', allCards.length, 'cards');
      
      if (allCards.length >= 2) {
        // Show all cards except welcome card
        allCards.forEach(card => {
          if (card.id !== 'welcome-card') {
            card.style.display = 'block';
          }
        });
      }
    } else {
      // Show model info and calculation cards
      modelInfoCard.style.display = 'block';
      calculationCard.style.display = 'block';
    }
    
    // Hide the welcome card if it exists
    if (welcomeCard) welcomeCard.style.display = 'none';
  }
  
  // Make sure all js files have finished loading
  window.addEventListener('load', () => {
    console.log('Window fully loaded');
    
    // Trigger initial UI check after all scripts are loaded
    chrome.storage.session.get(['modelInfo'], (result) => {
      if (result.modelInfo) {
        // If we have model info, check if we're on a model page
        if (result.modelInfo.onModelPage === false) {
          // If not on a model page, show the welcome UI
          showWelcomeUI();
        } else {
          // If on a model page, show the model info
          updateModelInfoUI(result.modelInfo);
        }
      } else {
        // If no model info, default to welcome UI
        showWelcomeUI();
      }
    });
  });
  
  // Check if this was opened from a deployment or fine-tune request
  chrome.storage.session.get(['deploymentRequest', 'finetuneRequest'], (result) => {
    if (result.deploymentRequest) {
      // Handle the deployment request
      handleTabChange('inference');
      // Clear the flag
      chrome.storage.session.remove(['deploymentRequest']);
    }
    if (result.finetuneRequest) {
      // Handle the fine-tune request
      handleTabChange('fine-tuning');
      // Clear the flag
      chrome.storage.session.remove(['finetuneRequest']);
    }
  });
  
  // Listen for messages from the service worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in side panel:', message);
    
    // Handle close request
    if (message.action === 'closeSidePanel') {
      console.log('Closing side panel');
      // Use window.close() to close the side panel
      window.close();
      return true;
    }
    
    // Handle model info updates
    if (message.action === 'modelInfoUpdated') {
      updateModelInfoUI(message.data);
      sendResponse({ received: true });
    }
    
    // Handle deployment requests
    if (message.action === 'deploymentRequested') {
      handleTabChange('inference');
      sendResponse({ received: true });
    }
    
    // Handle fine-tuning requests
    if (message.action === 'finetuneRequested') {
      handleTabChange('fine-tuning');
      sendResponse({ received: true });
    }
    
    return true;
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
    toggleIcon.innerHTML = detailsContent.classList.contains('expanded') ? '&#8595;' : '&#8594;';
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
    const isReasoning = false; // Default to non-reasoning model for LLMs
    
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
      // Check if this is an extension context invalidated error
      if (error.message && error.message.includes('Extension context invalidated')) {
        alert('The extension context has been invalidated. Please refresh the page and try again.');
      } else {
        alert('Error calculating VRAM requirements. Please check the console for details.');
      }
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
      // Check if this is an extension context invalidated error
      if (error.message && error.message.includes('Extension context invalidated')) {
        alert('The extension context has been invalidated. Please refresh the page and try again.');
      } else {
        alert(error.message || 'Error calculating fine-tuning VRAM requirements. Please check the console for details.');
      }
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
    
    // Add border to results section based on whether it fits
    resultsSection.classList.remove('fit-yes-border', 'fit-no-border');
    resultsSection.classList.add(result.will_it_fit ? 'fit-yes-border' : 'fit-no-border');
    
    // Calculate available VRAM
    const gpuValue = isFinetuning ? 
      document.getElementById('ft-gpu').value : 
      document.getElementById('gpu').value;
    const numGpus = parseInt(isFinetuning ? 
      document.getElementById('ft-number-of-gpus').value : 
      document.getElementById('number-of-gpus').value, 10);
    
    // Get the GPU VRAM size
    let gpuVramGB;
    const gpuSizes = isFinetuning ? FinetuneCalculator.COMMON_GPUS : COMMON_GPUS;
    if (typeof gpuValue === 'string' && gpuSizes[gpuValue] !== undefined) {
      gpuVramGB = gpuSizes[gpuValue];
    } else {
      gpuVramGB = 24.0; // Default to RTX 4090 if invalid
    }
    
    const totalAvailableVram = gpuVramGB * numGpus;
    
    // Update main results
    document.getElementById('will-it-fit').textContent = result.will_it_fit ? 'Yes' : 'No';
    document.getElementById('needed-vram').textContent = `${result.needed_vram} GB`;
    document.getElementById('vram-usage-percent').textContent = `${result.details.vram_usage_percent}%`;
    document.getElementById('available-vram').textContent = `${totalAvailableVram} GB`;
    
    // Update details
    const details = result.details;
    const detailsContent = document.getElementById('details-content');
    
    let detailsHtml = '';
    
    // Common core components for both modes
    detailsHtml += `
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
  
  // Initialize tab switcher and ensure it's compatible with mode-switcher.js
  function initializeTabSwitcher() {
    console.log('Initializing tab switcher');
    
    // Try both selectors for maximum compatibility with different versions
    const tabElements = document.querySelectorAll('.tab[data-mode], .mode-option[data-mode]');
    
    if (tabElements && tabElements.length > 0) {
      console.log(`Found ${tabElements.length} tab elements`);
      
      // Make sure the tab click events use our logic for handling model page state
      tabElements.forEach(tab => {
        // Replace any existing click handlers by using a new clone of the element
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('click', () => {
          const mode = newTab.getAttribute('data-mode');
          console.log(`Tab clicked: ${mode}`);
          
          // Check if we're on a model page before showing the tab
          chrome.storage.session.get(['modelInfo'], (result) => {
            if (result.modelInfo && result.modelInfo.onModelPage === false) {
              // If not on a model page, don't change anything, just keep showing welcome message
              showWelcomeUI();
            } else {
              // If on a model page, switch to the selected tab
              handleTabChange(mode);
              
              // Also call the window.switchMode function if it exists (from mode-switcher.js)
              if (typeof window.switchMode === 'function') {
                window.switchMode(mode);
              }
            }
          });
        });
      });
    } else {
      console.warn('No tab elements found for initialization');
    }
  }
  
  // Call tab initialization after window load
  window.addEventListener('load', () => {
    // Wait a bit to ensure all other scripts have loaded and initialized their event handlers
    setTimeout(initializeTabSwitcher, 100);
  });
});