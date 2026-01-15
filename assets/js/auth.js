/**
 * Authentication Module
 * Handles login, logout, and authentication checks
 */

// ========================================
// LOGIN PAGE FUNCTIONALITY
// ========================================

/**
 * Main login page functionality
 * Handles Firebase authentication and role-based redirection
 */
(function initializeLoginPage() {
  // ========================================
  // LOGIN FORM SUBMISSION
  // ========================================
  
  /**
   * Handle login form submission
   * Authenticates with Firebase and redirects based on user role
   */
  var form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      
      var email = document.getElementById('login-email').value.trim().toLowerCase();
      var password = document.getElementById('login-password').value;
      
      // Validation
      if (!email || !password) {
        alert('Please enter both email and password.');
        return; 
      }

      // Check if Firebase is available
      if (!window.iSagipAuth || !window.iSagipDb) {
        alert('Firebase is not initialized. Please refresh the page.');
        return;
      }

      try {
        // Import Firebase Auth and Firestore functions
        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");
        const { doc, getDoc, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");

        // Authenticate user with email (Firebase Auth is case-sensitive for email)
        const auth = window.iSagipAuth;
        
        // Log for debugging (remove in production)
        console.log('Attempting login with email:', email);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Authentication successful. User UID:', user.uid);

        // Get user role from Firestore - check all collections
        const db = window.iSagipDb;
        var userRole = null;
        var userData = null;

        // Check admin collection first - try by UID
        const adminDoc = await getDoc(doc(db, 'admin', user.uid));
        if (adminDoc.exists()) {
          userData = adminDoc.data();
          userRole = userData.role || 'admin';
          console.log('Admin found by UID. Role:', userRole);
        } else {
          // If not found by UID, try searching by email in admin collection
          const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
          const adminQuery = query(collection(db, 'admin'), where('email', '==', email));
          const adminSnapshot = await getDocs(adminQuery);
          
          if (!adminSnapshot.empty) {
            adminSnapshot.forEach((doc) => {
              userData = doc.data();
              userRole = userData.role || 'admin';
              console.log('Admin found by email. Role:', userRole);
            });
          } else {
            // Check staff collection
            const staffDoc = await getDoc(doc(db, 'staff', user.uid));
            if (staffDoc.exists()) {
              userData = staffDoc.data();
              userRole = userData.role || 'barangay_staff';
              console.log('Staff found. Role:', userRole);
            } else {
              // Check responder collection
              const responderDoc = await getDoc(doc(db, 'responder', user.uid));
              if (responderDoc.exists()) {
                userData = responderDoc.data();
                userRole = userData.role || 'responder';
                console.log('Responder found. Role:', userRole);
              }
            }
          }
        }

        // If no role found, default to barangay_staff
        if (!userRole) {
          userRole = 'barangay_staff';
          console.log('No role found, defaulting to barangay_staff');
        }

        console.log('Final user role:', userRole);
        console.log('Redirecting to:', getDestinationForRole(userRole));

        // Store user role and UID in localStorage
        localStorage.setItem('iSagip_userRole', userRole);
        localStorage.setItem('iSagip_userUID', user.uid);
      
        // Navigate based on role
        const destination = getDestinationForRole(userRole);
        if (window.navigateWithFade) {
          window.navigateWithFade(destination);
        } else {
          window.location.href = destination;
        }

      } catch (error) {
        console.error('Login error:', error);
        alert('Login unsuccessful');
      }
    });
  }

  /**
   * Get destination page based on user role
   * @param {string} role - User role (admin, system_admin, barangay_staff, responder, live_viewer)
   * @returns {string} - Destination page URL
   */
  function getDestinationForRole(role) {
    const roleDestinations = {
      'admin': 'mass-register-staff.html',           // Admin → Mass Registration pages
      'system_admin': 'mass-register-staff.html',     // System admin → Mass Registration pages
      'barangay_staff': 'dashboard.html',        // Barangay staff → Dashboard
      'responder': 'dashboard.html',             // Responder → Dashboard
      'live_viewer': 'reportsViewing.html'      // Live viewer → Reports viewing
    };
    
    return roleDestinations[role] || 'dashboard.html';
  }

  // ========================================
  // REPORTS LIVE VIEWING ACCESS
  // ========================================
  
  /**
   * Handle Reports Live Viewing button click
   * Provides direct access to reports viewing for both user types
   */
  var liveViewingBtn = document.getElementById('live-viewing-button');
  if (liveViewingBtn) {
    liveViewingBtn.addEventListener('click', function() {
      // Set special role for live viewing access
      localStorage.setItem('iSagip_userRole', 'live_viewer');
      // Set a dummy UID for live viewer (not authenticated, but needed for auth check)
      localStorage.setItem('iSagip_userUID', 'live_viewer_guest');
      
      // Navigate to reports viewing page with fade-out
      if (window.navigateWithFade) {
        window.navigateWithFade('reportsViewing.html');
      } else {
        window.location.href = 'reportsViewing.html';
      }
    });
  }

  // ========================================
  // LOGOUT FUNCTIONALITY
  // ========================================
  
  /**
   * Handle logout button click
   * Clears user session and redirects to login page
   * Prevents back button navigation after logout
   */
  var logout = document.getElementById('logout');
  if (logout) {
    logout.addEventListener('click', async function () {
      // Sign out from Firebase Auth
      if (window.iSagipAuth) {
        try {
          const { signOut } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");
          const auth = window.iSagipAuth;
          await signOut(auth);
        } catch (error) {
          console.error('Logout error:', error);
        }
      }
      
      // Clear all user data from localStorage (keep theme preference)
      localStorage.removeItem('iSagip_userRole');
      localStorage.removeItem('iSagip_userUID');
      
      // Clear browser history to prevent back button navigation
      // Replace current history entry with login page
      window.history.replaceState(null, null, 'index.html');
      
      // Use replace instead of navigate to prevent back button access
      window.location.replace('index.html');
    });
  }

  // ========================================
  // AUTHENTICATION CHECK (PROTECTED PAGES)
  // ========================================
  
  /**
   * Check if user is authenticated on protected pages
   * Redirects to login if not authenticated
   * Should be called on pages that require authentication
   */
  (function checkAuthentication() {
    // Skip check on login page
    if (window.location.pathname.includes('index.html') || 
        window.location.pathname === '/' || 
        window.location.pathname.endsWith('/')) {
      return;
    }

    // Check if user is authenticated (has role in localStorage)
    const userRole = localStorage.getItem('iSagip_userRole');
    const userUID = localStorage.getItem('iSagip_userUID');
    
    // Special case: live_viewer doesn't require full authentication
    if (userRole === 'live_viewer') {
      // Allow live viewer access without UID requirement
      // Skip Firebase auth check for live viewers
      return;
    }
    
    // If no authentication data, redirect to login
    if (!userRole || !userUID) {
      // Clear any remaining data
      localStorage.clear();
      
      // Redirect to login page (replace to prevent back button)
      window.location.replace('index.html');
      return;
    }

    // Optional: Verify Firebase Auth state (skip for live_viewer)
    if (window.iSagipAuth) {
      // Check auth state asynchronously
      (async () => {
        try {
          const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");
          const auth = window.iSagipAuth;
          
          onAuthStateChanged(auth, (user) => {
            if (!user) {
              // User is not authenticated in Firebase
              // Skip this check for live_viewer role
              const currentRole = localStorage.getItem('iSagip_userRole');
              if (currentRole !== 'live_viewer') {
                localStorage.clear();
                window.location.replace('index.html');
              }
            }
          });
        } catch (error) {
          console.error('Auth state check error:', error);
        }
      })();
    }
  })();
})();
