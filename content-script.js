// Content script to add "Nebul" option to Hugging Face navbar
(function() {
    // Helper function to check if extension context is valid
    function isExtensionContextValid() {
        try {
            chrome.runtime.getURL('');
            return true;
        } catch (e) {
            console.error('Extension context invalid:', e);
            return false;
        }
    }

    // Function to inject our colors CSS
    function injectColorsCSS() {
        try {
            if (!isExtensionContextValid()) return;
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = chrome.runtime.getURL('colors.css');
            document.head.appendChild(link);
        } catch (error) {
            console.error('Error injecting colors CSS:', error);
            // We'll silently fail here since this is non-critical functionality
        }
    }

    // Function to convert model size string to integer number of parameters
    function convertModelSizeToInt(sizeString) {
        if (!sizeString) return 0;
        
        // Extract numeric value and unit (e.g., "235B params" -> "235" and "B")
        const match = sizeString.match(/(\d+\.?\d*)([KMBTkmbt])?/);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = (match[2] || '').toUpperCase();
        
        // Convert based on unit
        let result;
        switch (unit) {
            case 'K':
                result = value * 1000;
                break;
            case 'M':
                result = value * 1000000;
                break;
            case 'B':
                result = value * 1000000000;
                break;
            case 'T':
                result = value * 1000000000000;
                break;
            default:
                result = value;
        }
        
        // Return as integer (round to nearest whole number)
        return Math.round(result);
    }

    // Function to extract model information from the page
    function extractModelInfo() {
        // Extract model name based on the exact HTML structure provided
        let modelName = '';
        const modelNameElement = document.querySelector('h1 div.max-w-full a.font-mono.font-semibold');
        if (modelNameElement) {
            modelName = modelNameElement.textContent.trim();
        }
        
        // Extract developer name based on the example HTML structure
        let developerName = '';
        // Try to find the developer using the class structure from the example
        const developerElement = document.querySelector('h1 div.group.flex.flex-none.items-center a[href^="/"]');
        if (developerElement) {
            developerName = developerElement.textContent.trim();
        }
        
        // Extract developer logo image URL
        let developerLogoUrl = '';
        // Try to find the developer logo image from the example structure
        const developerLogoElement = document.querySelector('h1 div.group.flex.flex-none.items-center img');
        if (developerLogoElement && developerLogoElement.src) {
            developerLogoUrl = developerLogoElement.src;
        }
        
        // Fallback approach if the first method doesn't work
        if (!developerName) {
            // Look for links that look like organization links
            const possibleDevElements = document.querySelectorAll('h1 a[href^="/"]');
            for (const elem of possibleDevElements) {
                // Skip if it contains the model name (likely not the org)
                if (elem.textContent.includes('/')) continue;
                
                // Get the developer name
                developerName = elem.textContent.trim();
                // Try to find an associated image
                if (developerName && !developerLogoUrl) {
                    const img = elem.querySelector('img');
                    if (img && img.src) {
                        developerLogoUrl = img.src;
                    }
                }
                if (developerName) break;
            }
        }
        
        // Extract from URL path as a final fallback
        if (!developerName) {
            const urlPath = window.location.pathname;
            // URL format is typically /{organization}/{model-name}
            const pathParts = urlPath.split('/').filter(part => part.trim() !== '');
            if (pathParts.length >= 2) {
                developerName = pathParts[0];
            }
        }
        
        // Extract model size (number of parameters) based on the exact HTML structure provided
        let modelSize = '';
        let modelSizeInt = 0;
        const modelSizeElements = document.querySelectorAll('.flex.flex-wrap.gap-x-1\\.5.gap-y-1 .inline-flex.h-6');
        if (modelSizeElements && modelSizeElements.length > 0) {
            modelSizeElements.forEach(element => {
                const labelDiv = element.querySelector('.border-r.px-2.text-gray-500');
                if (labelDiv && labelDiv.textContent.trim() === 'Model size') {
                    const sizeDiv = element.querySelector('div.px-1\\.5');
                    if (sizeDiv) {
                        modelSize = sizeDiv.textContent.trim();
                        modelSizeInt = convertModelSizeToInt(modelSize);
                    }
                }
            });
        }
        
        // Attempt more thorough parameter extraction for better accuracy
        if (modelSizeInt === 0) {
            // Look in model name for patterns like "llama-7b" or "t5-3b"
            if (modelName) {
                const modelNameMatch = modelName.toLowerCase().match(/[-_](\d+)b\b/);
                if (modelNameMatch) {
                    modelSizeInt = parseFloat(modelNameMatch[1]) * 1000000000;
                    if (!modelSize) {
                        modelSize = `${modelNameMatch[1]}B`;
                    }
                }
            }
            
            // Look in page tags for parameter information
            const tagElements = document.querySelectorAll('.inline-flex.h-6');
            tagElements.forEach(tagElem => {
                const tagText = tagElem.textContent.toLowerCase();
                if (tagText.includes('param') && !tagText.includes('model size')) {
                    const paramMatch = tagText.match(/(\d+\.?\d*)([kmbt])?/i);
                    if (paramMatch) {
                        const value = parseFloat(paramMatch[1]);
                        const unit = (paramMatch[2] || '').toLowerCase();
                        
                        switch (unit) {
                            case 'k':
                                modelSizeInt = value * 1000;
                                if (!modelSize) modelSize = `${value}K`;
                                break;
                            case 'm':
                                modelSizeInt = value * 1000000;
                                if (!modelSize) modelSize = `${value}M`;
                                break;
                            case 'b':
                                modelSizeInt = value * 1000000000;
                                if (!modelSize) modelSize = `${value}B`;
                                break;
                            case 't':
                                modelSizeInt = value * 1000000000000;
                                if (!modelSize) modelSize = `${value}T`;
                                break;
                            default:
                                modelSizeInt = value;
                                if (!modelSize) modelSize = `${value}`;
                        }
                    }
                }
            });
        }
        
        // If still not found, try to extract from the model description
        if (modelSizeInt === 0) {
            const descriptionElement = document.querySelector('.prose');
            if (descriptionElement) {
                const descText = descriptionElement.textContent.toLowerCase();
                const paramMatches = descText.match(/(\d+\.?\d*)[\s-]?([kmbt])[\s-]?(?:illion)?[\s-]?param/i);
                if (paramMatches) {
                    const value = parseFloat(paramMatches[1]);
                    const unit = paramMatches[2].toLowerCase();
                    
                    switch (unit) {
                        case 'k':
                            modelSizeInt = value * 1000;
                            if (!modelSize) modelSize = `${value}K`;
                            break;
                        case 'm':
                            modelSizeInt = value * 1000000;
                            if (!modelSize) modelSize = `${value}M`;
                            break;
                        case 'b':
                            modelSizeInt = value * 1000000000;
                            if (!modelSize) modelSize = `${value}B`;
                            break;
                        case 't':
                            modelSizeInt = value * 1000000000000;
                            if (!modelSize) modelSize = `${value}T`;
                            break;
                    }
                }
            }
        }
        
        return { modelName, modelSize, modelSizeInt, developerName, developerLogoUrl };
    }
    
    // Function to send model info to the side panel
    function sendModelInfoToSidePanel() {
        try {
            if (!isExtensionContextValid()) return;
            
            const modelInfo = extractModelInfo();
            if (modelInfo.modelName || modelInfo.modelSize) {
                chrome.runtime.sendMessage({ 
                    action: 'updateModelInfo', 
                    data: modelInfo 
                });
                console.log('Sent model info to side panel:', modelInfo);
            }
        } catch (error) {
            console.error('Error sending model info to side panel:', error);
        }
    }

    // Function to add the Nebul option
    function addNebulToNavbar() {
        try {
            if (!isExtensionContextValid()) return;

            // Look for the navbar <ul> that contains the navigation items
            const navbarUl = document.querySelector('nav[aria-label="Main"] ul');
            
            if (navbarUl) {
                // Find the pricing <li> element
                const navItems = navbarUl.querySelectorAll('li');
                let pricingItem = null;
                
                for (let i = 0; i < navItems.length; i++) {
                    const item = navItems[i];
                    const link = item.querySelector('a');
                    if (link && link.textContent === 'Pricing') {
                        pricingItem = item;
                        break;
                    }
                }
                if (pricingItem && !document.querySelector('.nebul-nav-item')) {
                    // Create new Nebul <li> element
                    const nebulItem = document.createElement('li');
                    nebulItem.className = 'nebul-nav-item';
                    
                    // Create a styled link to match the Hugging Face navbar style
                    try {
                        nebulItem.innerHTML = `
                            <a class="group flex items-center px-2 py-0.5 dark:text-gray-300 dark:hover:text-gray-100 cursor-pointer nebul-nav-link" href="#">
                                <img src="${chrome.runtime.getURL('images/icon-128.png')}" class="mr-1.5 w-4 h-4" alt="Nebul">
                                Nebul
                            </a>
                        `;
                    } catch (error) {
                        console.error('Error getting extension resource URL:', error);
                        return;
                    }

                    // Add our custom style for the hover effect
                    const style = document.createElement('style');
                    style.textContent = `
                        .nebul-nav-link:hover {
                            color: var(--pulse-red) !important;
                        }
                    `;
                    document.head.appendChild(style);
                    
                    // Add click event listener to open the side panel
                    nebulItem.addEventListener('click', (e) => {
                        e.preventDefault();
                        try {
                            // Send message to background service worker to open the side panel
                            if (isExtensionContextValid()) {
                                chrome.runtime.sendMessage({ action: 'openSidePanel' });
                                console.log('Requested to open Nebul side panel');
                            }
                        } catch (error) {
                            console.error('Error sending message to open side panel:', error);
                        }
                    });
                    
                    // Insert the Nebul item after the Pricing item
                    pricingItem.after(nebulItem);
                    console.log('Nebul option added to navbar');
                }
            }
        } catch (error) {
            console.error('Error in addNebulToNavbar:', error);
        }
    }
    
    // Function to add Nebul option to the deploy dropdown
    function addNebulToDeployDropdown() {
        try {
            if (!isExtensionContextValid()) return;
            
            // Check if the deploy dropdown exists and if our option hasn't been added yet
            const deployDropdown = document.querySelector('.absolute.top-full.z-20.mt-1.w-auto.min-w-0.max-w-xs.overflow-hidden.rounded-xl.border.border-gray-100.bg-white.shadow-lg');
            
            if (deployDropdown && !deployDropdown.querySelector('.nebul-deploy-option')) {
                // Find the list of deployment options
                const deployList = deployDropdown.querySelector('ul dl');
                
                if (deployList) {
                    try {
                        // Determine if this is a train dropdown or deploy dropdown based on content
                        const isTrainDropdown = deployList.classList.contains('space-y-2');
                        
                        // Create a new div container for our option (similar to existing options)
                        const nebulOptionContainer = document.createElement('div');
                        nebulOptionContainer.className = isTrainDropdown ? '' : 'my-2 px-3.5';
                        
                        // Create the list item for Nebul
                        const nebulOption = document.createElement('li');
                        nebulOption.className = 'nebul-deploy-option';
                        
                        // Different styling for train vs deploy dropdown
                        if (isTrainDropdown) {
                            try {
                                // Set the inner HTML with styling matching the train dropdown options
                                nebulOption.innerHTML = `
                                    <button class="flex w-full cursor-pointer items-center whitespace-nowrap px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg border py-2! px-3.5! hover:bg-gray-50! border-gray-100 dark:hover:bg-gray-900! leading-tight">
                                        <div class="flex w-full items-center gap-3.5">
                                            <img src="${chrome.runtime.getURL('images/icon-128.png')}" class="text-2xl w-6 h-6" alt="Nebul">
                                            <div class="w-full">
                                                <dt class="flex items-center">
                                                    <span class="text-base font-semibold leading-snug text-gray-800">Nebul</span>
                                                    <span class="ml-auto mr-2 rounded-sm bg-blue-500/10 px-1.5 py-0.5 text-[.6rem] font-semibold leading-tight text-blue-700 dark:bg-blue-500/30 dark:text-blue-200">NEW</span>
                                                </dt>
                                                <dd class="whitespace-pre-wrap text-sm text-gray-400">Fine-tune on optimized GPU infrastructure</dd>
                                            </div>
                                        </div>
                                    </button>
                                `;
                            } catch (error) {
                                console.error('Error getting resource URL for train dropdown:', error);
                                return;
                            }
                            
                            // Add train-specific styling to match other items
                            const style = document.createElement('style');
                            style.textContent = `
                                .nebul-deploy-option {
                                    width: 100%;
                                }
                            `;
                            document.head.appendChild(style);
                            
                            // Add click event listener for fine-tuning tab
                            nebulOption.addEventListener('click', (e) => {
                                e.preventDefault();
                                try {
                                    if (isExtensionContextValid()) {
                                        // Open side panel with fine-tuning request
                                        chrome.runtime.sendMessage({ 
                                            action: 'openSidePanel',
                                            data: { finetuneRequest: true }
                                        });
                                        console.log('Nebul fine-tuning option clicked');
                                    }
                                } catch (error) {
                                    console.error('Error sending fine-tune message:', error);
                                }
                            });
                        } else {
                            try {
                                // Set the inner HTML with styling matching the deploy dropdown options
                                nebulOption.innerHTML = `
                                    <button class="flex w-full cursor-pointer items-center whitespace-nowrap px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg border py-2! px-3.5! hover:bg-gray-50! border-gray-100 dark:hover:bg-gray-900! leading-tight">
                                        <div class="flex w-full items-center gap-3.5">
                                            <img src="${chrome.runtime.getURL('images/icon-128.png')}" class="text-2xl w-6 h-6" alt="Nebul">
                                            <div class="w-full">
                                                <dt class="flex items-center">
                                                    <span class="text-base font-semibold leading-snug text-gray-800">Nebul</span>
                                                    <span class="ml-auto mr-2 rounded-sm bg-blue-500/10 px-1.5 py-0.5 text-[.6rem] font-semibold leading-tight text-blue-700 dark:bg-blue-500/30 dark:text-blue-200">NEW</span>
                                                </dt>
                                                <dd class="whitespace-pre-wrap text-sm text-gray-400">Deploy on optimized GPU infrastructure</dd>
                                            </div>
                                        </div>
                                    </button>
                                `;
                            } catch (error) {
                                console.error('Error getting resource URL for deploy dropdown:', error);
                                return;
                            }
                            
                            // Add click event listener for deployment
                            nebulOption.addEventListener('click', (e) => {
                                e.preventDefault();
                                try {
                                    if (isExtensionContextValid()) {
                                        // Open side panel with deployment info
                                        chrome.runtime.sendMessage({ 
                                            action: 'openSidePanel',
                                            data: { deploymentRequest: true }
                                        });
                                        console.log('Nebul deployment option clicked');
                                    }
                                } catch (error) {
                                    console.error('Error sending deployment message:', error);
                                }
                            });
                        }
                        
                        // Add the option to the container and the container to the dropdown list
                        if (isTrainDropdown) {
                            // For train dropdown, add directly to the list
                            deployList.appendChild(nebulOption);
                        } else {
                            // For deploy dropdown, use the container approach
                            nebulOptionContainer.appendChild(nebulOption);
                            
                            // Insert after the first option (before the divider)
                            const firstDivider = deployList.querySelector('.my-2.h-px.w-full.border-none.bg-gray-100');
                            if (firstDivider) {
                                deployList.insertBefore(nebulOptionContainer, firstDivider);
                            } else {
                                // If no divider found, just append to the list
                                deployList.appendChild(nebulOptionContainer);
                            }
                        }
                        
                        console.log(`Nebul option added to ${isTrainDropdown ? 'train' : 'deploy'} dropdown`);
                    } catch (error) {
                        console.error('Error handling dropdown content:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error in addNebulToDeployDropdown:', error);
        }
    }
    
    // Function to monitor for deploy button clicks and dropdown appearance
    function monitorDeployDropdown() {
        // Watch for DOM changes to catch when the dropdown appears
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    // Check for the dropdown
                    const deployDropdown = document.querySelector('.absolute.top-full.z-20.mt-1.w-auto.min-w-0.max-w-xs.overflow-hidden.rounded-xl.border.border-gray-100.bg-white.shadow-lg');
                    if (deployDropdown) {
                        // Add our option to the dropdown
                        addNebulToDeployDropdown();
                    }
                }
            });
        });
        
        // Observe the entire body for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Also check immediately in case dropdown is already visible
        addNebulToDeployDropdown();
    }
    
    // Function to check periodically if the navbar exists
    function checkAndAddNebul() {
        try {
            if (document.querySelector('nav[aria-label="Main"] ul')) {
                injectColorsCSS();
                addNebulToNavbar();
                // Extract and send model info after adding Nebul to navbar
                sendModelInfoToSidePanel();
                
                // Start monitoring for deploy dropdown
                monitorDeployDropdown();
            } else {
                // Try again if navbar isn't loaded yet
                setTimeout(checkAndAddNebul, 500);
            }
        } catch (error) {
            console.error('Error in checkAndAddNebul:', error);
        }
    }
    
    // Check if URL contains huggingface.co or hf.co
    try {
        if (window.location.hostname.includes('huggingface.co') || 
            window.location.hostname.includes('hf.co')) {
            
            // Wait for page to load
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkAndAddNebul);
            } else {
                checkAndAddNebul();
            }
            
            // Also observe DOM changes to handle SPA navigation and update model info
            try {
                const observer = new MutationObserver(function(mutations) {
                    try {
                        for (const mutation of mutations) {
                            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                                // Don't run too frequently - debounce using a timeout
                                if (!window.nebulObserverTimeout) {
                                    window.nebulObserverTimeout = setTimeout(() => {
                                        try {
                                            checkAndAddNebul();
                                            // Also check and send model info separately in case the page content updates
                                            sendModelInfoToSidePanel();
                                            window.nebulObserverTimeout = null;
                                        } catch (error) {
                                            console.error('Error in observer timeout callback:', error);
                                            window.nebulObserverTimeout = null;
                                        }
                                    }, 500);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error in mutation observer callback:', error);
                    }
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            } catch (error) {
                console.error('Error setting up main page observer:', error);
            }
        }
    } catch (error) {
        console.error('Error in initial extension setup:', error);
    }
})(); 