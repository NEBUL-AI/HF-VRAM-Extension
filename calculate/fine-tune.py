#!/usr/bin/env python3
"""
LLM Fine-Tuning VRAM Calculator

This script calculates the VRAM requirements for fine-tuning Large Language Models
using different methods (full fine-tuning, LoRA, QLoRA).

Input parameters:
- Parameter count (billions)
- Fine-tuning method (full, LoRA, QLoRA)
- GPU VRAM
- Number of GPUs
- Batch size
- Sequence length

Output:
- Whether fine-tuning is possible with the given configuration
- Required VRAM
- Detailed breakdown of memory usage components
"""

import json
from typing import Dict, Tuple, Union, List, Any


# Default architectures mapping - parameters to hidden dimensions and layers
DEFAULT_ARCHITECTURES = {
    "1B": {"hidden_dim": 2048, "num_layers": 22},
    "3B": {"hidden_dim": 3072, "num_layers": 26},
    "7B": {"hidden_dim": 4096, "num_layers": 32},
    "13B": {"hidden_dim": 5120, "num_layers": 40},
    "30B": {"hidden_dim": 7168, "num_layers": 60},
    "65B": {"hidden_dim": 8192, "num_layers": 80},
    "120B": {"hidden_dim": 12288, "num_layers": 96},
    "405B": {"hidden_dim": 16384, "num_layers": 120},
    "671B": {"hidden_dim": 20480, "num_layers": 160},
}

# Bytes per parameter for different precision/quantization levels
PRECISION_BYTES = {
    "FP32": 4.0,
    "FP16": 2.0,
    "BF16": 2.0,
    "INT8": 1.0,
    "INT4": 0.5,
}

# Common GPU VRAM sizes in GB
COMMON_GPUS = {
    "RTX 3060": 12,
    "RTX 3070": 8,
    "RTX 3080": 10,
    "RTX 3090": 24,
    "RTX 4060": 8,
    "RTX 4070": 12,
    "RTX 4080": 16,
    "RTX 4090": 24,
    "RTX 6000": 48,
    "A100-40G": 40,
    "A100-80G": 80,
    "H100": 80,
    "H200": 141,
}

# Fine-tuning method configurations
FINETUNING_METHODS = {
    "full": {
        "description": "Full fine-tuning of all model parameters",
        "model_weight_precision": "FP16",  # Typical precision for model weights
        "optimizer_states_factor": 4.0,  # Factor for Adam optimizer states (4x weights)
        "activation_factor": 2.0,  # Activations for full training
        "gradient_checkpointing": False,  # If gradient checkpointing is used by default
    },
    "lora": {
        "description": "Low-Rank Adaptation with adapter modules",
        "model_weight_precision": "FP16",  # Base model precision
        "optimizer_states_factor": 0.1,  # Much smaller optimizer states (only adapters)
        "activation_factor": 1.0,  # Reduced activations due to freezing
        "gradient_checkpointing": True,  # Gradient checkpointing often used
        "adapter_overhead": 0.05,  # 5% overhead for adapter modules
    },
    "qlora": {
        "description": "Quantized Low-Rank Adaptation with 4-bit quantization",
        "model_weight_precision": "INT4",  # Quantized base model
        "optimizer_states_factor": 0.1,  # Only adapter modules are optimized
        "activation_factor": 0.5,  # Further reduced activations
        "gradient_checkpointing": True,  # Almost always used
        "adapter_overhead": 0.05,  # 5% overhead for adapter modules
    },
}


def get_closest_architecture(params_billions: float) -> str:
    """
    Get the closest architecture based on parameter count.

    Args:
        params_billions: Number of parameters in billions

    Returns:
        String key for the closest architecture in DEFAULT_ARCHITECTURES
    """
    # Sort architectures by parameter count
    sorted_archs = sorted(
        DEFAULT_ARCHITECTURES.keys(), key=lambda x: float(x.rstrip("B"))
    )

    # Find the first architecture that is >= the target
    for arch in sorted_archs:
        if float(arch.rstrip("B")) >= params_billions:
            return arch

    # If none found, return the largest
    return sorted_archs[-1]


def get_architecture_details(params_billions: float) -> Tuple[int, int]:
    """
    Get the hidden dimension and number of layers for a parameter count.

    Args:
        params_billions: Number of parameters in billions

    Returns:
        Tuple of (hidden_dim, num_layers)
    """
    closest_arch = get_closest_architecture(params_billions)
    return (
        DEFAULT_ARCHITECTURES[closest_arch]["hidden_dim"],
        DEFAULT_ARCHITECTURES[closest_arch]["num_layers"],
    )


