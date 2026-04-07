# JavaScript Module Structure

This directory contains modular JavaScript files organized by functionality.

## File Structure

### Core Modules (Loaded on all pages)
- **auth.js** - Authentication (login, logout, authentication checks)
- **navigation.js** - Sidebar navigation, role-based access control, menu highlighting
- **utils.js** - Global utilities (modals, dark mode, Google Maps, navigation fade, helpers)

### Page-Specific Modules (Loaded only on relevant pages)
- **dashboard.js** - Dashboard reports summary and realtime updates
- **reports.js** - Reports page functionality and realtime database feed
- **ambulance.js** - Ambulance status page functionality
- **resident-management.js** - Resident management and registration review
- **settings.js** - Settings page functionality (dark mode toggle, password change)

### Special Modules
- **mass-registration.js** - Mass staff/responder registration system (already modular)

## Loading Order

1. **auth.js** - Must load first (handles authentication checks)
2. **utils.js** - Global utilities needed by other modules
3. **navigation.js** - Depends on utils.js (uses navigateWithFade)
4. Page-specific modules (dashboard.js, reports.js, etc.)

## Migration Status

✅ **Completed:**
- auth.js - Authentication module
- navigation.js - Navigation module  
- utils.js - Utilities module

⏳ **In Progress:**
- Extracting page-specific modules from script.js
- Updating HTML files to load new modules

## Notes

- All modules use IIFE (Immediately Invoked Function Expressions) to avoid global namespace pollution
- Global functions are attached to `window` object when needed (e.g., `window.navigateWithFade`, `window.applyTheme`)
- The old `script.js` file will be gradually replaced as modules are extracted
