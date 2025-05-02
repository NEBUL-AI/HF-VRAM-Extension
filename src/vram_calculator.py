#!/usr/bin/env python3
"""
LLM VRAM Calculator

This script calculates the estimated VRAM requirements for running Large Language Models
based on the formulas provided in the blog post.

Usage:
    python vram_calculator.py

The script will prompt for model parameters and configuration options
to calculate the VRAM requirements.
"""

import argparse
from typing import Dict, Tuple
import math

# Default values for hidden dimensions and layer counts
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

# Modality overhead factors
MODALITY_OVERHEAD = {
    "Text": 1.15,
    "Audio": 1.30,
    "Video": 1.40,
    "Reasoning": 1.25,
    "Multimodal": 1.50,
}

# Activation factors for different use cases
ACTIVATION_FACTORS = {
    "Inference": 0.2,
    "Training": 2.0,
}

# Optimizer state multiplier (for training)
OPTIMIZER_MULTIPLIER = 4.0


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


def calculate_activation_memory(model_weights: float, use_case: str) -> float:
    """
    Calculate memory required for activations.

    Args:
        model_weights: Size of model weights in GB
        use_case: "Inference" or "Training"

    Returns:
        Memory in GB
    """
    activation_factor = ACTIVATION_FACTORS[use_case]
    return model_weights * activation_factor


