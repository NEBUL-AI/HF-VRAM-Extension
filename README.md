# HF VRAM Calculator

A Chrome extension that helps you determine the hardware requirements for running LLMs and AI models from Hugging Face.

![Chrome Web Store](https://img.shields.io/chrome-web-store/v/bioohacjdieeliinbpocpdhpdapfkhal?style=flat-square)
![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/bioohacjdieeliinbpocpdhpdapfkhal?style=flat-square)

---

## 🚀 Overview

It can be pretty hard to figure out what hardware you need to run LLMs and other AI models. With the **HF VRAM Calculator**, you can easily see the requirements to inference or fine-tune a model. If your hardware doesn't meet the requirements, you'll even get suggestions on how to still get it working (i.e., quantization or QLoRA).

This tool is an extension to the Hugging Face website that provides instant VRAM calculations and optimization suggestions right in your browser.

> **Note**: This is still a Beta version, so please leave feedback if you can think of improvements!

---

## ✨ Features

- 📊 **Instant VRAM Calculations**: See memory requirements for inference and fine-tuning
- 💡 **Smart Suggestions**: Get recommendations for quantization, QLoRA, and other optimization techniques
- 🔧 **Hardware Compatibility**: Check if your current setup can handle specific models
- 🎯 **Seamless Integration**: Works directly on Hugging Face model pages
- ⚡ **Real-time Analysis**: No need to leave the Hugging Face website

---

## 📦 Installation

### Option 1: Chrome Web Store (Recommended)

Install directly from the Chrome Web Store:

[![Install from Chrome Web Store](https://img.shields.io/badge/Install-Chrome%20Web%20Store-blue?style=for-the-badge&logo=googlechrome)](https://chromewebstore.google.com/detail/bioohacjdieeliinbpocpdhpdapfkhal?utm_source=item-share-cb)

### Option 2: Local Installation (Development)

1. **Download or clone this repository**
   ```bash
   git clone https://github.com/NEBUL-AI/HF-VRAM-Extension.git
   ```

2. **Prepare the extension**
   - Zip the root directory of this repo, or
   - Keep the folder structure intact for unpacked installation

3. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top-right corner)
   - Click "Load unpacked" and select the folder containing the extension
   - The extension should now be installed and ready to use

---

## 🎯 Usage

1. **Navigate to any model on Hugging Face** (e.g., `https://huggingface.co/meta-llama/Meta-Llama-3-8B`)

2. **Open the VRAM Calculator** by either:
   - Clicking the extension icon in your Chrome toolbar
   - Clicking the **VRAM** button in the model card

3. **View the results**:
   - See memory requirements for different use cases
   - Get hardware compatibility information
   - Receive optimization suggestions if needed

4. **Apply recommendations** to run models on your available hardware

---

## 🛠️ Development

### Prerequisites
- Chrome browser
- Basic knowledge of Chrome extension development

### Local Development Setup
1. Clone this repository
2. Make your changes
3. Load the unpacked extension in Chrome
4. Test your changes on Hugging Face model pages

---

## 🤝 Contributing

Contributions are welcome! We're always looking to improve the HF VRAM Calculator.

### How to Contribute
1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Ideas for Contributions
- Support for more model architectures
- Additional optimization techniques
- UI/UX improvements
- Performance optimizations
- Bug fixes and error handling

---

## 📝 Feedback

Since this is a Beta version, your feedback is invaluable! Please help us improve by:

- 🐛 [Reporting bugs](https://github.com/NEBUL-AI/HF-VRAM-Extension/issues)
- 💡 [Suggesting features](https://github.com/NEBUL-AI/HF-VRAM-Extension/issues)
- ⭐ [Rate the extension on the Chrome Web Store](https://chromewebstore.google.com/detail/hugging-face-vram-calcula/bioohacjdieeliinbpocpdhpdapfkhal/reviews)
- 📧 [Reaching out to the Nebul AI Team](mailto:engineering@nebul.com)

---

## 👥 Team

Created by the **Nebul AI Team**

---

## 📄 License

This project is open-source. Please see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- [Chrome Web Store](https://chromewebstore.google.com/detail/bioohacjdieeliinbpocpdhpdapfkhal?utm_source=item-share-cb)
- [Hugging Face](https://huggingface.co/)
- [Report Issues](https://github.com/NEBUL-AI/HF-VRAM-Extension/issues)

---

*Happy model running! 🚀*
