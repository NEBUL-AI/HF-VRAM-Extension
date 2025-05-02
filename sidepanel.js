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
  
  // You can add event listeners for any interactive elements in the side panel here
  
  // Example: Send a message to the current tab/page
  function sendMessageToPage(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message)
          .then(response => {
            console.log('Response from page:', response);
          })
          .catch(error => {
            console.error('Error sending message to page:', error);
          });
      }
    });
  }
  
  // Example: Listen for messages from the content script or service worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in side panel:', message);
    
    // Add your message handling logic here
    
    // Example response
    sendResponse({ received: true });
    return true; // Keep the messaging channel open for async responses
  });
  
  // You can add functions to interact with Hugging Face API or other services here
});