def calculate_kv_cache(
    hidden_dim: int, num_layers: int, batch_size: int, seq_length: int, precision: str
) -> float:
    """
    Calculate memory required for KV cache during inference.

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


def calculate_optimizer_states(model_weights: float) -> float:
    """
    Calculate memory required for optimizer states during training.

    Args:
        model_weights: Size of model weights in GB

    Returns:
        Memory in GB
    """
    return OPTIMIZER_MULTIPLIER * model_weights


def calculate_total_vram(
    model_weights: float,
    activation_memory: float,
    kv_cache: float,
    optimizer_states: float,
    modality: str,
) -> float:
    """
    Calculate total VRAM required.

    Args:
        model_weights: Size of model weights in GB
        activation_memory: Size of activation memory in GB
        kv_cache: Size of KV cache in GB
        optimizer_states: Size of optimizer states in GB
        modality: Type of model (Text, Audio, etc.)

    Returns:
        Total VRAM in GB
    """
    base_vram = model_weights + activation_memory + kv_cache + optimizer_states
    overhead_factor = MODALITY_OVERHEAD[modality]
    return base_vram * overhead_factor


def estimate_params_from_architecture(hidden_dim: int, num_layers: int) -> float:
    """
    Estimate number of parameters based on hidden dimension and layer count.

    Args:
        hidden_dim: Hidden dimension size
        num_layers: Number of layers

    Returns:
        Estimated number of parameters in billions
    """
    # Formula approximation: params ≈ hidden_dim² × num_layers × 2.5
    params = (hidden_dim**2) * num_layers * 2.5
    return params / 10**9


def get_architecture_details(
    model_size: str, custom_hidden_dim: int = None, custom_num_layers: int = None
) -> Tuple[int, int]:
    """
    Get hidden dimension and number of layers for a model.

    Args:
        model_size: Model size in billions of parameters (e.g., "7B")
        custom_hidden_dim: Custom hidden dimension (optional)
        custom_num_layers: Custom number of layers (optional)

    Returns:
        Tuple of (hidden_dim, num_layers)
    """
    if custom_hidden_dim is not None and custom_num_layers is not None:
        return custom_hidden_dim, custom_num_layers

    if model_size in DEFAULT_ARCHITECTURES:
        return (
            DEFAULT_ARCHITECTURES[model_size]["hidden_dim"],
            DEFAULT_ARCHITECTURES[model_size]["num_layers"],
        )
    else:
        raise ValueError(f"Unknown model size: {model_size}")


def format_output(results: Dict[str, float]) -> str:
    """
    Format the calculation results into a readable output.

    Args:
        results: Dictionary containing calculation results

    Returns:
        Formatted string output
    """
    output = "\n" + "=" * 50 + "\n"
    output += "VRAM REQUIREMENT CALCULATION RESULTS\n"
    output += "=" * 50 + "\n\n"

    # Component breakdown
    output += "Component Breakdown:\n"
    output += "-" * 50 + "\n"
    output += f"Model Weights:      {results['model_weights']:.2f} GB\n"
    output += f"Activation Memory:  {results['activation_memory']:.2f} GB\n"
    output += f"KV Cache:           {results['kv_cache']:.2f} GB\n"
    output += f"Optimizer States:   {results['optimizer_states']:.2f} GB\n"
    output += "-" * 50 + "\n"
    output += f"Base VRAM:          {results['base_vram']:.2f} GB\n"
    output += f"Modality Overhead:  {results['overhead_factor']:.2f}x\n"
    output += "=" * 50 + "\n"
    output += f"Total VRAM Required: {results['total_vram']:.2f} GB\n"
    output += "=" * 50 + "\n"

    # Recommendations
    output += "\nRecommendations:\n"

    if results["total_vram"] <= 8:
        output += "✅ Model should run on consumer GPUs with 8GB+ VRAM\n"
    elif results["total_vram"] <= 16:
        output += "✅ Model should run on high-end consumer GPUs with 16GB+ VRAM\n"
    elif results["total_vram"] <= 24:
        output += "⚠️ Model requires professional GPU with 24GB+ VRAM\n"
    elif results["total_vram"] <= 40:
        output += "⚠️ Model requires datacenter GPU with 40GB+ VRAM\n"
    elif results["total_vram"] <= 80:
        output += "⚠️ Model requires high-end datacenter GPU with 80GB+ VRAM\n"
    else:
        output += "⚠️ Model requires multi-GPU setup or model sharding techniques\n"

    if results["precision"] != "INT4" and results["total_vram"] > 16:
        output += "\nTo reduce VRAM usage, consider:\n"
        output += "- Using INT4 or INT8 quantization\n"
        output += "- Reducing sequence length\n"
        output += "- Using model offloading techniques\n"

    return output


def main():
    parser = argparse.ArgumentParser(description="Calculate VRAM requirements for LLMs")

    # Model parameters
    parser.add_argument(
        "--model_size",
        type=str,
        choices=list(DEFAULT_ARCHITECTURES.keys()),
        help="Model size in billions of parameters (e.g., 7B)",
        default="7B",
    )
    parser.add_argument(
        "--custom_params",
        type=float,
        help="Custom number of parameters in billions (overrides model_size)",
    )
    parser.add_argument("--hidden_dim", type=int, help="Custom hidden dimension size")
    parser.add_argument("--num_layers", type=int, help="Custom number of layers")

    # Inference/training parameters
    parser.add_argument(
        "--precision",
        type=str,
        choices=list(PRECISION_BYTES.keys()),
        default="FP16",
        help="Precision/quantization level",
    )
    parser.add_argument("--batch_size", type=int, default=1, help="Batch size")
    parser.add_argument("--seq_length", type=int, default=2048, help="Sequence length")
    parser.add_argument(
        "--use_case",
        type=str,
        choices=list(ACTIVATION_FACTORS.keys()),
        default="Inference",
        help="Use case (Inference or Training)",
    )
    parser.add_argument(
        "--modality",
        type=str,
        choices=list(MODALITY_OVERHEAD.keys()),
        default="Text",
        help="Model modality",
    )

    # Parse arguments
    args = parser.parse_args()

    # Interactive mode if no arguments provided
    if len([arg for arg in vars(args).values() if arg is not None]) == 0:
        print("LLM VRAM Calculator - Interactive Mode")
        print("-" * 50)

        # Get model size or custom parameters
        use_custom = (
            input("Use custom parameter count? (y/n, default: n): ")
            .lower()
            .startswith("y")
        )

        if use_custom:
            num_params = float(input("Number of parameters (in billions): "))
            hidden_dim = int(
                input("Hidden dimension size (default values available): ") or 0
            )
            num_layers = int(
                input("Number of layers (default values available): ") or 0
            )

            if hidden_dim == 0 or num_layers == 0:
                # Estimate architecture based on param count
                closest_size = min(
                    DEFAULT_ARCHITECTURES.keys(),
                    key=lambda x: abs(float(x[:-1]) - num_params),
                )
                hidden_dim = DEFAULT_ARCHITECTURES[closest_size]["hidden_dim"]
                num_layers = DEFAULT_ARCHITECTURES[closest_size]["num_layers"]
                print(
                    f"Using estimated architecture: hidden_dim={hidden_dim}, num_layers={num_layers}"
                )
        else:
            # Choose from predefined model sizes
            print("Available model sizes:")
            for size in DEFAULT_ARCHITECTURES:
                print(f"- {size}")

            model_size = input("Model size (default: 7B): ") or "7B"
            if model_size not in DEFAULT_ARCHITECTURES:
                print(f"Unknown model size. Using 7B instead.")
                model_size = "7B"

            num_params = float(model_size[:-1])
            hidden_dim, num_layers = get_architecture_details(model_size)

        # Get other parameters
        precision_options = list(PRECISION_BYTES.keys())
        print("Precision options:", ", ".join(precision_options))
        precision = input(f"Precision (default: FP16): ") or "FP16"
        if precision not in PRECISION_BYTES:
            print(f"Unknown precision. Using FP16 instead.")
            precision = "FP16"

        batch_size = int(input("Batch size (default: 1): ") or 1)
        seq_length = int(input("Sequence length (default: 2048): ") or 2048)

        use_case_options = list(ACTIVATION_FACTORS.keys())
        print("Use case options:", ", ".join(use_case_options))
        use_case = input(f"Use case (default: Inference): ") or "Inference"
        if use_case not in ACTIVATION_FACTORS:
            print(f"Unknown use case. Using Inference instead.")
            use_case = "Inference"

        modality_options = list(MODALITY_OVERHEAD.keys())
        print("Modality options:", ", ".join(modality_options))
        modality = input(f"Modality (default: Text): ") or "Text"
        if modality not in MODALITY_OVERHEAD:
            print(f"Unknown modality. Using Text instead.")
            modality = "Text"
    else:
        # Use command line arguments
        if args.custom_params is not None:
            num_params = args.custom_params
            if args.hidden_dim is not None and args.num_layers is not None:
                hidden_dim, num_layers = args.hidden_dim, args.num_layers
            else:
                # Estimate architecture based on param count
                closest_size = min(
                    DEFAULT_ARCHITECTURES.keys(),
                    key=lambda x: abs(float(x[:-1]) - num_params),
                )
                hidden_dim = DEFAULT_ARCHITECTURES[closest_size]["hidden_dim"]
                num_layers = DEFAULT_ARCHITECTURES[closest_size]["num_layers"]
        else:
            model_size = args.model_size
            num_params = float(model_size[:-1])
            if args.hidden_dim is not None and args.num_layers is not None:
                hidden_dim, num_layers = args.hidden_dim, args.num_layers
            else:
                hidden_dim, num_layers = get_architecture_details(model_size)

        precision = args.precision
        batch_size = args.batch_size
        seq_length = args.seq_length
        use_case = args.use_case
        modality = args.modality

    # Calculate VRAM components
    model_weights = calculate_model_weights(num_params, precision)
    activation_memory = calculate_activation_memory(model_weights, use_case)
    kv_cache = calculate_kv_cache(
        hidden_dim, num_layers, batch_size, seq_length, precision
    )

    # Add optimizer states for training, otherwise 0
    optimizer_states = (
        calculate_optimizer_states(model_weights) if use_case == "Training" else 0
    )

    # Calculate total VRAM
    base_vram = model_weights + activation_memory + kv_cache + optimizer_states
    overhead_factor = MODALITY_OVERHEAD[modality]
    total_vram = base_vram * overhead_factor

    # Prepare results
    results = {
        "num_params": num_params,
        "hidden_dim": hidden_dim,
        "num_layers": num_layers,
        "precision": precision,
        "batch_size": batch_size,
        "seq_length": seq_length,
        "use_case": use_case,
        "modality": modality,
        "model_weights": model_weights,
        "activation_memory": activation_memory,
        "kv_cache": kv_cache,
        "optimizer_states": optimizer_states,
        "base_vram": base_vram,
        "overhead_factor": overhead_factor,
        "total_vram": total_vram,
    }

    # Display results
    print(format_output(results))


if __name__ == "__main__":
    main()
