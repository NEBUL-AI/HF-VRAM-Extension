#!/usr/bin/env python3
"""
LLM Inference VRAM Calculator

This script calculates whether a Large Language Model will fit in GPU memory
based on parameter count, batch size, sequence length, and other factors.
It focuses specifically on inference workloads.

Input parameters:
- Parameter count
- Precision
- Available GPU VRAM
- Number of GPUs
- Batch size
- Sequence length
- Concurrent requests
- Reasoning capability (boolean)

Output:
- Whether the model will fit
- Required VRAM
- KV cache size
- Detailed breakdown of memory usage
"""

import json
import math
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

# Bytes per parameter for different quantization levels
PRECISION_BYTES = {
    "FP32": 4.0,
    "FP16": 2.0,
    "BF16": 2.0,
    "INT8": 1.0,
    "Q8": 1.0,  # Added for compatibility
    "INT4": 0.5,
    "Q4": 0.5,  # Added for compatibility
    "Q5": 0.625,  # Added for compatibility (5/8 bytes)
    "Q6": 0.75,  # Added for compatibility (6/8 bytes)
    "Q2": 0.25,  # Added for compatibility (2/8 bytes)
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


def calculate_activation_memory(model_weights: float) -> float:
    """
    Calculate memory required for activations during inference.

    Args:
        model_weights: Size of model weights in GB

    Returns:
        Memory in GB
    """
    # For inference, activation memory is typically 0.2x model weights
    return model_weights * 0.2


def calculate_kv_cache(
    hidden_dim: int,
    num_layers: int,
    batch_size: int,
    seq_length: int,
    precision: str,
    concurrent_requests: int = 1,
) -> float:
    """
    Calculate memory required for KV cache during inference.

    Args:
        hidden_dim: Hidden dimension size
        num_layers: Number of layers
        batch_size: Batch size
        seq_length: Sequence length
        precision: Precision used
        concurrent_requests: Number of concurrent requests

    Returns:
        Memory in GB
    """
    bytes_per_element = PRECISION_BYTES[precision]

    # 2 is for Key and Value tensors
    kv_cache_per_token = (hidden_dim * 2 * bytes_per_element * num_layers) / 10**9

    return batch_size * seq_length * kv_cache_per_token * concurrent_requests


def calculate_total_vram(
    model_weights: float,
    activation_memory: float,
    kv_cache: float,
    is_reasoning: bool = False,
) -> float:
    """
    Calculate total VRAM required for inference.

    Args:
        model_weights: Size of model weights in GB
        activation_memory: Size of activation memory in GB
        kv_cache: Size of KV cache in GB
        is_reasoning: Whether the model is a reasoning model

    Returns:
        Total VRAM in GB
    """
    base_vram = model_weights + activation_memory + kv_cache

    # Apply overhead factor
    overhead_factor = (
        1.25 if is_reasoning else 1.15
    )  # 1.25 for reasoning, 1.15 for text

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


def compute_vram_requirements(
    params_billions: float,
    precision: str,
    gpu_vram: float,
    num_gpus: int,
    batch_size: int,
    seq_length: int,
    concurrent_requests: int,
    is_reasoning: bool,
) -> Dict[str, Any]:
    """
    Compute VRAM requirements and determine if model will fit.

    Args:
        params_billions: Number of parameters in billions
        precision: Precision/quantization level
        gpu_vram: VRAM per GPU in GB
        num_gpus: Number of GPUs
        batch_size: Batch size
        seq_length: Sequence length
        concurrent_requests: Number of concurrent requests
        is_reasoning: Whether the model is a reasoning model

    Returns:
        Dictionary with results
    """
    # Get architecture details
    hidden_dim, num_layers = get_architecture_details(params_billions)

    # Calculate components
    model_weights = calculate_model_weights(params_billions, precision)
    activation_memory = calculate_activation_memory(model_weights)
    kv_cache = calculate_kv_cache(
        hidden_dim, num_layers, batch_size, seq_length, precision, concurrent_requests
    )

    # Calculate total VRAM
    total_vram = calculate_total_vram(
        model_weights, activation_memory, kv_cache, is_reasoning
    )

    # Check if model will fit
    will_fit = will_model_fit(total_vram, gpu_vram, num_gpus)

    # Compute effective VRAM per GPU
    vram_per_gpu = total_vram / num_gpus if num_gpus > 0 else total_vram

    # Calculate overhead factor
    overhead_factor = 1.25 if is_reasoning else 1.15

    # Calculate base VRAM (before overhead)
    base_vram = model_weights + activation_memory + kv_cache

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
        "total_kv_cache": round(kv_cache, 2),
        "details": {
            "model_weights": round(model_weights, 2),
            "activation_memory": round(activation_memory, 2),
            "kv_cache": round(kv_cache, 2),
            "base_vram": round(base_vram, 2),
            "overhead_factor": overhead_factor,
            "total_vram": round(total_vram, 2),
            "vram_per_gpu": round(vram_per_gpu, 2),
            "vram_usage_percent": round(vram_usage_percent, 2),
            "architecture": {"hidden_dim": hidden_dim, "num_layers": num_layers},
        },
    }

    return result


