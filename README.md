# Input Reader Extensions

This repository contains a small browser extension project for Chrome and Firefox.
The extension scans the current page for HTML input fields and shows metadata such as `id`, `type`, `placeholder`, and inferred field categories.

## Project Structure

- `chrome_ext/`
  - `manifest.json` — Chrome Manifest V3
  - `popup.html` — extension popup UI
  - `popup.js` — popup logic and page scanning code
  - `icon.png` — extension icon

- `firefox_ext/`
  - `manifest.json` — Firefox/Chrome-compatible Manifest V2
  - `popup.html` — extension popup UI
  - `popup.js` — popup logic and page scanning code
  - `icon.png` — extension icon

## Features

- Scan the active tab for all `<input>` elements
- Display detected input fields with:
  - `id`
  - `name`
  - `type`
  - `placeholder`
  - label text when available
- Categorize fields into common data types such as email, name, phone, address, company, website, LinkedIn, GitHub, etc.
- Highlight sensitive or password-related fields
- Include a settings section to configure default mapping values for autofill behavior

## Installation

### Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `chrome_ext/` directory.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on...`.
3. Select `firefox_ext/manifest.json`.

## Usage

1. Open a web page containing form inputs.
2. Click the extension toolbar button.
3. Use the popup to scan the page.
4. Review detected inputs and categories.
5. Optionally fill detected fields using saved mapping values.

## Notes

- The Chrome version uses Manifest V3 and the `scripting` API.
- The Firefox version uses Manifest V2 with `browser.tabs.executeScript`.
- Sensitive fields (password, hidden, credit card, etc.) are detected and treated carefully.

## License

This repository does not include a license file. Add a license if you plan to share or publish the extension.
