/**
 * Legacy script.js
 * 
 * NOTE: This file has been refactored into modular files:
 * - auth.js - Authentication and login
 * - navigation.js - Sidebar navigation and role-based access
 * - utils.js - Global utilities (modals, dark mode, Google Maps, navigation fade)
 * - dashboard.js - Dashboard page functionality
 * - reports.js - Reports page functionality
 * - ambulance.js - Ambulance status page functionality
 * - resident-management.js - Resident management page functionality
 * - settings.js - Settings page functionality
 * - mass-registration.js - Mass staff/responder registration
 * 
 * This file is kept for backward compatibility and may contain legacy code
 * that hasn't been migrated yet. Most functionality has been moved to the
 * appropriate module files.
 * 
 * ========================================
 * REGISTRATION PAGE TAB SWITCHING (UI ONLY)
 * ========================================
 * NOTE: Staff/Responder registration is now handled by mass-registration.js
 * This function is kept for backward compatibility with register.html if it still uses tabs
 * Staff registration should use mass-register-staff.html instead
   */
  (function setupRegisterTabs(){
    var tabsContainer = document.querySelector('main .tabs');
    var residentForm = document.getElementById('resident-register-form');
  
  // Only handle resident form tab switching if tabs exist
  // Staff registration is now handled by mass-register-staff.html
  if (tabsContainer && residentForm) {
      tabsContainer.addEventListener('click', function(e){
        var btn = e.target.closest('.tab');
        if (!btn) return;
        tabsContainer.querySelectorAll('.tab').forEach(function(b){ 
          b.classList.remove('active'); 
        });
        btn.classList.add('active');
        var t = btn.getAttribute('data-tab');
        if (t === 'resident') { 
          residentForm.hidden = false; 
      }
    });
    }
  })();

  // ========================================
  // FIREBASE ACCESS
  // ========================================
  // Firebase is initialized in HTML file (dashboard.html, etc.)
  // Access Firebase services via:
  // - window.iSagipDb (Firestore database)
  // - window.iSagipAuth (Authentication)
  // - window.iSagipApp (Firebase app instance)
  // - window.iSagipAnalytics (Analytics)
  //
  // Example usage:
  // const db = window.iSagipDb;
  // db.collection('reports').get().then(...)
