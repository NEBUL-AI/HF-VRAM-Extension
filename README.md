# Nebul GenAI Chrome Extension

A Chrome extension that enhances Hugging Face websites by adding a "Nebul" option to the navigation bar.

## Features

1. **Dictionary Side Panel**: Select a word on any webpage and right-click to see its definition in a side panel.
   - Currently supports only a few predefined words: "extensions" and "popup".

2. **Hugging Face Integration**: When visiting any Hugging Face website (huggingface.co or hf.co), the extension adds a "Nebul" option with the extension icon to the main navigation bar.

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the folder containing the extension
5. The extension should now be installed and ready to use

## Usage

### Dictionary Feature
1. Select a word on any webpage
2. Right-click and select "Define" from the context menu
3. A side panel will open showing the definition of the word (if available)

### Hugging Face Integration
1. Visit any Hugging Face website (huggingface.co or hf.co)
2. The extension will automatically add a "Nebul" option with the extension icon to the main navigation bar, between "Pricing" and other options

## Permissions

This extension requires the following permissions:
- `sidePanel`: To open the dictionary side panel
- `contextMenus`: To add the "Define" option to the context menu
- `storage`: To store the last selected word
- `activeTab`: To access the current tab
- `scripting`: To inject content scripts into Hugging Face websites
- `tabs`: To detect when a Hugging Face website is loaded

## Resources

The extension uses the following resources:
- `icon-128.png`: The main extension icon used in both the browser toolbar and the Nebul navbar option
- `icon-16.png`: A smaller version of the icon used by Chrome in certain UI contexts

## Future Enhancements

- Add functionality to the "Nebul" option on Hugging Face websites
- Expand the dictionary with more words and definitions
- Add customization options for users 