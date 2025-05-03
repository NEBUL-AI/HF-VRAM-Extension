// Ensure calculator functions are available
document.addEventListener('DOMContentLoaded', function() {
  // Check if inference calculator is loaded
  if (typeof calculateVramRequirements !== 'function') {
    console.error('Inference calculator not loaded properly');
  } else {
    console.log('Inference calculator loaded successfully');
  }
  
  // Check if fine-tuning calculator is loaded
  if (typeof FinetuneCalculator === 'undefined' || 
      typeof FinetuneCalculator.calculateFinetuningRequirements !== 'function') {
    console.error('Fine-tuning calculator not loaded properly');
  } else {
    // Ensure the global function is assigned
    window.calculateFinetuningRequirements = FinetuneCalculator.calculateFinetuningRequirements;
    console.log('Fine-tuning calculator loaded successfully');
  }

  // Add click event listener for the calculate button
  const calculateButton = document.getElementById('calculate-button');
  if (calculateButton) {
    calculateButton.addEventListener('click', function() {
      // Button click logic here
    });
  }

  // Update the sequence length display value
  const sequenceLengthSlider = document.getElementById('sequence-length');
  const sequenceLengthValue = document.getElementById('sequence-length-value');
  
  if (sequenceLengthSlider && sequenceLengthValue) {
    sequenceLengthSlider.addEventListener('input', function() {
      sequenceLengthValue.textContent = this.value;
    });
  }
  
  // Update the dataset size display value
  const datasetSizeSlider = document.getElementById('dataset-size');
  const datasetSizeValue = document.getElementById('dataset-size-value');
  
  if (datasetSizeSlider && datasetSizeValue) {
    datasetSizeSlider.addEventListener('input', function() {
      datasetSizeValue.textContent = this.value;
    });
  }
  
  console.log('Slider initialization complete');
}); 