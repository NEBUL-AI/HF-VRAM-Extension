// Content script to add "Nebul" option to Hugging Face navbar
(function() {
    // Function to inject our colors CSS
    function injectColorsCSS() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('colors.css');
        document.head.appendChild(link);
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
        
        return { modelName, modelSize, modelSizeInt };
    }
    
    // Function to send model info to the side panel
    function sendModelInfoToSidePanel() {
        const modelInfo = extractModelInfo();
        if (modelInfo.modelName || modelInfo.modelSize) {
            chrome.runtime.sendMessage({ 
                action: 'updateModelInfo', 
                data: modelInfo 
            });
            console.log('Sent model info to side panel:', modelInfo);
        }
    }

    // Function to add the Nebul option
    function addNebulToNavbar() {
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
                nebulItem.innerHTML = `
                    <a class="group flex items-center px-2 py-0.5 dark:text-gray-300 dark:hover:text-gray-100 cursor-pointer nebul-nav-link" href="#">
                        <img src="${chrome.runtime.getURL('images/icon-128.png')}" class="mr-1.5 w-4 h-4" alt="Nebul">
                        Nebul
                    </a>
                `;

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
                    // Send message to background service worker to open the side panel
                    chrome.runtime.sendMessage({ action: 'openSidePanel' });
                    console.log('Requested to open Nebul side panel');
                });
                
                // Insert the Nebul item after the Pricing item
                pricingItem.after(nebulItem);
                console.log('Nebul option added to navbar');
            }
        }
    }
    
    // Function to check periodically if the navbar exists
    function checkAndAddNebul() {
        if (document.querySelector('nav[aria-label="Main"] ul')) {
            injectColorsCSS();
            addNebulToNavbar();
            // Extract and send model info after adding Nebul to navbar
            sendModelInfoToSidePanel();
        } else {
            // Try again if navbar isn't loaded yet
            setTimeout(checkAndAddNebul, 500);
        }
    }
    
    // Check if URL contains huggingface.co or hf.co
    if (window.location.hostname.includes('huggingface.co') || 
        window.location.hostname.includes('hf.co')) {
        
        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAndAddNebul);
        } else {
            checkAndAddNebul();
        }
        
        // Also observe DOM changes to handle SPA navigation and update model info
        const observer = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    // Don't run too frequently - debounce using a timeout
                    if (!window.nebulObserverTimeout) {
                        window.nebulObserverTimeout = setTimeout(() => {
                            checkAndAddNebul();
                            // Also check and send model info separately in case the page content updates
                            sendModelInfoToSidePanel();
                            window.nebulObserverTimeout = null;
                        }, 500);
                    }
                }
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})(); 