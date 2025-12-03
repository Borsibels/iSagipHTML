/*
====================================================
 iSagip Frontend (Vanilla JS)

 UI Effects Only - Ready for Database Integration
 - Navigation & RBAC: login, role storage, sidebar filtering, active states
 - Page Transitions: fade-in/out helpers for consistent UX
 - Settings: dark mode, password modal structure, role display
 - Basic Modal Handlers: close modals on outside click
 
 All data-related functions have been removed.
 Ready for backend/database integration.
====================================================
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
        navigateWithFade(destination);

      } catch (error) {
        console.error('Login error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        var errorMessage = 'Login failed. ';
        
        if (error.code === 'auth/user-not-found') {
          errorMessage += 'No account found with this email. Please make sure you are registered in Firebase Authentication.';
        } else if (error.code === 'auth/wrong-password') {
          errorMessage += 'Incorrect password. Please check your password and try again.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage += 'Invalid email address format.';
        } else if (error.code === 'auth/invalid-credential') {
          errorMessage += 'Invalid email or password. Please verify:\n';
          errorMessage += '1. The email is correct (check for typos)\n';
          errorMessage += '2. The password is correct\n';
          errorMessage += '3. The account exists in Firebase Authentication\n';
          errorMessage += '\nNote: If you were manually added to Firestore, you must also be registered in Firebase Authentication.';
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage += 'Too many failed login attempts. Please try again later.';
        } else if (error.code === 'auth/network-request-failed') {
          errorMessage += 'Network error. Please check your internet connection.';
        } else {
          errorMessage += error.message || 'Unknown error occurred.';
        }
        
        alert(errorMessage);
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
      'admin': 'register-staff.html',           // Admin → Registration pages
      'system_admin': 'register-staff.html',     // System admin → Registration pages
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
      navigateWithFade('reportsViewing.html');
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
      navigateWithFade(href);
    });
  }

  /**
   * Apply role-based access control to sidebar menu items
   * @param {string} userRole - Current user role
   */
  function applyRoleBasedAccessControl(userRole) {
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
        allowed: ['Registration', 'Resident Management', 'Settings'],
        denied: ['Dashboard', 'Reports', 'Ambulance']
      },
      'system_admin': {
        allowed: ['Registration', 'Resident Management', 'Settings'],
        denied: ['Dashboard', 'Reports', 'Ambulance']
      },
      'barangay_staff': {
        allowed: ['Dashboard', 'Reports', 'Ambulance', 'Settings'],
        denied: ['Registration', 'Resident Management']
      },
      'responder': {
        allowed: ['Dashboard', 'Reports', 'Ambulance', 'Settings'],
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

  // ========================================
  // GOOGLE MAPS INITIALIZATION
  // ========================================
  
  /**
   * Initialize Google Maps for dashboard
   * Sets up map with Barangay Hall marker
   */
  var mapEl = document.getElementById('map');
  if (mapEl) {
    window.initISagipMap = function () {
      var defaultCenter = { lat: 14.7332558, lng: 121.0158851 };
      var map = new google.maps.Map(mapEl, {
        center: defaultCenter,
        zoom: 13,
      });

      var selectedMarker = null;
      var infoWindow = new google.maps.InfoWindow();

      // Static Barangay Hall marker (blue-dot like in React)
      new google.maps.Marker({
        position: defaultCenter,
        map: map,
        title: 'Barangay 167 Hall (Silanganan Subdivision, S.M. Bernardo Ave.)',
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          scaledSize: new google.maps.Size(40, 40)
        }
      });

      var reportMarkers = [];
      function typeColor(type) {
        var t = (type || '').toString().toLowerCase();
        if (t.includes('fire')) return 'orange';
        if (t.includes('medical') || t.includes('injur')) return 'blue';
        if (t.includes('police') || t.includes('criminal') || t.includes('hostile')) return 'purple';
        if (t.includes('urgent') || t.includes('emergency')) return 'red';
        return 'green';
      }
      function markerIcon(color) {
        return {
          url: 'http://maps.google.com/mapfiles/ms/icons/' + color + '-dot.png',
          scaledSize: new google.maps.Size(32, 32)
        };
      }
      window.updateISagipMapMarkers = function (items) {
        if (!Array.isArray(items)) return;
        reportMarkers.forEach(function (m) { m.setMap(null); });
        reportMarkers = [];
        items.forEach(function (r) {
          var lat = parseFloat(r.latitude ?? r.lat);
          var lng = parseFloat(r.longitude ?? r.lng);
          if (!isFinite(lat) || !isFinite(lng)) return;
          var marker = new google.maps.Marker({
            position: { lat: lat, lng: lng },
            map: map,
            title: (r.type || 'Emergency') + (r.street ? (' - ' + r.street) : ''),
            icon: markerIcon(typeColor(r.type))
          });
          marker.addListener('click', function () {
            if (selectedMarker === marker) {
              infoWindow.close();
              selectedMarker = null;
              return;
            }
            selectedMarker = marker;
            var time = r.timestampLabel || r.timestamp || '';
            var html = '<div><strong>' + (r.type || 'Emergency') + '</strong>'
              + (r.status ? (' <span style="color:#64748b;">(' + r.status.toString().replace(/[_-]/g, ' ').replace(/\b\w/g, function(ch){ return ch.toUpperCase(); }) + ')</span>') : '')
              + '<br/>' + (r.description || r.landmark || 'No description')
              + (time ? '<br/><span style="font-size:12px;color:#666">Time: ' + time + '</span>' : '')
              + '</div>';
            infoWindow.setContent(html);
            infoWindow.open(map, marker);
          });
          reportMarkers.push(marker);
        });
      };
      if (Array.isArray(window.iSagipPendingMarkersData)) {
        window.updateISagipMapMarkers(window.iSagipPendingMarkersData);
        window.iSagipPendingMarkersData = null;
      }

      map.addListener('click', function () { 
        infoWindow.close(); 
        selectedMarker = null; 
      });
    };
  }

  // ========================================
  // DASHBOARD - REPORTS SUMMARY (Realtime)
  // ========================================
  (function initializeDashboardFromReports(){
    var totalEl = document.getElementById('stat-total-value');
    var badgesEl = document.getElementById('emergency-types-badges');
    var avgEl = document.getElementById('avg-response');
    var exportBtn = document.getElementById('export-csv');
    var testNotifBtn = document.getElementById('test-notification-btn');
    var notifContainer = document.getElementById('notification-container');
    var filterPeriodEl = document.getElementById('filter-period');
    var filterMonthEl = document.getElementById('filter-month');
    var filterYearEl = document.getElementById('filter-year');
    var ongoing = {
      wrap: document.getElementById('ongoing-emergency'),
      type: document.getElementById('ongoing-type'),
      location: document.getElementById('ongoing-location'),
      description: document.getElementById('ongoing-description'),
      status: document.getElementById('ongoing-status'),
      reportedAt: document.getElementById('reported-at'),
      eta: document.getElementById('ongoing-eta')
    };
    if (!totalEl && !badgesEl && !avgEl && !ongoing.wrap) return;

    var REALTIME_DB_URL = 'https://isagip-752d1-default-rtdb.asia-southeast1.firebasedatabase.app';
    var databaseModule = null;
    var realtimeDb = null;
    var reports = [];
    var rawReports = {};
    var yearsAvailable = [];

    function showToast(message){
      if (!notifContainer) { alert(message); return; }
      var el = document.createElement('div');
      el.className = 'notification';
      el.textContent = message;
      notifContainer.appendChild(el);
      setTimeout(function(){ el.classList.add('show'); }, 10);
      setTimeout(function(){ el.classList.remove('show'); }, 2500);
      setTimeout(function(){ el.remove(); }, 3000);
    }

    function normalizeType(value){
      var v = (value || '').toString().toLowerCase();
      if (v.includes('med')) return 'Medical';
      if (v.includes('fire')) return 'Fire';
      if (v.includes('police') || v.includes('crime')) return 'Police';
      return 'General';
    }

    function parseTimestamp(ts){
      var n = Number(ts);
      if (!isNaN(n)) return n;
      var d = new Date(ts);
      return isNaN(d.getTime()) ? Date.now() : d.getTime();
    }

    function computeResponseMinutes(raw){
      if (typeof raw?.responseTimeMinutes === 'number') return raw.responseTimeMinutes;
      var start = parseTimestamp(raw?.timestamp);
      var end = raw?.closedAt ? parseTimestamp(raw.closedAt) : null;
      if (!end) return null;
      return Math.max(0, Math.round((end - start) / 60000));
    }

    function getYear(ts){ var d = new Date(ts); return d.getFullYear(); }
    function getMonth(ts){ var d = new Date(ts); return d.getMonth(); } // 0-11

    function ensureYearOptions(){
      var set = {};
      reports.forEach(function(r){ set[getYear(r.timestampMs)] = true; });
      yearsAvailable = Object.keys(set).map(function(k){ return parseInt(k,10); }).sort(function(a,b){ return a-b; });
      if (!filterYearEl) return;
      var needRebuild = true;
      if (filterYearEl.options && filterYearEl.options.length === yearsAvailable.length){
        needRebuild = yearsAvailable.some(function(y, idx){ return parseInt(filterYearEl.options[idx].value,10) !== y; });
      }
      if (needRebuild){
        filterYearEl.innerHTML = '';
        yearsAvailable.forEach(function(y){
          var opt = document.createElement('option');
          opt.value = String(y);
          opt.textContent = String(y);
          filterYearEl.appendChild(opt);
        });
      }
      var current = parseInt(filterYearEl.value || '0',10);
      if (!current || yearsAvailable.indexOf(current) === -1){
        var prefer = yearsAvailable.indexOf(new Date().getFullYear()) !== -1 ? new Date().getFullYear() : (yearsAvailable[yearsAvailable.length-1] || new Date().getFullYear());
        filterYearEl.value = String(prefer);
      }
    }

    function getFilteredReports(){
      var list = reports.slice();
      if (!list.length) return list;
      var period = (filterPeriodEl && filterPeriodEl.value) ? filterPeriodEl.value : 'month';
      if (period === 'year'){
        var y = filterYearEl ? parseInt(filterYearEl.value || '0',10) : 0;
        if (y) list = list.filter(function(r){ return getYear(r.timestampMs) === y; });
        return list;
      }
      if (period === 'week'){
        var sevenDaysAgo = Date.now() - 7*24*60*60*1000;
        return list.filter(function(r){ return r.timestampMs >= sevenDaysAgo; });
      }
      var yearSel = filterYearEl ? parseInt(filterYearEl.value || '0',10) : 0;
      var monthSel = filterMonthEl ? parseInt(filterMonthEl.value || '-1',10) : -1;
      if (!yearSel){
        yearSel = yearsAvailable.length ? yearsAvailable[yearsAvailable.length-1] : new Date().getFullYear();
        if (filterYearEl) filterYearEl.value = String(yearSel);
      }
      if (monthSel < 0){
        var latestInYear = list
          .filter(function(r){ return getYear(r.timestampMs) === yearSel; })
          .sort(function(a,b){ return b.timestampMs - a.timestampMs; })[0];
        monthSel = latestInYear ? getMonth(latestInYear.timestampMs) : new Date().getMonth();
        if (filterMonthEl) filterMonthEl.value = String(monthSel);
      }
      return list.filter(function(r){ return getYear(r.timestampMs) === yearSel && getMonth(r.timestampMs) === monthSel; });
    }

    function formatStatusText(status){
      if (!status) return 'Pending';
      return status.toString().replace(/[_-]/g, ' ').replace(/\b\w/g, function(ch){ return ch.toUpperCase(); });
    }

    function mapRawReport(id, raw){
      var ts = parseTimestamp(raw?.timestamp);
      return {
        id: id,
        type: normalizeType(raw?.emergencyType || raw?.type),
        description: raw?.description || raw?.desc || '',
        status: (raw?.status || 'Pending').toString(),
        street: raw?.street || raw?.location || '',
        landmark: raw?.landmark || '',
        photo: raw?.photoUrl || raw?.photo || '',
        reportedBy: raw?.userName || raw?.reportedByName || raw?.by || 'Unknown',
        closedBy: raw?.closedBy || raw?.closedByName || '',
        lastUpdatedBy: raw?.lastUpdatedBy || raw?.lastUpdatedByName || '',
        lastUpdatedAtLabel: raw?.lastUpdatedAt ? new Date(Number(raw.lastUpdatedAt)).toLocaleString() : '—',
        notes: raw?.residentNotes || raw?.notes || '',
        latitude: (function(){ var v = parseFloat(raw?.latitude ?? raw?.lat); return isFinite(v) ? v : null; })(),
        longitude: (function(){ var v = parseFloat(raw?.longitude ?? raw?.lng); return isFinite(v) ? v : null; })(),
        timestampMs: ts,
        timestampLabel: new Date(ts).toLocaleString(),
        responseMinutes: computeResponseMinutes(raw),
        responseTimeLabel: (function(){
          var m = computeResponseMinutes(raw);
          return typeof m === 'number' ? (m + ' min') : '—';
        })(),
        actionsLabel: 'View/Manage'
      };
    }

    function updateStats(){
      var source = getFilteredReports();
      if (!source.length) {
        if (totalEl) totalEl.textContent = '0';
        if (avgEl) avgEl.textContent = '0 min';
        if (badgesEl) {
          badgesEl.innerHTML = [
            '<span class="badge badge-blue">Medical: 0</span>',
            '<span class="badge badge-orange">Fire: 0</span>',
            '<span class="badge badge-green">Police: 0</span>'
          ].join(' ');
        }
        if (ongoing.wrap) {
          ongoing.type.textContent = '-';
          ongoing.location.textContent = '-';
          ongoing.description.textContent = '-';
          ongoing.status.textContent = '-';
          ongoing.reportedAt.textContent = '-';
          ongoing.eta.textContent = '-';
        }
        return;
      }

      if (totalEl) totalEl.textContent = String(source.length);

      var counts = { Medical:0, Fire:0, Police:0 };
      source.forEach(function(r){ if (counts[r.type] !== undefined) counts[r.type]++; });
      if (badgesEl) {
        badgesEl.innerHTML = [
          '<span class="badge badge-blue">Medical: '+counts.Medical+'</span>',
          '<span class="badge badge-orange">Fire: '+counts.Fire+'</span>',
          '<span class="badge badge-green">Police: '+counts.Police+'</span>'
        ].join(' ');
      }

      var minutes = source.map(function(r){ return r.responseMinutes; }).filter(function(n){ return typeof n === 'number'; });
      var avg = minutes.length ? Math.round(minutes.reduce(function(a,b){return a+b;},0) / minutes.length) : 0;
      if (avgEl) avgEl.textContent = (minutes.length ? (avg+' min') : '0 min');

      if (ongoing.wrap) {
        var active = source
          .filter(function(r){ return (r.status || '').toString().toLowerCase() !== 'resolved'; })
          .sort(function(a,b){ return b.timestampMs - a.timestampMs; })[0];
        if (active) {
          ongoing.type.textContent = active.type || '-';
          ongoing.location.textContent = active.street || '-';
          ongoing.description.textContent = active.description || '-';
          ongoing.status.textContent = formatStatusText(active.status || '');
          ongoing.reportedAt.textContent = active.timestampLabel || '-';
          ongoing.eta.textContent = '-';
        } else {
          ongoing.type.textContent = '-';
          ongoing.location.textContent = '-';
          ongoing.description.textContent = '-';
          ongoing.status.textContent = '-';
          ongoing.reportedAt.textContent = '-';
          ongoing.eta.textContent = '-';
        }
      }
    }

    function exportReportsCsv(){
      var source = getFilteredReports();
      if (!source.length) { showToast('No data to export'); return; }
      var headers = [
        'ID',
        'Emergency Type',
        'Description',
        'Status',
        'Street',
        'Landmark',
        'Photo',
        'Actions',
        'Timestamp',
        'Response Time',
        'Reported By',
        'Closed By',
        'Last Updated By',
        'Last Updated At',
        'Notes'
      ];
      var rows = source.map(function(r){
        return [
          r.id,
          r.type,
          (r.description || '').replace(/\n/g,' ').replace(/"/g,'""'),
          formatStatusText(r.status),
          r.street,
          r.landmark,
          r.photo || '',
          r.actionsLabel || '',
          r.timestampLabel,
          r.responseTimeLabel,
          r.reportedBy || '',
          r.closedBy || '',
          r.lastUpdatedBy || '',
          r.lastUpdatedAtLabel || '',
          (r.notes || '').replace(/\n/g,' ').replace(/"/g,'""')
        ];
      });
      var csv = [headers].concat(rows).map(function(arr){
        return arr.map(function(cell){
          var val = cell === null || cell === undefined ? '' : String(cell);
          return /[",\n]/.test(val) ? '"' + val.replace(/"/g,'""') + '"' : val;
        }).join(',');
      }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'reports_dashboard_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    async function init(){
      try{
        if (!window.iSagipApp) {
          await new Promise(function(resolve){
            var attempts = 0, max = 50, t = setInterval(function(){
              if (window.iSagipApp) { clearInterval(t); resolve(); }
              else if (++attempts > max) { clearInterval(t); resolve(); }
            }, 200);
            window.addEventListener('firebaseReady', function(){ clearInterval(t); resolve(); }, { once: true });
          });
        }
        databaseModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
        realtimeDb = databaseModule.getDatabase(window.iSagipApp, REALTIME_DB_URL);
        var ref = databaseModule.ref;
        var onValue = databaseModule.onValue;
        var reportsRef = ref(realtimeDb, 'reports');
        onValue(
          reportsRef,
          function(snapshot){
            var value = snapshot.val() || {};
            rawReports = value;
            reports = Object.keys(value).map(function(key){ return mapRawReport(key, value[key] || {}); });
            if (Array.isArray(reports)) {
              if (window.updateISagipMapMarkers) window.updateISagipMapMarkers(reports);
              else window.iSagipPendingMarkersData = reports;
            }
            ensureYearOptions();
            updateStats();
          },
          function(error){
            console.error('Dashboard reports error:', error);
          }
        );
      } catch(err){
        console.error('Failed to initialize dashboard reports feed:', err);
      }
    }

    if (exportBtn) exportBtn.addEventListener('click', exportReportsCsv);
    if (testNotifBtn) testNotifBtn.addEventListener('click', function(){ showToast('Test notification sent'); });
    if (filterPeriodEl) filterPeriodEl.addEventListener('change', function(){ updateStats(); });
    if (filterMonthEl) filterMonthEl.addEventListener('change', function(){ updateStats(); });
    if (filterYearEl) filterYearEl.addEventListener('change', function(){ updateStats(); });
    init();
  })();

  // ========================================
  // AMBULANCE STATUS PAGE FUNCTIONALITY
  // ========================================

  /**
   * Collect responder names from various possible fields on a raw object.
   * Shared between ambulance dashboard and reports page so both can build
   * consistent responder lists.
   * @param {Object} raw
   * @returns {string[]} Unique, trimmed responder names
   */
  function collectResponders(raw) {
    raw = raw || {};
    var responders = [];
    function add(value) {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(add);
        return;
      }
      var str = String(value).trim();
      if (!str) return;
      var parts = str.split(',').map(function(name){ return name.trim(); });
      parts.forEach(function(name){
        if (name && !responders.includes(name)) {
          responders.push(name);
        }
      });
    }

    var assignment = raw.assignment || {};
    add(assignment.responders);
    add(assignment.responder);
    add(assignment.secondaryResponder);
    add(raw.responders);
    add(raw.responder);
    add(raw.responderName);
    add(raw.assignedResponderName);
    add(raw.assignedResponder);
    add(raw.assignedResponders);
    add(raw.responderList);
    add(raw.crewLead);
    add(raw.secondaryResponder);
    add(raw.otherResponder);
    add(raw.crewMembers);
    return responders;
  }

  /**
   * Ambulance status page logic
   * Handles ambulance status display and updates (UI only - data from backend)
   */
  (function setupAmbulance(){
    var grid = document.getElementById('ambulance-grid');
    if (!grid) return;

    var stats = {
      total: document.getElementById('amb-total'),
      available: document.getElementById('amb-available'),
      inUse: document.getElementById('amb-inuse'),
      maintenance: document.getElementById('amb-maintenance')
    };

    var REALTIME_DB_URL = 'https://isagip-752d1-default-rtdb.asia-southeast1.firebasedatabase.app';
    var databaseModule = null;
    var realtimeDb = null;
    var ambulances = [];
    var rawAmbulances = {};

    var ambulanceModal = document.getElementById('ambulance-modal');
    var ambulanceForm = document.getElementById('ambulance-form');
    var ambFormTitle = document.getElementById('amb-form-title');
    var ambLocationInput = document.getElementById('amb-location');
    var ambCrewLeadInput = document.getElementById('amb-crew-lead');
    var ambReportIdInput = document.getElementById('amb-report-id');
    var ambReportTypeInput = document.getElementById('amb-report-type');
    var ambReportAddressInput = document.getElementById('amb-report-address');
    var ambReportDestinationInput = document.getElementById('amb-report-destination');
    var ambMaintNoteInput = document.getElementById('amb-maint-note');
    var ambMaintEtaInput = document.getElementById('amb-maint-eta');
    var ambResponderDropdown = document.getElementById('amb-responders-dropdown');
    var ambResponderList = document.getElementById('amb-responders-list');

    function badge(status){
      var color = status === 'AVAILABLE' ? '#16a34a' : status === 'IN-USE' ? '#f59e0b' : '#ef4444';
      return '<span class="amb-badge" style="color:'+color+'">'+status+'</span>';
    }

    function statusClass(status) {
      if (status === 'AVAILABLE') return 'status-available';
      if (status === 'IN-USE') return 'status-in-use';
      return 'status-maintenance';
    }

    function formatTimestamp(ts) {
      if (!ts) return '—';
      try {
        return new Date(ts).toLocaleString();
      } catch (e) {
        return '—';
      }
    }

    function formatInputDateTime(ts) {
      if (!ts) return '';
      var date = new Date(ts);
      if (isNaN(date.getTime())) return '';
      var pad = function(num) {
        return String(num).padStart(2, '0');
      };
      return (
        date.getFullYear() +
        '-' +
        pad(date.getMonth() + 1) +
        '-' +
        pad(date.getDate()) +
        'T' +
        pad(date.getHours()) +
        ':' +
        pad(date.getMinutes())
      );
    }

    function mapAmbulance(id, raw) {
      if (!raw || typeof raw !== 'object') raw = {};
      var assignment = raw.assignment || null;
      var status = (raw.status || 'AVAILABLE').toUpperCase();
      var responderList = Array.isArray(assignment?.responders)
        ? assignment.responders.slice()
        : collectResponders({ assignment: assignment, crewLead: raw.crewLead, secondaryResponder: raw.secondaryResponder });

      return {
        id: id,
        name: raw.name || ('Ambulance ' + id),
        callsign: raw.callsign || '',
        status: status,
        location: raw.location || 'Central Station Garage',
        crewLead: raw.crewLead || '',
        secondaryResponder: raw.secondaryResponder || raw.otherResponder || '',
        assignment: assignment,
        assignmentId: raw.assignmentId || (assignment && assignment.id) || null,
        maintenanceNote: raw.maintenanceNote || '',
        maintenanceEta: raw.maintenanceEta || null,
        responders: responderList,
        lastUpdated: raw.lastUpdated || raw.updatedAt || null
      };
    }

    function renderAssignment(amb) {
      var assignment = amb.assignment || null;
      var reportId = assignment?.id || amb.assignmentId;
      if (!assignment && !amb.assignmentId) return '';
      var typeLabel = assignment?.type || 'Emergency Dispatch';
      var destination = assignment?.destination || '';
      var address = assignment?.address || '';
      var responders = Array.isArray(amb.responders) ? amb.responders : [];

      return (
        '<div class="amb-assignment">'+
          '<div class="amb-assignment-header">'+
            '<span>Assigned to Report</span>'+
            '<span class="amb-pill">'+typeLabel+'</span>'+
          '</div>'+
          '<p><strong>Report ID:</strong> '+(reportId || 'Pending')+'</p>'+
          (address ? '<p><strong>Location:</strong> '+address+'</p>' : '')+
          (destination ? '<p><strong>Destination:</strong> '+destination+'</p>' : '')+
          '<details class="amb-responders">'+
            '<summary>Responders'+(responders.length ? ' ('+responders.length+')' : '')+'</summary>'+
            '<ul>'+
              (
                responders.length
                  ? responders.map(function(name){ return '<li>'+name+'</li>'; }).join('')
                  : '<li class="muted">No responders recorded</li>'
              )+
            '</ul>'+
          '</details>'+
          (assignment?.responder ? '<p><strong>Second Responder:</strong> '+assignment.responder+'</p>' : '')+
        '</div>'
      );
    }

    function renderMaintenance(amb) {
      if (amb.status !== 'MAINTENANCE') return '';
      var note = amb.maintenanceNote || 'Routine inspection';
      var eta = amb.maintenanceEta ? formatTimestamp(amb.maintenanceEta) : 'TBD';
      return (
        '<div class="amb-maintenance">'+
          '<strong>Maintenance in progress</strong>'+
          '<div>'+note+'</div>'+
          '<div><strong>Estimated back:</strong> '+eta+'</div>'+
        '</div>'
      );
    }

    function updateSummary() {
      var total = ambulances.length;
      var available = ambulances.filter(function(a){ return a.status === 'AVAILABLE'; }).length;
      var inUse = ambulances.filter(function(a){ return a.status === 'IN-USE'; }).length;
      var maintenance = ambulances.filter(function(a){ return a.status === 'MAINTENANCE'; }).length;

      if (stats.total) stats.total.textContent = total;
      if (stats.available) stats.available.textContent = available;
      if (stats.inUse) stats.inUse.textContent = inUse;
      if (stats.maintenance) stats.maintenance.textContent = maintenance;
    }

    function render(){
      updateSummary();
      if (ambulances.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:2rem;color:#64748b;">No ambulances available. Data will be loaded from database.</div>';
        return;
      }
      
      grid.innerHTML = ambulances.map(function(a){
        return (
          '<div class="ambulance-card '+statusClass(a.status)+'" data-id="'+a.id+'">'+
            '<div>'+
              '<div class="amb-title">'+a.name+(a.callsign ? ' <span class="amb-subtitle">'+a.callsign+'</span>' : '')+'</div>'+
              '<div class="amb-status">Status: '+badge(a.status)+'</div>'+
            '</div>'+
            (a.location?'<div class="amb-meta"><span>Location:</span> '+a.location+(a.assignmentId? ' <small>(Report '+a.assignmentId+')</small>':'' )+'</div>':'')+
            (a.crewLead?'<div class="amb-meta"><span>Crew Lead:</span> '+a.crewLead+'</div>':'')+
            (a.secondaryResponder?'<div class="amb-meta"><span>Second Responder:</span> '+a.secondaryResponder+'</div>':'')+
            '<div class="amb-meta"><span>Last Update:</span> '+formatTimestamp(a.lastUpdated)+'</div>'+
            renderAssignment(a)+
            renderMaintenance(a)+
            '<div class="amb-actions">'+
              '<button class="amb-btn amb-manage">VIEW / UPDATE DETAILS</button>'+
              '<button class="amb-btn set-available">MARK AVAILABLE</button>'+
              '<button class="amb-btn set-maint">MARK MAINTENANCE</button>'+
            '</div>'+
          '</div>'
        );
      }).join('');
    }
    
    render();

    // Handle status change buttons
    grid.addEventListener('click', async function(e){
      var card = e.target.closest('.ambulance-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      var amb = ambulances.find(function(x){return String(x.id)===String(id);});
      if (!amb) return;
      
      if (e.target.classList.contains('amb-manage')) {
        openAmbulanceModal(amb);
        return;
      }
      var newStatus = null;
      
      if (e.target.classList.contains('set-available')) {
        newStatus = 'AVAILABLE';
      } else if (e.target.classList.contains('set-maint')) {
        newStatus = 'MAINTENANCE';
      }
      if (!newStatus || amb.status === newStatus) return;

      try {
        await persistAmbulanceStatus(amb.id, newStatus);
      } catch (error) {
        console.error('Failed to update ambulance status:', error);
        alert('Unable to update ambulance status. Please try again.');
      }
    });
    
    async function persistAmbulanceStatus(id, status) {
      if (!databaseModule || !realtimeDb) {
        throw new Error('Realtime database not ready');
      }
      var actor = localStorage.getItem('iSagip_userUID') || 'staff';
      var updates = {
        status: status,
        lastUpdated: Date.now(),
        lastUpdatedBy: actor
      };
      if (status !== 'IN-USE') {
        updates.assignment = null;
        updates.assignmentId = null;
      }
      return updateAmbulanceRecord(id, updates);
    }

    async function persistAmbulanceDetails(id, formValues) {
      if (!databaseModule || !realtimeDb) {
        throw new Error('Realtime database not ready');
      }
      var actor = localStorage.getItem('iSagip_userUID') || 'staff';
      var updates = Object.assign({}, formValues, {
        lastUpdated: Date.now(),
        lastUpdatedBy: actor
      });
      return updateAmbulanceRecord(id, updates);
    }

    function updateAmbulanceRecord(id, updates) {
      var ref = databaseModule.ref;
      var update = databaseModule.update;
      return update(ref(realtimeDb, 'ambulances/' + id), updates);
    }

    function waitForFirebaseApp() {
      if (window.iSagipApp) return Promise.resolve();
      return new Promise(function(resolve) {
        var attempts = 0;
        var maxAttempts = 50;
        var interval = setInterval(function() {
          if (window.iSagipApp) {
            clearInterval(interval);
            resolve();
          } else if (attempts > maxAttempts) {
            clearInterval(interval);
            resolve();
          }
          attempts += 1;
        }, 200);
        window.addEventListener(
          'firebaseReady',
          function handleReady() {
            clearInterval(interval);
            window.removeEventListener('firebaseReady', handleReady);
            resolve();
          },
          { once: true }
        );
      });
    }

    async function initializeAmbulanceRealtime() {
      try {
        await waitForFirebaseApp();
        databaseModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
        var getDatabase = databaseModule.getDatabase;
        var ref = databaseModule.ref;
        var onValue = databaseModule.onValue;
        realtimeDb = getDatabase(window.iSagipApp, REALTIME_DB_URL);
        var ambulancesRef = ref(realtimeDb, 'ambulances');
        onValue(
          ambulancesRef,
          function(snapshot) {
            var value = snapshot.val() || {};
            rawAmbulances = value;
            ambulances = Object.keys(value).map(function(key) {
              return mapAmbulance(key, value[key]);
            });
            render();
          },
          function(error) {
            console.error('Ambulance realtime error:', error);
          }
        );
      } catch (error) {
        console.error('Failed to initialize ambulance realtime data:', error);
      }
    }

    render();
    initializeAmbulanceRealtime();

    function openAmbulanceModal(amb) {
      if (!ambulanceModal || !ambulanceForm) return;
      ambulanceModal.dataset.ambId = amb.id;
      if (ambFormTitle) ambFormTitle.textContent = amb.name + ' Details';
      if (ambLocationInput) ambLocationInput.value = amb.location || '';
      if (ambCrewLeadInput) ambCrewLeadInput.value = amb.crewLead || '';
      var assignment = amb.assignment || {};
      if (ambReportIdInput) ambReportIdInput.value = (assignment.id || amb.assignmentId || '') || '';
      if (ambReportTypeInput) ambReportTypeInput.value = assignment.type || '';
      if (ambReportAddressInput) ambReportAddressInput.value = assignment.address || '';
      if (ambReportDestinationInput) ambReportDestinationInput.value = assignment.destination || '';
      if (ambMaintNoteInput) ambMaintNoteInput.value = amb.maintenanceNote || '';
      if (ambMaintEtaInput) ambMaintEtaInput.value = formatInputDateTime(amb.maintenanceEta);
      if (ambResponderList) {
        var responderList = (Array.isArray(amb.responders) && amb.responders.length)
          ? amb.responders
          : (Array.isArray(assignment.responders) ? assignment.responders : []);
        ambResponderList.innerHTML = responderList.length
          ? responderList.map(function(name){ return '<li>'+name+'</li>'; }).join('')
          : '<li class="muted">No responders recorded</li>';
      }
      if (ambResponderDropdown) {
        ambResponderDropdown.open = false;
      }
      ambulanceModal.hidden = false;
    }

    function closeAmbulanceModal() {
      if (ambulanceModal) {
        ambulanceModal.hidden = true;
        delete ambulanceModal.dataset.ambId;
      }
      if (ambulanceForm) {
        ambulanceForm.reset();
      }
    }

    if (ambulanceModal) {
      ambulanceModal.addEventListener('click', function(e) {
        if (e.target === ambulanceModal || e.target.hasAttribute('data-close')) {
          closeAmbulanceModal();
        }
      });
    }

    ambulanceForm?.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!ambulanceModal?.dataset.ambId) return;
      var id = ambulanceModal.dataset.ambId;
      var current = ambulances.find(function(a){ return String(a.id) === String(id); }) || {};
      var maintenanceEtaValue = ambMaintEtaInput?.value ? Date.parse(ambMaintEtaInput.value) : null;
      var updates = {
        maintenanceNote: ambMaintNoteInput?.value.trim() || '',
        maintenanceEta: maintenanceEtaValue || null
      };

      try {
        await persistAmbulanceDetails(id, updates);
        closeAmbulanceModal();
      } catch (error) {
        console.error('Failed to save ambulance details:', error);
        alert('Unable to save ambulance details. Please try again.');
      }
    });
  })();

  // ========================================
  // STAFF/RESPONDER REGISTRATION
  // ========================================
  
  /**
   * Handle staff/responder registration form submission
   * Creates Firebase Auth user and saves data to Firestore
   */
  (function setupStaffRegistration() {
    var registerForm = document.getElementById('register-form');
    if (!registerForm) return;

    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Get form values
      var role = document.getElementById('reg-role').value;
      var responderType = document.getElementById('reg-responder-type').value;
      var username = document.getElementById('reg-username').value.trim();
      var email = document.getElementById('reg-email').value.trim();
      var password = document.getElementById('reg-password').value;
      var password2 = document.getElementById('reg-password2').value;
      var firstName = document.getElementById('reg-first').value.trim();
      var middleName = document.getElementById('reg-middle').value.trim();
      var lastName = document.getElementById('reg-last').value.trim();
      var age = document.getElementById('reg-age').value.trim();
      var birthDate = document.getElementById('reg-birth').value.trim();
      var contact = document.getElementById('reg-contact').value.trim();
      var address = document.getElementById('reg-address').value.trim();

      // Validation
      if (!username || !email || !password || !firstName || !lastName || !age || !birthDate || !contact || !address) {
        alert('Please fill in all required fields.');
        return;
      }

      if (password !== password2) {
        alert('Passwords do not match.');
        return;
      }

      if (password.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
      }

      if (role === 'responder' && !responderType) {
        alert('Please select responder type.');
        return;
      }

      // Check if Firebase is available
      if (!window.iSagipAuth || !window.iSagipDb) {
        alert('Firebase is not initialized. Please refresh the page.');
        return;
      }

      try {
        // Import Firebase Auth functions
        const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");
        const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");

        // Create user in Firebase Auth
        const auth = window.iSagipAuth;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Prepare user data for Firestore
        var userData = {
          uid: user.uid,
          username: username,
          email: email,
          role: role,
          firstName: firstName,
          middleName: middleName || '',
          lastName: lastName,
          age: parseInt(age) || 0,
          birthDate: birthDate,
          contact: contact,
          address: address,
          createdAt: serverTimestamp(),
          status: 'active'
        };

        // Add responder type if role is responder
        if (role === 'responder') {
          userData.responderType = responderType;
        }

        // Save to Firestore using user.uid as document ID
        // Save to different collections based on role
        const db = window.iSagipDb;
        if (role === 'responder') {
          // Save responder to 'responder' collection
          await setDoc(doc(db, 'responder', user.uid), userData);
        } else if (role === 'barangay_staff') {
          // Save barangay staff to 'staff' collection
          await setDoc(doc(db, 'staff', user.uid), userData);
        } else {
          // Default fallback (shouldn't happen, but just in case)
          await setDoc(doc(db, 'staff', user.uid), userData);
        }

        alert('Registration successful! User has been created.');
        registerForm.reset();

      } catch (error) {
        console.error('Registration error:', error);
        var errorMessage = 'Registration failed. ';
        if (error.code === 'auth/email-already-in-use') {
          errorMessage += 'Email is already registered.';
        } else if (error.code === 'auth/weak-password') {
          errorMessage += 'Password is too weak.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage += 'Invalid email address.';
        } else {
          errorMessage += error.message;
        }
        alert(errorMessage);
      }
    });
  })();

  // ========================================
  // REGISTRATION PAGE TAB SWITCHING (UI ONLY)
  // ========================================
  
  /**
   * Registration page tab switching
   * Handles UI tab switching between staff and resident registration forms
   */
  (function setupRegisterTabs(){
    var tabsContainer = document.querySelector('main .tabs');
    var respForm = document.getElementById('register-form');
    var residentForm = document.getElementById('resident-register-form');
    var roleSel = document.getElementById('reg-role');
    var responderWrap = document.getElementById('reg-responder-type-wrap');
    
    if (tabsContainer && respForm && residentForm) {
      // Ensure initial state: show responder/staff, hide resident
      respForm.hidden = false;
      residentForm.hidden = true;
      
      tabsContainer.addEventListener('click', function(e){
        var btn = e.target.closest('.tab');
        if (!btn) return;
        tabsContainer.querySelectorAll('.tab').forEach(function(b){ 
          b.classList.remove('active'); 
        });
        btn.classList.add('active');
        var t = btn.getAttribute('data-tab');
        if (t === 'resident') { 
          respForm.hidden = true; 
          residentForm.hidden = false; 
        } else { 
          respForm.hidden = false; 
          residentForm.hidden = true; 
        }
      });
      
      // Enable role toggle when switching back to staff tab
      var staffTab = tabsContainer.querySelector('#tab-staff');
      if (staffTab) {
        staffTab.addEventListener('click', function(){
          if (roleSel && responderWrap) {
            responderWrap.style.display = (roleSel.value === 'responder') ? '' : 'none';
          }
        });
      }
    }
    
    // Role selector toggle for responder type
    if (roleSel && responderWrap) {
      var toggleResponder = function(){
        var isResponder = roleSel.value === 'responder';
        responderWrap.style.display = isResponder ? '' : 'none';
      };
      roleSel.addEventListener('change', toggleResponder);
      toggleResponder();
    }
  })();

  // ========================================
  // GLOBAL MODAL CLOSE HANDLERS
  // ========================================
  
  /**
   * Global modal close functionality
   * Closes modals when clicking outside or on close buttons
   */
    document.addEventListener('click', function(e){
    // Close modals when clicking close button
      if (e.target.matches('[data-close]')) {
      var modal = e.target.closest('.modal');
      if (modal) {
        modal.hidden = true;
      }
    }
    // Close modals when clicking outside
      if (e.target.classList.contains('modal')) {
        e.target.hidden = true;
      }
    });

  // ========================================
  // GLOBAL DARK MODE INITIALIZATION
  // ========================================
  
  /**
   * Initialize dark mode for all pages
   * Applies saved theme preference on page load
   */
  (function initializeGlobalDarkMode() {
    const savedTheme = localStorage.getItem('iSagip_theme') || 'light';
    applyTheme(savedTheme);
    // Ensure page enters with fade
    document.addEventListener('DOMContentLoaded', function(){
      document.body.classList.add('page-enter');
    });
  })();

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
   */
  function initializeDarkModeToggle() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (!darkModeToggle) return;
    
    // Load saved theme preference from localStorage
    const savedTheme = localStorage.getItem('iSagip_theme') || 'light';
    applyTheme(savedTheme);
    darkModeToggle.checked = savedTheme === 'dark';
    
    // Handle toggle change event
    darkModeToggle.addEventListener('change', function() {
      const newTheme = this.checked ? 'dark' : 'light';
      applyTheme(newTheme);
      localStorage.setItem('iSagip_theme', newTheme);
    });
  }

  /**
   * Apply theme to the document
   * @param {string} theme - 'light' or 'dark'
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Force re-render of elements that might not update automatically
    setTimeout(() => {
      // Trigger a reflow to ensure all elements update
      document.body.offsetHeight;
      
      // Update any custom elements or components
      updateCustomElementsForTheme(theme);
    }, 100);
  }

  /**
   * Update custom elements for theme changes
   * @param {string} theme - Current theme
   */
  function updateCustomElementsForTheme(theme) {
    // Update any elements that need special handling
    const elementsToUpdate = [
      '.table', '.stat', '.ambulance-card', '.notification',
      '.modal-dialog', '.settings-section', '.search-section'
    ];
    
    elementsToUpdate.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // Force style recalculation
        element.style.display = 'none';
        element.offsetHeight; // Trigger reflow
        element.style.display = '';
      });
    });
  }

  // ========================================
  // GLOBAL NAVIGATION FADE HELPER
  // ========================================
  function navigateWithFade(url){
    // Guard: if user prefers reduced motion, skip transition
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { 
      window.location.href = url; 
      return; 
    }

    document.body.classList.remove('page-enter');
    document.body.classList.add('page-leave');
    setTimeout(function(){ 
      window.location.href = url; 
    }, 180);
  }

  /**
   * Initialize password change functionality
   * Handles modal opening/closing (form submission will be handled by backend)
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
    
    // Handle form submission (backend integration needed)
    if (passwordForm) {
      passwordForm.addEventListener('submit', function(e) {
        e.preventDefault();
        // TODO: Implement password change with backend API
        // For now, just close modal
        closePasswordModal();
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
      'barangay_staff': 'Barangay Staff',
      'live_viewer': 'Live Viewer'
    };
    
    roleDisplay.textContent = roleNames[userRole] || 'Unknown Role';
  }

  // ========================================
  // RESIDENT MANAGEMENT - REGISTRATION REVIEW
  // ========================================
  
  /**
   * Initialize resident management page
   * Handles pending registration requests review and approved residents management
   */
  (function initializeResidentManagement() {
    // Check if we're on the resident management page
    if (!document.getElementById('pending-requests')) return;

    let pendingRequests = [];
    let approvedResidents = [];
    let currentReviewRequest = null;

    // Initialize Firebase imports
    let db, collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, 
        setDoc, serverTimestamp, orderBy, Timestamp, ref, getDownloadURL, storage;

    // Load Firebase functions - wait for Firebase to be ready
    async function loadFirebase() {
      // Wait for Firebase to initialize
      if (!window.iSagipDb) {
        // If Firebase isn't ready yet, wait for the event
        await new Promise((resolve) => {
          if (window.iSagipDb) {
            resolve();
            return;
          }
          window.addEventListener('firebaseReady', resolve, { once: true });
          // Fallback timeout after 5 seconds
          setTimeout(() => {
            if (!window.iSagipDb) {
              console.error('Firebase initialization timeout');
              resolve();
            }
          }, 5000);
        });
      }

      if (!window.iSagipDb) {
        console.error('Firebase not initialized');
        return;
      }

      const firestore = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
      const storageModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js");
      
      db = window.iSagipDb;
      collection = firestore.collection;
      query = firestore.query;
      where = firestore.where;
      getDocs = firestore.getDocs;
      doc = firestore.doc;
      getDoc = firestore.getDoc;
      updateDoc = firestore.updateDoc;
      deleteDoc = firestore.deleteDoc;
      setDoc = firestore.setDoc;
      serverTimestamp = firestore.serverTimestamp;
      orderBy = firestore.orderBy;
      Timestamp = firestore.Timestamp;
      
      storage = storageModule.getStorage(window.iSagipApp);
      ref = storageModule.ref;
      getDownloadURL = storageModule.getDownloadURL;

      // Load data
      loadPendingRequests();
      loadApprovedResidents();
    }

    // Start loading when page is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadFirebase);
    } else {
      // If Firebase is already ready, load immediately
      if (window.iSagipDb) {
        loadFirebase();
      } else {
        // Otherwise wait for the firebaseReady event
        window.addEventListener('firebaseReady', loadFirebase, { once: true });
      }
    }

    /**
     * Load pending registration requests from Firestore
     */
    async function loadPendingRequests() {
      if (!db) {
        console.error('Database not available');
        return;
      }
      
      console.log('Loading pending requests...');
      
      try {
        const requestsRef = collection(db, 'resident_requests');
        console.log('Collection reference created');
        
        // Try with orderBy first
        let q;
        let snapshot;
        
        try {
          q = query(requestsRef, where('status', '==', 'pending'), orderBy('requestedAt', 'desc'));
          snapshot = await getDocs(q);
          console.log('Query with orderBy successful, found:', snapshot.size, 'documents');
        } catch (orderByError) {
          console.warn('OrderBy failed, trying without orderBy:', orderByError);
          // If orderBy fails (missing index), try without it
          q = query(requestsRef, where('status', '==', 'pending'));
          snapshot = await getDocs(q);
          console.log('Query without orderBy successful, found:', snapshot.size, 'documents');
        }
        
        pendingRequests = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          console.log('Document found:', docSnap.id, data);
          pendingRequests.push({
            id: docSnap.id,
            ...data
          });
        });
        
        console.log('Total pending requests loaded:', pendingRequests.length);
        
        // If we loaded without orderBy, sort manually
        if (pendingRequests.length > 0) {
          pendingRequests.sort((a, b) => {
            const dateA = a.requestedAt?.toDate?.() || new Date(0);
            const dateB = b.requestedAt?.toDate?.() || new Date(0);
            return dateB - dateA; // Descending
          });
        }
        
        renderPendingRequests();
      } catch (error) {
        console.error('Error loading pending requests:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Show error in UI
        const container = document.getElementById('pending-requests');
        const emptyState = document.getElementById('pending-empty');
        
        if (container) {
          container.innerHTML = `
            <div class="t-row" style="grid-column: 1/-1; padding: 2rem; text-align: center;">
              <div style="color: #ef4444;">
                <strong>Error loading requests</strong><br/>
                ${error.message || 'Unknown error'}<br/>
                <small style="color: var(--muted); margin-top: 8px; display: block;">
                  Check console (F12) for details
                </small>
              </div>
            </div>
          `;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        pendingRequests = [];
      }
    }

    /**
     * Render pending requests in the table
     */
    function renderPendingRequests() {
      const container = document.getElementById('pending-requests');
      const emptyState = document.getElementById('pending-empty');
      
      if (!container) {
        console.error('Container not found');
        return;
      }

      console.log('Rendering', pendingRequests.length, 'pending requests');

      // Apply search filter
      const searchTerm = document.getElementById('pending-search')?.value.toLowerCase() || '';
      const sortBy = document.getElementById('pending-sort')?.value || 'newest';
      
      let filtered = pendingRequests.filter(req => {
        const name = `${req.firstName || ''} ${req.lastName || ''}`.toLowerCase();
        const email = (req.email || '').toLowerCase();
        const username = (req.username || '').toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm) || username.includes(searchTerm);
      });

      console.log('After filtering:', filtered.length, 'requests');

      // Apply sorting
      if (sortBy === 'oldest') {
        filtered.sort((a, b) => {
          const dateA = a.requestedAt?.toDate?.() || new Date(0);
          const dateB = b.requestedAt?.toDate?.() || new Date(0);
          return dateA - dateB;
        });
      } else if (sortBy === 'name') {
        filtered.sort((a, b) => {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
      }

      if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) {
          emptyState.style.display = 'block';
          console.log('No requests to display, showing empty state');
        }
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      console.log('Rendering', filtered.length, 'filtered requests to table');

      container.innerHTML = filtered.map(req => {
        const requestDate = req.requestedAt?.toDate?.() || new Date();
        const dateStr = requestDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        const hasId = req.idDocumentUrl || req.idDocumentPath;
        
        return `
          <div class="t-row" data-request-id="${req.id}">
            <div>${dateStr}</div>
            <div>${req.firstName || ''} ${req.middleName || ''} ${req.lastName || ''}</div>
            <div>${req.email || 'N/A'}</div>
            <div>${req.contact || 'N/A'}</div>
            <div>${hasId ? '<span style="color: #10b981;">✓ Yes</span>' : '<span style="color: #ef4444;">✗ No</span>'}</div>
            <div>
              <button class="btn btn-small btn-primary review-btn" data-request-id="${req.id}">Review</button>
            </div>
          </div>
        `;
      }).join('');

      // Attach event listeners
      container.querySelectorAll('.review-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const requestId = this.getAttribute('data-request-id');
          openReviewModal(requestId);
        });
      });
      
      console.log('Table rendered successfully');
    }

    /**
     * Load approved residents from Firestore
     */
    async function loadApprovedResidents() {
      if (!db) return;
      
      try {
        const residentsRef = collection(db, 'residents');
        const q = query(residentsRef, orderBy('approvedAt', 'desc'));
        const snapshot = await getDocs(q);
        
        approvedResidents = [];
        snapshot.forEach((docSnap) => {
          approvedResidents.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        renderApprovedResidents();
      } catch (error) {
        console.error('Error loading approved residents:', error);
        approvedResidents = [];
        renderApprovedResidents();
      }
    }

    /**
     * Render approved residents in the table
     */
    function renderApprovedResidents() {
      const container = document.getElementById('approved-residents');
      const emptyState = document.getElementById('approved-empty');
      
      if (!container) return;

      // Apply filters
      const searchTerm = document.getElementById('approved-search')?.value.toLowerCase() || '';
      const statusFilter = document.getElementById('approved-status')?.value || 'all';
      
      let filtered = approvedResidents.filter(res => {
        const name = `${res.firstName || ''} ${res.lastName || ''}`.toLowerCase();
        const email = (res.email || '').toLowerCase();
        const username = (res.username || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm) || username.includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
        return matchesSearch && matchesStatus;
      });

      if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      container.innerHTML = filtered.map(res => {
        const statusBadge = res.status === 'active' 
          ? '<span style="color: #10b981; font-weight: 600;">Active</span>'
          : '<span style="color: #ef4444; font-weight: 600;">Inactive</span>';
        
        return `
          <div class="t-row" data-resident-id="${res.id}">
            <div>${res.username || 'N/A'}</div>
            <div>${res.firstName || ''} ${res.middleName || ''} ${res.lastName || ''}</div>
            <div>${res.email || 'N/A'}</div>
            <div>${res.contact || 'N/A'}</div>
            <div>${statusBadge}</div>
            <div>
              <button class="btn btn-small btn-outline edit-resident-btn" data-resident-id="${res.id}">Edit</button>
              <button class="btn btn-small btn-outline reset-password-btn" data-resident-id="${res.id}">Reset Password</button>
            </div>
          </div>
        `;
      }).join('');

      // Attach event listeners
      container.querySelectorAll('.edit-resident-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const residentId = this.getAttribute('data-resident-id');
          openEditModal(residentId);
        });
      });

      container.querySelectorAll('.reset-password-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const residentId = this.getAttribute('data-resident-id');
          openResetPasswordModal(residentId);
        });
      });
    }

    /**
     * Open review modal for a registration request
     */
    async function openReviewModal(requestId) {
      if (!db) return;
      
      const request = pendingRequests.find(r => r.id === requestId);
      if (!request) {
        alert('Request not found');
        return;
      }

      currentReviewRequest = request;
      const modal = document.getElementById('review-modal');
      if (!modal) return;

      // Populate form fields
      document.getElementById('review-username').value = request.username || '';
      document.getElementById('review-email').value = request.email || '';
      document.getElementById('review-name').value = `${request.firstName || ''} ${request.middleName || ''} ${request.lastName || ''}`.trim();
      document.getElementById('review-gender').value = request.gender || 'N/A';
      document.getElementById('review-birth').value = request.birthDate || 'N/A';
      document.getElementById('review-contact').value = request.contact || 'N/A';
      document.getElementById('review-address').value = request.address || 'N/A';
      
      const requestDate = request.requestedAt?.toDate?.() || new Date();
      document.getElementById('review-date').value = requestDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Load ID document
      const idPreview = document.getElementById('id-preview');
      const idPlaceholder = document.getElementById('id-placeholder');
      const idFullscreenImg = document.getElementById('id-fullscreen-img');
      
      if (request.idDocumentUrl) {
        idPreview.src = request.idDocumentUrl;
        idPreview.style.display = 'block';
        if (idPlaceholder) idPlaceholder.style.display = 'none';
        if (idFullscreenImg) idFullscreenImg.src = request.idDocumentUrl;
      } else if (request.idDocumentPath && storage) {
        try {
          const storageRef = ref(storage, request.idDocumentPath);
          const url = await getDownloadURL(storageRef);
          idPreview.src = url;
          idPreview.style.display = 'block';
          if (idPlaceholder) idPlaceholder.style.display = 'none';
          if (idFullscreenImg) idFullscreenImg.src = url;
        } catch (error) {
          console.error('Error loading ID document:', error);
          idPreview.style.display = 'none';
          if (idPlaceholder) idPlaceholder.style.display = 'block';
        }
      } else {
        idPreview.style.display = 'none';
        if (idPlaceholder) idPlaceholder.style.display = 'block';
      }

      modal.hidden = false;
    }

    /**
     * Approve a registration request
     */
    async function approveRequest() {
      if (!currentReviewRequest || !db) return;

      if (!confirm('Are you sure you want to approve this registration request?')) {
        return;
      }

      try {
        const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");
        const auth = window.iSagipAuth;

        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          currentReviewRequest.email,
          currentReviewRequest.password || 'TempPassword123!' // In production, generate a secure temp password
        );
        const user = userCredential.user;

        // Save to residents collection
        const residentData = {
          uid: user.uid,
          username: currentReviewRequest.username,
          email: currentReviewRequest.email,
          firstName: currentReviewRequest.firstName,
          middleName: currentReviewRequest.middleName || '',
          lastName: currentReviewRequest.lastName,
          gender: currentReviewRequest.gender,
          birthDate: currentReviewRequest.birthDate,
          contact: currentReviewRequest.contact,
          address: currentReviewRequest.address,
          idDocumentUrl: currentReviewRequest.idDocumentUrl || '',
          idDocumentPath: currentReviewRequest.idDocumentPath || '',
          status: 'active',
          approvedAt: serverTimestamp(),
          approvedBy: localStorage.getItem('iSagip_userUID') || '',
          createdAt: serverTimestamp()
        };

        await setDoc(doc(db, 'residents', user.uid), residentData);

        // Update request status
        await updateDoc(doc(db, 'resident_requests', currentReviewRequest.id), {
          status: 'approved',
          approvedAt: serverTimestamp(),
          approvedBy: localStorage.getItem('iSagip_userUID') || ''
        });

        alert('Registration request approved successfully!');
        
        // Close modal and reload data
        document.getElementById('review-modal').hidden = true;
        currentReviewRequest = null;
        loadPendingRequests();
        loadApprovedResidents();
      } catch (error) {
        console.error('Error approving request:', error);
        alert('Error approving request: ' + (error.message || 'Unknown error'));
      }
    }

    /**
     * Reject a registration request
     */
    async function rejectRequest() {
      if (!currentReviewRequest || !db) return;

      const reason = prompt('Please provide a reason for rejection (optional):');
      if (reason === null) return; // User cancelled

      if (!confirm('Are you sure you want to reject this registration request?')) {
        return;
      }

      try {
        await updateDoc(doc(db, 'resident_requests', currentReviewRequest.id), {
          status: 'rejected',
          rejectedAt: serverTimestamp(),
          rejectedBy: localStorage.getItem('iSagip_userUID') || '',
          rejectionReason: reason || ''
        });

        alert('Registration request rejected.');
        
        // Close modal and reload data
        document.getElementById('review-modal').hidden = true;
        currentReviewRequest = null;
        loadPendingRequests();
      } catch (error) {
        console.error('Error rejecting request:', error);
        alert('Error rejecting request: ' + (error.message || 'Unknown error'));
      }
    }

    /**
     * Open edit modal for approved resident
     */
    function openEditModal(residentId) {
      const resident = approvedResidents.find(r => r.id === residentId);
      if (!resident) {
        alert('Resident not found');
        return;
      }

      const modal = document.getElementById('res-edit-modal');
      if (!modal) return;

      document.getElementById('edit-first').value = resident.firstName || '';
      document.getElementById('edit-last').value = resident.lastName || '';
      document.getElementById('edit-email').value = resident.email || '';
      document.getElementById('edit-contact').value = resident.contact || '';
      document.getElementById('edit-address').value = resident.address || '';
      document.getElementById('edit-status').value = resident.status || 'active';

      modal.hidden = false;
      modal.dataset.residentId = residentId;
    }

    /**
     * Open reset password modal
     */
    function openResetPasswordModal(residentId) {
      const modal = document.getElementById('res-reset-modal');
      if (!modal) return;

      modal.hidden = false;
      modal.dataset.residentId = residentId;
    }

    // Event listeners
    document.getElementById('approve-request')?.addEventListener('click', approveRequest);
    document.getElementById('reject-request')?.addEventListener('click', rejectRequest);
    
    document.getElementById('view-id-fullscreen')?.addEventListener('click', function() {
      const fullscreenModal = document.getElementById('id-fullscreen-modal');
      if (fullscreenModal) fullscreenModal.hidden = false;
    });

    document.getElementById('download-id')?.addEventListener('click', function() {
      if (currentReviewRequest?.idDocumentUrl) {
        const link = document.createElement('a');
        link.href = currentReviewRequest.idDocumentUrl;
        link.download = `id_${currentReviewRequest.username || 'document'}.jpg`;
        link.click();
      } else {
        alert('ID document URL not available');
      }
    });

    // Search and filter listeners
    document.getElementById('pending-search')?.addEventListener('input', renderPendingRequests);
    document.getElementById('pending-sort')?.addEventListener('change', renderPendingRequests);
    document.getElementById('approved-search')?.addEventListener('input', renderApprovedResidents);
    document.getElementById('approved-status')?.addEventListener('change', renderApprovedResidents);

    // Save resident edit
    document.getElementById('res-save')?.addEventListener('click', async function() {
      const modal = document.getElementById('res-edit-modal');
      const residentId = modal?.dataset.residentId;
      if (!residentId || !db) return;

      try {
        const updates = {
          firstName: document.getElementById('edit-first').value,
          lastName: document.getElementById('edit-last').value,
          email: document.getElementById('edit-email').value,
          contact: document.getElementById('edit-contact').value,
          address: document.getElementById('edit-address').value,
          status: document.getElementById('edit-status').value,
          updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, 'residents', residentId), updates);
        alert('Resident updated successfully!');
        modal.hidden = true;
        loadApprovedResidents();
      } catch (error) {
        console.error('Error updating resident:', error);
        alert('Error updating resident: ' + (error.message || 'Unknown error'));
      }
    });

    // Reset password
    document.getElementById('res-reset')?.addEventListener('click', async function() {
      const modal = document.getElementById('res-reset-modal');
      const residentId = modal?.dataset.residentId;
      const newPassword = document.getElementById('reset-pass').value;

      if (!newPassword || newPassword.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
      }

      if (!residentId) {
        alert('Resident ID not found');
        return;
      }

      try {
        const resident = approvedResidents.find(r => r.id === residentId);
        if (!resident || !resident.uid) {
          alert('Resident UID not found');
          return;
        }

        // Note: In production, you would need to use Firebase Admin SDK or a Cloud Function
        // to reset passwords, as client SDK doesn't allow password changes for other users
        alert('Password reset functionality requires backend implementation. Please use Firebase Admin SDK or Cloud Functions.');
        
        modal.hidden = true;
        document.getElementById('reset-pass').value = '';
      } catch (error) {
        console.error('Error resetting password:', error);
        alert('Error resetting password: ' + (error.message || 'Unknown error'));
      }
    });
  })();

  // ========================================
  // REPORTS PAGE - REALTIME DATABASE FEED
  // ========================================
  (function initializeRealtimeReportsPage() {
    const reportsTable = document.getElementById('reports-rows');
    if (!reportsTable) return;

    const stats = {
      total: document.getElementById('r-total'),
      resolved: document.getElementById('r-resolved'),
      active: document.getElementById('r-active'),
      average: document.getElementById('r-avg'),
    };

    const detailsModal = document.getElementById('modal-details');
    const detailsContent = document.getElementById('details-content');
    const manageModal = document.getElementById('modal-manage-report');
    const manageForm = document.getElementById('manage-report-form');
    const manageReportIdInput = document.getElementById('manage-report-id');
    const manageStatusSelect = document.getElementById('manage-status');
    const manageVehicleInput = document.getElementById('manage-vehicle');
    const manageNotesInput = document.getElementById('manage-notes');
    const manageVehicleSelect = document.getElementById('manage-vehicle');
    let ambulancesMap = {};

    const REALTIME_DB_URL = 'https://isagip-752d1-default-rtdb.asia-southeast1.firebasedatabase.app';
    let realtimeDb = null;
    let databaseModule = null;
    let reports = [];
    let rawReports = {};

    init();

    async function init() {
      try {
        await ensureFirebaseReady();
        databaseModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
        realtimeDb = databaseModule.getDatabase(window.iSagipApp, REALTIME_DB_URL);

        const { ref, onValue } = databaseModule;
        const reportsRef = ref(realtimeDb, 'reports');
        const ambulancesRef = ref(realtimeDb, 'ambulances');

        onValue(
          ambulancesRef,
          (snapshot) => {
            ambulancesMap = snapshot.val() || {};
            updateVehicleOptions();
          },
          (error) => {
            console.error('Failed to load ambulances:', error);
          }
        );
        onValue(
          reportsRef,
          (snapshot) => {
            const value = snapshot.val() || {};
            rawReports = value;
            reports = Object.entries(value)
              .map(([id, data]) => mapReport(id, data))
              .sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

            renderReports();
            updateStats();
          },
          (error) => {
            console.error('Realtime reports error:', error);
            reportsTable.innerHTML = `
              <div class="t-row">
                <div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:#ef4444;">
                  Unable to load reports. Please refresh the page.
                </div>
              </div>`;
          }
        );
      } catch (error) {
        console.error('Failed to initialize reports page:', error);
      }
    }

    function renderReports() {
      if (!reports.length) {
        reportsTable.innerHTML = `
          <div class="t-row">
            <div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:var(--muted);">
              No reports yet.
            </div>
          </div>`;
        return;
      }

      const currentUserRole = localStorage.getItem('iSagip_userRole') || '';
      const canManage = ['admin', 'system_admin', 'barangay_staff', 'responder'].includes(currentUserRole);
      const canDelete = ['admin', 'system_admin', 'barangay_staff'].includes(currentUserRole);

      reportsTable.innerHTML = reports
        .map((report) => {
          const photoCell = report.photo
            ? `<a href="${report.photo}" target="_blank" rel="noopener" class="btn btn-small btn-outline">View</a>`
            : 'N/A';
          const actionButtons = `
            <div class="reports-actions">
              <button class="btn btn-small btn-outline" data-action="view-report" data-id="${report.id}">
                View
              </button>
              ${
                canManage
                  ? `<button class="btn btn-small btn-primary" data-action="manage-report" data-id="${report.id}">
                      Manage
                    </button>`
                  : ''
              }
              ${
                canDelete
                  ? `<button class="btn btn-small btn-danger" data-action="delete-report" data-id="${report.id}">
                      Delete
                    </button>`
                  : ''
              }
            </div>
          `;

          return `
            <div class="t-row" data-report-id="${report.id}">
              <div>${report.id}</div>
              <div>${escapeHtml(report.type)}</div>
              <div>${escapeHtml(report.description)}</div>
              <div>${formatStatusBadge(report.status)}</div>
              <div>${escapeHtml(report.street)}</div>
              <div>${escapeHtml(report.landmark)}</div>
              <div>${report.latitude != null ? report.latitude.toFixed(6) : '—'}</div>
              <div>${report.longitude != null ? report.longitude.toFixed(6) : '—'}</div>
              <div>${photoCell}</div>
              <div>${actionButtons}</div>
              <div>${report.timestamp}</div>
              <div>${report.responseTime || '—'}</div>
              <div>${escapeHtml(report.reportedBy)}</div>
              <div>${escapeHtml(report.closedBy || '—')}</div>
              <div>${escapeHtml(report.lastUpdatedBy || '—')}</div>
              <div>${report.lastUpdatedAt || '—'}</div>
              <div>${escapeHtml(report.notes || '—')}</div>
            </div>
          `;
        })
        .join('');
    }

    function updateStats() {
      const total = reports.length;
      const resolved = reports.filter((r) => r.status.toLowerCase() === 'resolved').length;
      const active = total - resolved;

      const responseValues = reports
        .map((r) => r.responseMinutes)
        .filter((value) => typeof value === 'number');

      const average =
        responseValues.length > 0
          ? Math.round(responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length)
          : 0;

      if (stats.total) stats.total.textContent = total;
      if (stats.resolved) stats.resolved.textContent = resolved;
      if (stats.active) stats.active.textContent = active;
      if (stats.average) stats.average.textContent = responseValues.length ? `${average} min` : '0 min';
    }

    reportsTable.addEventListener('click', function (event) {
      const viewButton = event.target.closest('[data-action="view-report"]');
      const manageButton = event.target.closest('[data-action="manage-report"]');
      const deleteButton = event.target.closest('[data-action="delete-report"]');

      if (viewButton) {
        const reportId = viewButton.getAttribute('data-id');
        const report = reports.find((item) => item.id === reportId);
        if (report) {
          showReportDetails(report);
        }
        return;
      }

      if (manageButton) {
        const reportId = manageButton.getAttribute('data-id');
        const raw = rawReports[reportId];
        if (raw) {
          openManageModal(reportId, raw);
        }
        return;
      }

      if (deleteButton) {
        const reportId = deleteButton.getAttribute('data-id');
        if (!reportId) return;
        const confirmMsg = 'Delete this report permanently? This cannot be undone.';
        if (!confirm(confirmMsg)) return;
        if (!databaseModule || !realtimeDb) {
          alert('Database not ready. Please refresh and try again.');
          return;
        }
        (async function(){
          try {
            const { ref, remove } = databaseModule;
            await remove(ref(realtimeDb, `reports/${reportId}`));
            alert('Report deleted.');
          } catch (err) {
            console.error('Failed to delete report:', err);
            alert('Failed to delete report. Please try again.');
          }
        })();
      }
    });

    function showReportDetails(report) {
      if (!detailsModal || !detailsContent) return;

      detailsContent.innerHTML = `
        <div class="details-grid">
          <div><strong>Report ID:</strong> ${report.id}</div>
          <div><strong>Status:</strong> ${formatStatusLabel(report.status)}</div>
          <div><strong>Type:</strong> ${escapeHtml(report.type)}</div>
          <div><strong>Street:</strong> ${escapeHtml(report.street)}</div>
          <div><strong>Landmark:</strong> ${escapeHtml(report.landmark)}</div>
          <div><strong>Latitude:</strong> ${report.latitude != null ? report.latitude.toFixed(6) : '—'}</div>
          <div><strong>Longitude:</strong> ${report.longitude != null ? report.longitude.toFixed(6) : '—'}</div>
          <div><strong>Reported By:</strong> ${escapeHtml(report.reportedBy)}</div>
          <div><strong>Timestamp:</strong> ${report.timestamp}</div>
          <div><strong>Response Time:</strong> ${report.responseTime || '—'}</div>
          <div style="grid-column:1/-1;"><strong>Description:</strong><br>${escapeHtml(report.description)}</div>
          <div style="grid-column:1/-1;"><strong>Notes:</strong><br>${escapeHtml(report.notes || '—')}</div>
          ${
            report.photo
              ? `<div style="grid-column:1/-1;margin-top:12px;">
                  <img src="${report.photo}" alt="Report photo" style="max-width:100%;border-radius:8px;" />
                </div>`
              : ''
          }
        </div>
      `;

      detailsModal.hidden = false;
    }

    function openManageModal(reportId, raw) {
      if (!manageModal || !manageForm) return;
      manageReportIdInput.value = reportId;
      manageStatusSelect.value = (raw.status || 'pending').toLowerCase();
      updateVehicleOptions(raw.assignedVehicle || '');
      manageNotesInput.value = '';
      manageModal.hidden = false;
    }

    function updateVehicleOptions(selectedValue) {
      if (!manageVehicleSelect) return;
      const hasExplicitSelection = arguments.length > 0;
      const currentValue = hasExplicitSelection ? (selectedValue || '') : (manageVehicleSelect.value || '');
      manageVehicleSelect.innerHTML = '<option value="">Select an ambulance</option>';
      Object.keys(ambulancesMap).forEach(function(key) {
        const ambulance = ambulancesMap[key] || {};
        const option = document.createElement('option');
        option.value = key;
        const statusLabel = ambulance.status ? ` - ${formatStatusLabel(ambulance.status)}` : '';
        option.textContent = ambulance.name ? `${ambulance.name} (${key})${statusLabel}` : `${key}${statusLabel}`;
        if (currentValue && currentValue === key) {
          option.selected = true;
        }
        manageVehicleSelect.appendChild(option);
      });
    }

    function sanitizeAmbulanceKey(value) {
      if (value === null || value === undefined) return '';
      return value.toString().trim();
    }

    function buildAmbulanceAssignmentPayload(reportId, raw, status) {
      raw = raw || {};
      return {
        id: reportId,
        type: raw.emergencyType || raw.type || 'General',
        description: raw.description || raw.desc || 'No description provided',
        address: raw.street || raw.location || 'N/A',
        landmark: raw.landmark || '',
        reporter: raw.userName || raw.reportedByName || raw.by || '',
        responder: raw.assignedResponderName || raw.assignedResponder || raw.responder || '',
        responders: collectResponders(raw),
        status: formatStatusLabel(status),
        timestamp: new Date().toISOString()
      };
    }

    async function updateAmbulanceRecordForReport(ambulanceId, updates) {
      const key = sanitizeAmbulanceKey(ambulanceId);
      if (!key || !databaseModule || !realtimeDb) return;
      const { ref, update } = databaseModule;
      await update(ref(realtimeDb, `ambulances/${key}`), updates);
    }

    async function assignAmbulanceToReport(ambulanceId, payload) {
      if (!ambulanceId || !payload) return;
      const actor = localStorage.getItem('iSagip_userUID') || 'staff';
      await updateAmbulanceRecordForReport(ambulanceId, {
        status: 'IN-USE',
        assignment: payload,
        assignmentId: payload.id || null,
        secondaryResponder: payload.responder || null,
        lastUpdated: Date.now(),
        lastUpdatedBy: actor
      });
    }

    async function releaseAmbulanceFromReport(ambulanceId) {
      if (!ambulanceId) return;
      const actor = localStorage.getItem('iSagip_userUID') || 'staff';
      await updateAmbulanceRecordForReport(ambulanceId, {
        status: 'AVAILABLE',
        assignment: null,
        assignmentId: null,
        secondaryResponder: null,
        lastUpdated: Date.now(),
        lastUpdatedBy: actor
      });
    }

    async function syncAmbulancesForReport(options) {
      if (!options) return;
      const previousVehicle = sanitizeAmbulanceKey(options.previousVehicle);
      const nextVehicle = sanitizeAmbulanceKey(options.nextVehicle);
      const resolved = (options.status || '').toLowerCase() === 'resolved';
      const tasks = [];

      if (previousVehicle && (resolved || !nextVehicle || previousVehicle !== nextVehicle)) {
        tasks.push(releaseAmbulanceFromReport(previousVehicle));
      }

      if (!resolved && nextVehicle) {
        const assignmentPayload = buildAmbulanceAssignmentPayload(
          options.reportId,
          options.reportData,
          options.status
        );
        tasks.push(assignAmbulanceToReport(nextVehicle, assignmentPayload));
      } else if (resolved && nextVehicle && !previousVehicle) {
        tasks.push(releaseAmbulanceFromReport(nextVehicle));
      }

      if (tasks.length) {
        try {
          await Promise.all(tasks);
        } catch (error) {
          console.error('Failed to synchronize ambulance assignment:', error);
        }
      }
    }

    manageModal?.addEventListener('click', function(event){
      if (event.target.matches('[data-close]')) {
        manageModal.hidden = true;
      }
    });

    manageForm?.addEventListener('submit', async function(event){
      event.preventDefault();
      if (!databaseModule || !realtimeDb) return;

      const reportId = manageReportIdInput.value;
      const raw = rawReports[reportId];
      if (!reportId || !raw) return;

      const { ref, update, push, set } = databaseModule;
      const now = Date.now();
      const actor = localStorage.getItem('iSagip_userUID') || 'staff';
      const newStatus = manageStatusSelect.value;
      const assignedVehicle = manageVehicleInput.value.trim();
      const note = manageNotesInput.value.trim();

      const actorName = await resolveUserDisplayName(actor);

      const updates = {
        status: newStatus,
        assignedVehicle: assignedVehicle || null,
        lastUpdatedAt: now,
        lastUpdatedBy: actorName,
        lastUpdatedByUid: actor
      };

      const wasResolved = (raw.status || '').toLowerCase() === 'resolved';
      const nowResolved = newStatus === 'resolved';

      if (nowResolved && !wasResolved) {
        updates.closedBy = actorName;
        updates.closedByUid = actor;
        updates.closedAt = now;
      } else if (!nowResolved && wasResolved) {
        updates.closedBy = null;
        updates.closedByUid = null;
        updates.closedAt = null;
      }

      if (note) {
        updates.notes = note;
      }

      try {
        await update(ref(realtimeDb, `reports/${reportId}`), updates);

        const historyRef = push(ref(realtimeDb, `reports/${reportId}/history`));
        const changeDetails = [];
        if ((raw.status || 'pending').toLowerCase() !== newStatus) {
          changeDetails.push(`Status: ${formatStatusLabel(raw.status)} → ${formatStatusLabel(newStatus)}`);
        }
        if ((raw.assignedVehicle || '') !== assignedVehicle) {
          changeDetails.push(`Vehicle: "${raw.assignedVehicle || 'None'}" → "${assignedVehicle || 'None'}"`);
        }
        if (note) {
          changeDetails.push(`Note: ${note}`);
        }

        await set(historyRef, {
          timestamp: now,
          actorUid: actor,
          actorName,
          action: 'update',
          details: changeDetails.join(' | ') || 'Report updated'
        });

        await syncAmbulancesForReport({
          previousVehicle: raw.assignedVehicle,
          nextVehicle: assignedVehicle,
          status: newStatus,
          reportId,
          reportData: { ...raw, ...updates }
        });

        manageModal.hidden = true;
        manageNotesInput.value = '';
      } catch (error) {
        console.error('Error updating report:', error);
        alert('Failed to update report. Please try again.');
      }
    });

    function mapReport(id, raw) {
      const timestamp = Number(raw.timestamp) || Date.now();
      const closedAt = Number(raw.closedAt) || null;

      const responseMinutes =
        typeof raw.responseTimeMinutes === 'number'
          ? raw.responseTimeMinutes
          : closedAt
          ? Math.round((closedAt - timestamp) / 60000)
          : null;

      return {
        id,
        type: raw.emergencyType || raw.type || 'General',
        description: raw.description || raw.desc || 'No description provided',
        status: raw.status || 'Pending',
        street: raw.street || 'N/A',
        landmark: raw.landmark || 'N/A',
        latitude: (function(){ const v = parseFloat(raw.latitude ?? raw.lat); return isFinite(v) ? v : null; })(),
        longitude: (function(){ const v = parseFloat(raw.longitude ?? raw.lng); return isFinite(v) ? v : null; })(),
        photo: raw.photoUrl || raw.photo || '',
        reportedBy: raw.userName || raw.reportedByName || raw.by || 'Unknown',
        notes: raw.residentNotes || raw.notes || '',
        closedBy: raw.closedBy || raw.closedByName || '',
        lastUpdatedBy: raw.lastUpdatedBy || raw.lastUpdatedByName || '',
        timestamp: new Date(timestamp).toLocaleString(),
        lastUpdatedAt: raw.lastUpdatedAt ? new Date(Number(raw.lastUpdatedAt)).toLocaleString() : '—',
        responseTime: typeof responseMinutes === 'number' ? `${responseMinutes} min` : '—',
        responseMinutes,
        rawTimestamp: timestamp,
      };
    }

    function formatStatusBadge(status) {
      const normalized = (status || '').toLowerCase();
      let color = '#3b82f6';
      if (normalized === 'resolved') color = '#10b981';
      else if (normalized === 'dispatched' || normalized === 'on site' || normalized === 'on-site') color = '#f97316';
      else if (normalized === 'emergency') color = '#ef4444';
      return `<span class="status-badge" style="background: ${color}1a; color: ${color}; font-weight:600;">${formatStatusLabel(
        status
      )}</span>`;
    }

  async function resolveUserDisplayName(uid){
    if (!uid) return 'Unknown';
    try{
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
      const db = window.iSagipDb;
      if (!db) return uid;
      const adminDoc = await getDoc(doc(db, 'admin', uid));
      if (adminDoc.exists()) {
        return adminDoc.data().lastName || adminDoc.data().firstName || uid;
      }
      const staffDoc = await getDoc(doc(db, 'staff', uid));
      if (staffDoc.exists()) {
        return staffDoc.data().lastName || staffDoc.data().firstName || uid;
      }
      const residentDoc = await getDoc(doc(db, 'residents', uid));
      if (residentDoc.exists()) {
        return residentDoc.data().lastName || residentDoc.data().firstName || uid;
      }
    } catch (error){
      console.error('Failed to resolve user name for UID', uid, error);
    }
    return uid;
  }

  function formatStatusLabel(status) {
      if (!status) return 'Pending';
      return status.toString().replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function escapeHtml(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function ensureFirebaseReady() {
      if (window.iSagipApp && window.iSagipDb) return Promise.resolve();
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50;
        const interval = setInterval(() => {
          if (window.iSagipApp && window.iSagipDb) {
            clearInterval(interval);
            resolve();
          } else if (attempts > maxAttempts) {
            clearInterval(interval);
            resolve();
          }
          attempts += 1;
        }, 200);
        window.addEventListener(
          'firebaseReady',
          () => {
            clearInterval(interval);
            resolve();
          },
          { once: true }
        );
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

  })();

