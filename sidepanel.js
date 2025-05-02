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
});