def calculate_model_weights(num_params: float, precision: str) -> float:
    """
    Calculate memory required for model weights.

    Args:
        num_params: Number of parameters in billions
        precision: Precision/quantization level

    Returns:
        Memory in GB
    """
    bytes_per_param = PRECISION_BYTES[precision]
    return num_params * bytes_per_param


def calculate_activation_memory(
    model_weights: float, activation_factor: float
) -> float:
    """
    Calculate memory required for activations during training.

    Args:
        model_weights: Size of model weights in GB
        activation_factor: Multiplier for activations based on training method

    Returns:
        Memory in GB
    """
    return model_weights * activation_factor


def calculate_optimizer_states(model_weights: float, optimizer_factor: float) -> float:
    """
    Calculate memory required for optimizer states.

    Args:
        model_weights: Size of model weights in GB
        optimizer_factor: Multiplier for optimizer states based on training method

    Returns:
        Memory in GB
    """
    return model_weights * optimizer_factor


def calculate_gradient_accumulation_reduction(
    batch_size: int, grad_accum_steps: int = 1
) -> float:
    """
    Calculate the memory reduction factor from gradient accumulation.

    Args:
        batch_size: Original batch size
        grad_accum_steps: Number of gradient accumulation steps

    Returns:
        Reduction factor for batch size
    """
    effective_batch_size = batch_size / grad_accum_steps
    return effective_batch_size / batch_size


def calculate_kv_cache(
    hidden_dim: int, num_layers: int, batch_size: int, seq_length: int, precision: str
) -> float:
    """
    Calculate memory required for KV cache.

    Args:
        hidden_dim: Hidden dimension size
        num_layers: Number of layers
        batch_size: Batch size
        seq_length: Sequence length
        precision: Precision used

    Returns:
        Memory in GB
    """
    bytes_per_element = PRECISION_BYTES[precision]

    # 2 is for Key and Value tensors
    kv_cache_per_token = (hidden_dim * 2 * bytes_per_element * num_layers) / 10**9

    return batch_size * seq_length * kv_cache_per_token


def calculate_gradient_checkpointing_savings(activation_memory: float) -> float:
    """
    Calculate memory savings from gradient checkpointing.

    Args:
        activation_memory: Original activation memory in GB

    Returns:
        Reduced activation memory in GB
    """
    # Gradient checkpointing typically reduces activation memory by ~75%
    return activation_memory * 0.25  # Keep only 25% of original


def calculate_total_training_vram(
    model_weights: float,
    activation_memory: float,
    optimizer_states: float,
    kv_cache: float,
    adapter_overhead: float = 0.0,
    use_gradient_checkpointing: bool = False,
) -> float:
    """
    Calculate total VRAM required for training.

    Args:
        model_weights: Size of model weights in GB
        activation_memory: Size of activation memory in GB
        optimizer_states: Size of optimizer states in GB
        kv_cache: Size of KV cache in GB
        adapter_overhead: Additional memory for adapter modules in GB
        use_gradient_checkpointing: Whether gradient checkpointing is used

    Returns:
        Total VRAM in GB
    """
    # Apply gradient checkpointing savings if enabled
    if use_gradient_checkpointing:
        activation_memory = calculate_gradient_checkpointing_savings(activation_memory)

    # Calculate base VRAM
    base_vram = model_weights + activation_memory + optimizer_states + kv_cache

    # Add adapter overhead if using adapter-based methods
    if adapter_overhead > 0:
        adapter_memory = model_weights * adapter_overhead
        base_vram += adapter_memory

    # Apply overhead factor for training (typically higher than inference)
    overhead_factor = 1.2  # 20% overhead for training

    return base_vram * overhead_factor


def will_model_fit(total_vram: float, gpu_vram: float, num_gpus: int = 1) -> bool:
    """
    Determine if the model will fit in GPU memory.

    Args:
        total_vram: Total VRAM required in GB
        gpu_vram: VRAM per GPU in GB
        num_gpus: Number of GPUs

    Returns:
        Boolean indicating if model will fit
    """
    available_vram = gpu_vram * num_gpus

    # Allow for some overhead (system, CUDA, etc.)
    available_vram = available_vram * 0.95

    return total_vram <= available_vram


