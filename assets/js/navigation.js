/**
 * Navigation Module
 * Handles sidebar navigation, role-based access control, and menu highlighting
 */

(function() {
  'use strict';

  // ========================================
  // SIDEBAR NAVIGATION & ROLE-BASED ACCESS
  // ========================================
  
  /**
   * Initialize sidebar functionality
   * Handles role-based menu filtering and active state highlighting
   */
  var menu = document.getElementById('sidebar-menu');
  if (menu) {
    // Get current user role from localStorage
    const userRole = localStorage.getItem('iSagip_userRole') || 'system_admin';
    
    // Apply role-based access control to menu items
    applyRoleBasedAccessControl(userRole);
    
    // Highlight active menu item based on current page
    highlightActiveMenuItem();

    // Intercept sidebar link clicks to add fade transitions
    menu.addEventListener('click', function(e){
      var link = e.target.closest('a.menu-item');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href === '#') return;
      e.preventDefault();
      if (window.navigateWithFade) {
        window.navigateWithFade(href);
      } else {
        window.location.href = href;
      }
    });
  }

  /**
   * Apply role-based access control to sidebar menu items
   * @param {string} userRole - Current user role
   */
  function applyRoleBasedAccessControl(userRole) {
    if (!menu) return;
    const links = menu.querySelectorAll('.menu-item');
    
    links.forEach(function (menuItem) {
      const menuText = menuItem.textContent.trim();
      const shouldShow = shouldShowMenuItem(userRole, menuText);
      
      menuItem.style.display = shouldShow ? '' : 'none';
    });
  }

  /**
   * Determine if a menu item should be visible for the given role
   * @param {string} userRole - Current user role
   * @param {string} menuText - Menu item text
   * @returns {boolean} - Whether the menu item should be visible
   */
  function shouldShowMenuItem(userRole, menuText) {
    const rolePermissions = {
      'admin': {
        allowed: ['Registration', 'Resident Management', 'Settings', 'Dashboard', 'Reports', 'History', 'Ambulance'],
        denied: []
      },
      'system_admin': {
        allowed: ['Registration', 'Resident Management', 'Settings', 'Dashboard', 'Reports', 'History', 'Ambulance'],
        denied: []
      },
      'barangay_staff': {
        allowed: ['Dashboard', 'Reports', 'History', 'Ambulance', 'Settings'],
        denied: ['Registration', 'Resident Management']
      },
      'responder': {
        allowed: ['Dashboard', 'Reports', 'History', 'Ambulance', 'Settings'],
        denied: ['Registration', 'Resident Management']
      },
      'live_viewer': {
        allowed: ['Reports Viewing', 'Settings'],
        denied: ['Dashboard', 'Reports', 'Ambulance', 'Registration', 'Resident Management']
      }
    };

    const permissions = rolePermissions[userRole] || rolePermissions['system_admin'];
    
    // Check if menu item is explicitly denied
    const isDenied = permissions.denied.some(deniedText => menuText.includes(deniedText));
    if (isDenied) return false;
    
    // Check if menu item is explicitly allowed
    const isAllowed = permissions.allowed.some(allowedText => menuText.includes(allowedText));
    return isAllowed;
  }

  /**
   * Highlight the active menu item based on current page URL
   */
  function highlightActiveMenuItem() {
    if (!menu) return;
    const links = menu.querySelectorAll('.menu-item');
    const currentPath = location.pathname.split('/').pop();
    
    links.forEach(function (menuItem) {
      const href = menuItem.getAttribute('href');
      const isActive = isMenuItemActive(href, currentPath);
      
      if (isActive) {
        menuItem.classList.add('active');
      } else {
        menuItem.classList.remove('active');
      }
    });
  }

  /**
   * Check if a menu item should be marked as active
   * @param {string} href - Menu item href attribute
   * @param {string} currentPath - Current page path
   * @returns {boolean} - Whether the menu item should be active
   */
  function isMenuItemActive(href, currentPath) {
    // Handle dashboard special case
    if (href === '#' && (currentPath === '' || currentPath === 'dashboard.html')) {
      return true;
    }
    
    // Direct path match
    if (href === currentPath || href === ('./' + currentPath)) {
      return true;
    }
    
    return false;
  }
})();
