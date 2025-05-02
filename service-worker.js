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

// Listen for tab updates to inject our script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && 
      (tab.url.includes('huggingface.co') || tab.url.includes('hf.co'))) {
    
    // Inject our script to ensure it runs
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content-script.js']
    })
    .catch(err => console.error('Error injecting content script:', err));
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle opening the side panel
  if (message.action === 'openSidePanel') {
    // Open the side panel for the tab that sent the message
    chrome.sidePanel.open({ tabId: sender.tab.id })
      .then(() => {
        console.log('Side panel opened successfully');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Error opening side panel:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  // Handle model info updates
  if (message.action === 'updateModelInfo') {
    // Store the model info in session storage for the sidepanel to access
    chrome.storage.session.set({ modelInfo: message.data });
    
    // If sender is a tab and the sidepanel is open, forward the message to the sidepanel
    if (sender.tab) {
      chrome.runtime.sendMessage({
        action: 'modelInfoUpdated',
        data: message.data,
        sourceTabId: sender.tab.id
      }).catch(err => {
        // This error is expected if sidepanel is not open yet, so we just log it
        console.log('Could not send to sidepanel directly, data is stored in session storage');
      });
    }
    
    sendResponse({ success: true });
    return true;
  }
});