def compute_finetuning_requirements(
    params_billions: float,
    finetuning_method: str,
    gpu_vram: float,
    num_gpus: int,
    batch_size: int,
    seq_length: int,
    grad_accum_steps: int = 1,
) -> Dict[str, Any]:
    """
    Compute VRAM requirements for fine-tuning and determine if it will fit.

    Args:
        params_billions: Number of parameters in billions
        finetuning_method: Fine-tuning method (full, lora, qlora)
        gpu_vram: VRAM per GPU in GB
        num_gpus: Number of GPUs
        batch_size: Batch size
        seq_length: Sequence length
        grad_accum_steps: Gradient accumulation steps

    Returns:
        Dictionary with results
    """
    # Get method configuration
    if finetuning_method not in FINETUNING_METHODS:
        raise ValueError(f"Unknown fine-tuning method: {finetuning_method}")

    method_config = FINETUNING_METHODS[finetuning_method]

    # Get architecture details
    hidden_dim, num_layers = get_architecture_details(params_billions)

    # Calculate effective batch size with gradient accumulation
    effective_batch_size = batch_size / grad_accum_steps

    # Calculate components
    model_precision = method_config["model_weight_precision"]
    model_weights = calculate_model_weights(params_billions, model_precision)
    activation_memory = calculate_activation_memory(
        model_weights, method_config["activation_factor"]
    )
    optimizer_states = calculate_optimizer_states(
        model_weights, method_config["optimizer_states_factor"]
    )
    kv_cache = calculate_kv_cache(
        hidden_dim, num_layers, effective_batch_size, seq_length, model_precision
    )

    # Calculate total VRAM
    adapter_overhead = method_config.get("adapter_overhead", 0.0)
    use_gradient_checkpointing = method_config.get("gradient_checkpointing", False)

    total_vram = calculate_total_training_vram(
        model_weights,
        activation_memory,
        optimizer_states,
        kv_cache,
        adapter_overhead,
        use_gradient_checkpointing,
    )

    # Distribute across GPUs if multiple GPUs available
    vram_per_gpu = total_vram / num_gpus if num_gpus > 0 else total_vram

    # Check if model will fit
    will_fit = will_model_fit(total_vram, gpu_vram, num_gpus)

    # Calculate VRAM usage percentage
    total_available_vram = gpu_vram * num_gpus
    vram_usage_percent = (
        (total_vram / total_available_vram) * 100
        if total_available_vram > 0
        else float("inf")
    )

    # Construct detailed result
    result = {
        "will_it_fit": will_fit,
        "needed_vram": round(total_vram, 2),
        "details": {
            "model_weights": round(model_weights, 2),
            "activation_memory": round(activation_memory, 2),
            "optimizer_states": round(optimizer_states, 2),
            "kv_cache": round(kv_cache, 2),
            "gradient_checkpointing": use_gradient_checkpointing,
            "method_description": method_config["description"],
            "total_vram": round(total_vram, 2),
            "vram_per_gpu": round(vram_per_gpu, 2),
            "vram_usage_percent": round(vram_usage_percent, 2),
            "effective_batch_size": effective_batch_size,
            "architecture": {"hidden_dim": hidden_dim, "num_layers": num_layers},
        },
    }

    return result


