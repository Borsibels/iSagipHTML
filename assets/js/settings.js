/**
 * Settings Module
 * Handles settings page functionality: dark mode toggle, password change, role display
 */

(function() {
  'use strict';

  // ========================================
  // SETTINGS PAGE FUNCTIONALITY
  // ========================================
  
  /**
   * Initialize settings page functionality
   * Handles dark mode toggle, password change modal, and role display
   */
  (function initializeSettingsPage() {
    // Check if we're on the settings page
    if (!document.getElementById('dark-mode-toggle')) return;
    
    // Initialize dark mode toggle
    initializeDarkModeToggle();
    
    // Initialize password change functionality
    initializePasswordChange();
    
    // Display current user role
    displayCurrentRole();
  })();

  /**
   * Initialize dark mode toggle functionality
   * Loads saved theme preference and handles toggle events
   * Uses applyTheme from utils.js
   */
  function initializeDarkModeToggle() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (!darkModeToggle) return;
    
    // Load saved theme preference from localStorage
    const savedTheme = localStorage.getItem('iSagip_theme') || 'light';
    // Use applyTheme from utils.js (should be available globally)
    if (window.applyTheme) {
      window.applyTheme(savedTheme);
    } else {
      // Fallback if utils.js hasn't loaded yet
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    darkModeToggle.checked = savedTheme === 'dark';
    
    // Handle toggle change event
    darkModeToggle.addEventListener('change', function() {
      const newTheme = this.checked ? 'dark' : 'light';
      if (window.applyTheme) {
        window.applyTheme(newTheme);
      } else {
        document.documentElement.setAttribute('data-theme', newTheme);
      }
      localStorage.setItem('iSagip_theme', newTheme);
    });
  }

  /**
   * Initialize password change functionality
   * Handles modal open/close and password update via Firebase Auth
   */
  function initializePasswordChange() {
    const changePasswordBtn = document.getElementById('change-password-btn');
    const changePasswordModal = document.getElementById('change-password-modal');
    const closeModalBtn = document.getElementById('close-password-modal');
    const cancelBtn = document.getElementById('cancel-password-change');
    const passwordForm = document.getElementById('change-password-form');
    
    if (!changePasswordBtn || !changePasswordModal) return;
    
    // Open modal when change password button is clicked
    changePasswordBtn.addEventListener('click', function() {
      changePasswordModal.hidden = false;
    });
    
    // Close modal when close button is clicked
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', closePasswordModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closePasswordModal);
    }
    
    // Close modal when clicking outside
    changePasswordModal.addEventListener('click', function(e) {
      if (e.target === changePasswordModal) {
        closePasswordModal();
      }
    });
    
    // Handle form submission
    if (passwordForm) {
      passwordForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const currentPasswordInput = document.getElementById('current-password');
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');

        const currentPassword = currentPasswordInput.value.trim();
        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        if (!currentPassword || !newPassword || !confirmPassword) {
          alert('Please fill in all password fields.');
          return;
        }

        if (newPassword !== confirmPassword) {
          alert('New password and confirmation do not match.');
          return;
        }

        if (newPassword.length < 8) {
          alert('New password must be at least 8 characters long.');
          return;
        }

        if (!window.iSagipAuth) {
          alert('Authentication is not initialized. Please refresh the page.');
          return;
        }

        const auth = window.iSagipAuth;
        const user = auth.currentUser;

        if (!user || !user.email) {
          alert('No authenticated user found. Please log in again.');
          return;
        }

        // Lazy‑import Firebase Auth helpers to avoid duplicate script tags
        import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js")
          .then(({ EmailAuthProvider, reauthenticateWithCredential, updatePassword }) => {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);

            return reauthenticateWithCredential(user, credential)
              .then(() => updatePassword(user, newPassword))
              .then(() => {
                alert('Password updated successfully.');
                closePasswordModal();
              })
              .catch((error) => {
                console.error('Password change error:', error);
                let message = 'Failed to change password.';

                if (error.code === 'auth/wrong-password') {
                  message = 'Current password is incorrect.';
                } else if (error.code === 'auth/weak-password') {
                  message = 'New password is too weak. Please choose a stronger password.';
                } else if (error.code === 'auth/too-many-requests') {
                  message = 'Too many attempts. Please try again later.';
                }

                alert(message);
              });
          })
          .catch((error) => {
            console.error('Failed to load Firebase Auth helpers:', error);
            alert('Unable to change password right now. Please try again later.');
          });
      });
    }
    
    function closePasswordModal() {
      changePasswordModal.hidden = true;
      if (passwordForm) {
        passwordForm.reset();
      }
    }
  }

  /**
   * Display current user role on settings page
   * Shows the role based on localStorage value
   */
  function displayCurrentRole() {
    const roleDisplay = document.getElementById('current-role-display');
    if (!roleDisplay) return;
    
    const userRole = localStorage.getItem('iSagip_userRole') || 'system_admin';
    const roleNames = {
      'system_admin': 'System Administrator',
      'admin': 'Administrator',
      'barangay_staff': 'Barangay Staff',
      'responder': 'Responder',
      'live_viewer': 'Live Viewer'
    };
    
    roleDisplay.textContent = roleNames[userRole] || 'Unknown Role';
  }
})();