def suggest_configurations(
    params_billions: float,
    precision: str,
    gpu_vram: float,
    num_gpus: int,
    batch_size: int,
    seq_length: int,
    concurrent_requests: int,
    is_reasoning: bool,
) -> List[Dict[str, Any]]:
    """
    Suggest alternative configurations that would fit in GPU memory.

    Args:
        params_billions: Number of parameters in billions
        precision: Precision/quantization level
        gpu_vram: VRAM per GPU in GB
        num_gpus: Number of GPUs
        batch_size: Batch size
        seq_length: Sequence length
        concurrent_requests: Number of concurrent requests
        is_reasoning: Whether the model is a reasoning model

    Returns:
        List of dictionaries with suggested configurations
    """
    suggestions = []

    # Check if current configuration fits
    result = compute_vram_requirements(
        params_billions,
        precision,
        gpu_vram,
        num_gpus,
        batch_size,
        seq_length,
        concurrent_requests,
        is_reasoning,
    )

    if result["will_it_fit"]:
        # Already fits, no suggestions needed
        return suggestions

    # Try reducing batch size
    if batch_size > 1:
        for new_batch_size in [batch_size // 2, 1]:
            suggestion_result = compute_vram_requirements(
                params_billions,
                precision,
                gpu_vram,
                num_gpus,
                new_batch_size,
                seq_length,
                concurrent_requests,
                is_reasoning,
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
            suggestion_result = compute_vram_requirements(
                params_billions,
                precision,
                gpu_vram,
                num_gpus,
                batch_size,
                new_seq_length,
                concurrent_requests,
                is_reasoning,
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

    # Try more aggressive quantization
    precision_options = ["Q4", "Q2"]
    for new_precision in precision_options:
        if PRECISION_BYTES[new_precision] < PRECISION_BYTES[precision]:
            suggestion_result = compute_vram_requirements(
                params_billions,
                new_precision,
                gpu_vram,
                num_gpus,
                batch_size,
                seq_length,
                concurrent_requests,
                is_reasoning,
            )

            if suggestion_result["will_it_fit"]:
                suggestions.append(
                    {
                        "type": "more_quantization",
                        "precision": new_precision,
                        "needed_vram": suggestion_result["needed_vram"],
                    }
                )
                break

    # Try increasing GPU count
    if num_gpus < 8:  # Arbitrary limit
        for new_num_gpus in [num_gpus + 1, num_gpus * 2]:
            suggestion_result = compute_vram_requirements(
                params_billions,
                precision,
                gpu_vram,
                new_num_gpus,
                batch_size,
                seq_length,
                concurrent_requests,
                is_reasoning,
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
        "params_billions": 6.85,
        "precision": "Q8",
        "gpu_vram": 24.0,  # RTX 4090
        "num_gpus": 1,
        "batch_size": 32,
        "seq_length": 2048,
        "concurrent_requests": 1,
        "is_reasoning": True,
    }

    # Compute VRAM requirements
    result = compute_vram_requirements(**params)

    # Print results
    print(json.dumps(result, indent=2))

    # Get suggestions if needed
    if not result["will_it_fit"]:
        suggestions = suggest_configurations(**params)
        print("\nSuggested configurations:")
        print(json.dumps(suggestions, indent=2))


if __name__ == "__main__":

    def calculate_for_ui(
        params_billions: float,
        precision: str,
        gpu_vram: Union[float, str],
        num_gpus: int,
        batch_size: int,
        seq_length: int,
        concurrent_requests: int,
        is_reasoning: bool,
    ) -> Dict[str, Any]:
        """
        Function to be called from UI applications.

        Args:
            params_billions: Number of parameters in billions
            precision: Precision/quantization level
            gpu_vram: VRAM per GPU in GB or GPU name
            num_gpus: Number of GPUs
            batch_size: Batch size
            seq_length: Sequence length
            concurrent_requests: Number of concurrent requests
            is_reasoning: Whether the model is a reasoning model

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
        result = compute_vram_requirements(
            params_billions=params_billions,
            precision=precision,
            gpu_vram=gpu_vram_gb,
            num_gpus=num_gpus,
            batch_size=batch_size,
            seq_length=seq_length,
            concurrent_requests=concurrent_requests,
            is_reasoning=is_reasoning,
        )

        # Get suggestions if needed
        suggestions = []
        if not result["will_it_fit"]:
            suggestions = suggest_configurations(
                params_billions=params_billions,
                precision=precision,
                gpu_vram=gpu_vram_gb,
                num_gpus=num_gpus,
                batch_size=batch_size,
                seq_length=seq_length,
                concurrent_requests=concurrent_requests,
                is_reasoning=is_reasoning,
            )

        # Combine results and suggestions
        combined_result = {**result, "suggestions": suggestions}

        return combined_result

    # Run the main demo
    main()
