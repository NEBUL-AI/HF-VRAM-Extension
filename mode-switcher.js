// mode-switcher.js - Handles the switching between inference and fine-tuning modes

console.log('mode-switcher.js loaded');

// Function to switch between inference and fine-tuning modes
function switchMode(mode) {
  console.log('switchMode called with mode:', mode);
  
  // Update selected tab UI
  document.querySelectorAll('.mode-option').forEach(el => {
    if (el.getAttribute('data-mode') === mode) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
  
  // Get the field containers
  const inferenceFields = document.getElementById('inference-fields');
  const finetuningFields = document.getElementById('fine-tuning-fields');
  
  // Toggle fields visibility using classes
  if (mode === 'inference') {
    inferenceFields.classList.remove('hidden');
    inferenceFields.classList.add('visible');
    finetuningFields.classList.remove('visible');
    finetuningFields.classList.add('hidden');
  } else {
    inferenceFields.classList.remove('visible');
    inferenceFields.classList.add('hidden');
    finetuningFields.classList.remove('hidden');
    finetuningFields.classList.add('visible');
  }
  
  console.log('Mode switch completed to:', mode);
}

// Function to handle fine-tuning method changes
function handleFinetuningMethodChange(method) {
  console.log('Fine-tuning method changed to:', method);
  
  // Get the LoRA rank input group
  const loraRankGroup = document.getElementById('lora-rank').closest('.input-group');
  
  // Show/hide fields based on the selected method
  if (method === 'lora' || method === 'qlora') {
    // Show LoRA-specific fields
    if (loraRankGroup) loraRankGroup.classList.remove('hidden');
  } else {
    // Hide LoRA-specific fields for other methods
    if (loraRankGroup) loraRankGroup.classList.add('hidden');
  }
}

// Initialize event listeners when the page is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded in mode-switcher.js');
  
  // Add click event listeners to the mode options
  const modeOptions = document.querySelectorAll('.mode-option');
  console.log('Found mode options:', modeOptions.length);
  
  modeOptions.forEach(el => {
    const mode = el.getAttribute('data-mode');
    console.log('Setting up listener for mode:', mode);
    
    el.addEventListener('click', function() {
      console.log('Mode option clicked:', mode);
      switchMode(mode);
    });
  });
  
  // Set up fine-tuning method dropdown listener
  const finetuningMethodDropdown = document.getElementById('fine-tuning-method');
  if (finetuningMethodDropdown) {
    finetuningMethodDropdown.addEventListener('change', function() {
      handleFinetuningMethodChange(this.value);
    });
    
    // Initialize the visibility based on the default selection
    handleFinetuningMethodChange(finetuningMethodDropdown.value);
  }
  
  console.log('All mode option listeners set up');
});