def suggest_finetuning_configurations(
    params_billions: float,
    finetuning_method: str,
    gpu_vram: float,
    num_gpus: int,
    batch_size: int,
    seq_length: int,
    grad_accum_steps: int = 1,
) -> List[Dict[str, Any]]:
    """
    Suggest alternative configurations for fine-tuning.

    Args:
        params_billions: Number of parameters in billions
        finetuning_method: Fine-tuning method (full, lora, qlora)
        gpu_vram: VRAM per GPU in GB
        num_gpus: Number of GPUs
        batch_size: Batch size
        seq_length: Sequence length
        grad_accum_steps: Gradient accumulation steps

    Returns:
        List of dictionaries with suggested configurations
    """
    suggestions = []

    # Check if current configuration fits
    result = compute_finetuning_requirements(
        params_billions,
        finetuning_method,
        gpu_vram,
        num_gpus,
        batch_size,
        seq_length,
        grad_accum_steps,
    )

    if result["will_it_fit"]:
        # Already fits, no suggestions needed
        return suggestions

    # Try different fine-tuning methods
    for method in ["lora", "qlora"]:
        if method != finetuning_method:
            suggestion_result = compute_finetuning_requirements(
                params_billions,
                method,
                gpu_vram,
                num_gpus,
                batch_size,
                seq_length,
                grad_accum_steps,
            )

            if suggestion_result["will_it_fit"]:
                suggestions.append(
                    {
                        "type": "change_method",
                        "method": method,
                        "needed_vram": suggestion_result["needed_vram"],
                    }
                )

    # Try gradient accumulation
    for new_grad_accum in [2, 4, 8]:
        if new_grad_accum > grad_accum_steps:
            suggestion_result = compute_finetuning_requirements(
                params_billions,
                finetuning_method,
                gpu_vram,
                num_gpus,
                batch_size,
                seq_length,
                new_grad_accum,
            )

            if suggestion_result["will_it_fit"]:
                suggestions.append(
                    {
                        "type": "increase_grad_accum",
                        "grad_accum_steps": new_grad_accum,
                        "needed_vram": suggestion_result["needed_vram"],
                    }
                )
                break

    # Try reducing batch size
    if batch_size > 1:
        for new_batch_size in [batch_size // 2, 1]:
            suggestion_result = compute_finetuning_requirements(
                params_billions,
                finetuning_method,
                gpu_vram,
                num_gpus,
                new_batch_size,
                seq_length,
                grad_accum_steps,
            )

            if suggestion_result["will_it_fit"]:
                suggestions.append(
                    {
                        "type": "reduce_batch_size",
                        "batch_size": new_batch_size,
                        "needed_vram": suggestion_result["needed_vram"],
                    }
                )
                break

    # Try reducing sequence length
    if seq_length > 512:
        for new_seq_length in [seq_length // 2, 1024, 512]:
            suggestion_result = compute_finetuning_requirements(
                params_billions,
                finetuning_method,
                gpu_vram,
                num_gpus,
                batch_size,
                new_seq_length,
                grad_accum_steps,
            )

            if suggestion_result["will_it_fit"]:
                suggestions.append(
                    {
                        "type": "reduce_sequence_length",
                        "sequence_length": new_seq_length,
                        "needed_vram": suggestion_result["needed_vram"],
                    }
                )
                break

    # Try increasing GPU count
    if num_gpus < 8:  # Arbitrary limit
        for new_num_gpus in [num_gpus + 1, num_gpus * 2]:
            suggestion_result = compute_finetuning_requirements(
                params_billions,
                finetuning_method,
                gpu_vram,
                new_num_gpus,
                batch_size,
                seq_length,
                grad_accum_steps,
            )

            if suggestion_result["will_it_fit"]:
                suggestions.append(
                    {
                        "type": "increase_gpus",
                        "num_gpus": new_num_gpus,
                        "needed_vram": suggestion_result["needed_vram"],
                    }
                )
                break

    return suggestions


def main():
    """
    Main function to demonstrate the calculator.
    """
    # Example usage
    params = {
        "params_billions": 7.0,
        "finetuning_method": "full",
        "gpu_vram": 24.0,  # RTX 4090
        "num_gpus": 1,
        "batch_size": 8,
        "seq_length": 2048,
        "grad_accum_steps": 1,
    }

    # Compute VRAM requirements
    result = compute_finetuning_requirements(**params)

    # Print results
    print(json.dumps(result, indent=2))

    # Get suggestions if needed
    if not result["will_it_fit"]:
        suggestions = suggest_finetuning_configurations(**params)
        print("\nSuggested configurations:")
        print(json.dumps(suggestions, indent=2))


if __name__ == "__main__":

    def calculate_for_ui(
        params_billions: float,
        finetuning_method: str,
        gpu_vram: Union[float, str],
        num_gpus: int,
        batch_size: int,
        seq_length: int,
        grad_accum_steps: int = 1,
    ) -> Dict[str, Any]:
        """
        Function to be called from UI applications.

        Args:
            params_billions: Number of parameters in billions
            finetuning_method: Fine-tuning method (full, lora, qlora)
            gpu_vram: VRAM per GPU in GB or GPU name
            num_gpus: Number of GPUs
            batch_size: Batch size
            seq_length: Sequence length
            grad_accum_steps: Gradient accumulation steps

        Returns:
            Dictionary with results and suggestions
        """
        # Handle GPU VRAM input (either direct value or GPU name)
        if isinstance(gpu_vram, str) and gpu_vram in COMMON_GPUS:
            gpu_vram_gb = COMMON_GPUS[gpu_vram]
        else:
            try:
                gpu_vram_gb = float(gpu_vram)
            except (ValueError, TypeError):
                gpu_vram_gb = 24.0  # Default to RTX 4090 if invalid

        # Compute VRAM requirements
        result = compute_finetuning_requirements(
            params_billions=params_billions,
            finetuning_method=finetuning_method,
            gpu_vram=gpu_vram_gb,
            num_gpus=num_gpus,
            batch_size=batch_size,
            seq_length=seq_length,
            grad_accum_steps=grad_accum_steps,
        )

        # Get suggestions if needed
        suggestions = []
        if not result["will_it_fit"]:
            suggestions = suggest_finetuning_configurations(
                params_billions=params_billions,
                finetuning_method=finetuning_method,
                gpu_vram=gpu_vram_gb,
                num_gpus=num_gpus,
                batch_size=batch_size,
                seq_length=seq_length,
                grad_accum_steps=grad_accum_steps,
            )

        # Combine results and suggestions
        combined_result = {**result, "suggestions": suggestions}

        return combined_result

    # Run the main demo
    main()
