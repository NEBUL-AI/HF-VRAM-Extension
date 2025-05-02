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

function setupContextMenu() {
    chrome.contextMenus.create({
      id: 'define-word',
      title: 'Define',
      contexts: ['selection']
    });
  }
  
  chrome.runtime.onInstalled.addListener(() => {
    setupContextMenu();
  });
  
  chrome.contextMenus.onClicked.addListener((data, tab) => {
    // Store the last word in chrome.storage.session.
    chrome.storage.session.set({ lastWord: data.selectionText });
  
    // Make sure the side panel is open.
    chrome.sidePanel.open({ tabId: tab.id });
  });

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
  });