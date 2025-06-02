# Security Documentation

## Overview

This document outlines the security measures implemented in the Hugging Face VRAM Calculator extension to protect against potential security vulnerabilities, particularly those related to malicious model names and data injection attacks.

## Identified Security Risks

### 1. Cross-Site Scripting (XSS) via Model Names
**Risk**: Malicious actors could potentially create Hugging Face models with names containing JavaScript code or HTML tags that could execute in the extension's context.

**Example Attack Vectors**:
- Model name: `<script>alert('XSS')</script>`
- Model name: `"><img src=x onerror=alert('XSS')>`
- Developer name: `<iframe src="javascript:alert('XSS')"></iframe>`

### 2. URL Injection via Developer Logos
**Risk**: Malicious logo URLs could redirect to harmful sites or attempt to execute JavaScript.

**Example Attack Vectors**:
- Logo URL: `javascript:alert('XSS')`
- Logo URL: `data:text/html,<script>alert('XSS')</script>`
- Logo URL: `http://malicious-site.com/logo.png`

## Security Measures Implemented

### 1. Input Sanitization

#### Content Script (`content-script.js`)
- **Function**: `sanitizeExtractedText(text)`
- **Purpose**: Sanitizes all text extracted from Hugging Face pages
- **Features**:
  - Removes control characters (`\x00-\x1F\x7F-\x9F`)
  - Trims whitespace
  - Limits text length to 200 characters to prevent buffer overflow attacks
  - Returns empty string for non-string inputs

#### Side Panel (`sidepanel.js`)
- **Function**: `sanitizeText(text)`
- **Purpose**: Additional sanitization before displaying content in the UI
- **Features**:
  - Uses DOM element's `textContent` property to automatically escape HTML
  - Handles null/undefined inputs safely
  - Removes any remaining HTML tags

### 2. Safe DOM Manipulation

#### Replaced Vulnerable Code:
```javascript
// VULNERABLE (before)
modelNameElement.innerHTML = `<span>${modelInfo.modelName}</span>`;

// SECURE (after)
const sanitizedModelName = sanitizeText(modelInfo.modelName);
modelNameElement.innerHTML = `<span></span>`;
modelNameElement.querySelector('span').textContent = sanitizedModelName;
```

**Why This is Secure**:
- Uses `textContent` instead of `innerHTML` to prevent HTML parsing
- Sanitizes input before processing
- Creates empty span elements first, then sets content safely

### 3. URL Validation

#### Function: `sanitizeUrl(url)`
- **Purpose**: Validates and sanitizes image URLs
- **Security Features**:
  - Only allows HTTPS URLs (prevents mixed content attacks)
  - Whitelist approach: only allows trusted domains
    - `*.huggingface.co`
    - `*.hf.co` 
    - `*.amazonaws.com` (for HF-hosted images)
  - Returns empty string for invalid/untrusted URLs
  - Handles malformed URLs gracefully

#### Applied to:
- Developer logo URLs (`developerLogoUrl`)
- Image `src` attributes
- Image `alt` attributes (sanitized separately)

### 4. Content Security Policy

The extension's `manifest.json` includes a restrictive Content Security Policy:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

This prevents:
- Inline JavaScript execution
- Loading scripts from external domains
- Loading objects from external domains

### 5. Trusted Domain Restrictions

The extension only operates on trusted Hugging Face domains:
- `*.huggingface.co`
- `*.hf.co`

This is enforced through:
- `host_permissions` in manifest
- `content_scripts` matches
- URL validation functions

## Testing Security Measures

### Manual Testing Scenarios

1. **XSS in Model Names**:
   - Test with model names containing `<script>`, `<img>`, `<iframe>` tags
   - Verify content is displayed as plain text, not executed

2. **XSS in Developer Names**:
   - Test with developer names containing HTML/JavaScript
   - Verify content is sanitized and displayed safely

3. **Malicious URLs**:
   - Test with `javascript:` URLs
   - Test with `data:` URLs
   - Test with HTTP URLs (should be blocked)
   - Test with URLs from untrusted domains

4. **Long Strings**:
   - Test with extremely long model names (>200 characters)
   - Verify truncation works correctly

### Automated Testing

Consider implementing:
- Unit tests for sanitization functions
- Integration tests with malicious payloads
- CSP violation monitoring

## Best Practices for Future Development

1. **Always Sanitize User Input**: Never trust data from external sources
2. **Use `textContent` over `innerHTML`**: When displaying user data
3. **Validate URLs**: Always validate and whitelist URLs before use
4. **Limit Input Length**: Prevent buffer overflow and UI breaking
5. **Use CSP**: Maintain restrictive Content Security Policy
6. **Regular Security Reviews**: Periodically audit code for new vulnerabilities

## Reporting Security Issues

If you discover a security vulnerability, please:
1. **Do not** create a public issue
2. Contact the maintainers privately
3. Provide detailed reproduction steps
4. Allow time for patching before disclosure

## Conclusion

The implemented security measures provide robust protection against common web extension vulnerabilities, particularly XSS attacks via malicious model names. The combination of input sanitization, safe DOM manipulation, URL validation, and Content Security Policy creates multiple layers of defense against potential attacks. 