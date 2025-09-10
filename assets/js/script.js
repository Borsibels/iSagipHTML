/*
====================================================
 iSagip Frontend (Vanilla JS)

 Architecture Overview (for backend integration)
 - Navigation & RBAC: login, role storage, sidebar filtering, active states
 - Page Transitions: fade-in/out helpers for consistent UX
 - Settings: dark mode, password modal, role display
 - Reports: CSV export helpers and live updates hooks
 - Notifications: visual + sound notifications for new reports
 - Feature Pages: Dashboard, Reports, Ambulance, Residents, Registration
 - Firebase Integration Layer (optional): thin wrapper that safely no-ops
   when Firebase is not loaded; your team can enable it by including the
   Firebase SDK and providing window.iSagipFirebaseConfig.

 How to enable Firebase quickly
 1) Include Firebase SDK scripts (either compat v9 or v8) BEFORE this file
    and set a global config as below:
    <script>window.iSagipFirebaseConfig={ apiKey:'...', projectId:'...', ... };</script>
 2) Optionally set localStorage key 'iSagip_useFirebase'='true' to force
    initialization. If SDK+config exist, initialization is automatic.
 3) The Firebase layer exposes: Firebase.isAvailable(), Firebase.init(),
    Firebase.getDb(), ReportsAPI.onNewReports(cb), ReportsAPI.add(report).

 Notes
 - This file is intentionally verbose and documented to help the backend
   team understand where to plug in APIs and database operations.
 - All functions are small, named, and grouped by section headers.
====================================================
*/

// ========================================
// LOGIN PAGE FUNCTIONALITY
// ========================================

/**
 * Main login page functionality
 * Handles tab switching, form submission, and navigation
 */
(function initializeLoginPage() {
  // ========================================
  // TAB SWITCHING FUNCTIONALITY
  // ========================================
  
  /**
   * Initialize tab switching between System Admin and Barangay Staff
   * Updates page content based on selected tab
   */
  var tabs = document.querySelectorAll('.tab');
  if (tabs.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        // Tab content fade swap
        const card = document.querySelector('.login-card');
        if (card) { card.classList.add('fade-swap','is-swapping'); }
        // Remove active state from all tabs
        tabs.forEach(function (tabElement) { 
          tabElement.classList.remove('active'); 
          tabElement.setAttribute('aria-selected', 'false'); 
        });
        
        // Set clicked tab as active
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        // Update page content based on selected tab with small delay to sync with fade
        setTimeout(function(){
          updateLoginPageContent(tab.dataset.tab === 'reports');
          if (card) { card.classList.remove('is-swapping'); }
        }, 120);
      });
    });
  }

  /**
   * Update login page content based on selected tab
   * @param {boolean} isReportsTab - Whether the reports tab is selected
   */
  function updateLoginPageContent(isReportsTab) {
    const title = document.getElementById('login-title');
    const subtitle = document.getElementById('login-subtitle');
    const button = document.getElementById('login-button');
    
    if (title && subtitle && button) {
      if (isReportsTab) {
        // Barangay Staff mode
        title.textContent = 'iSagip Barangay Staff';
        subtitle.textContent = 'Sign in to barangay staff dashboard';
        button.textContent = 'Login to Staff Dashboard';
      } else {
        // System Admin mode
        title.textContent = 'iSagip System Admin';
        subtitle.textContent = 'Sign in to system admin dashboard';
        button.textContent = 'Login to Admin Dashboard';
      }
    }
  }

  // ========================================
  // LOGIN FORM SUBMISSION
  // ========================================
  
  /**
   * Handle login form submission
   * Determines user role and redirects to appropriate page
   */
  var form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      
      // Determine user role based on active tab
      const activeTab = document.querySelector('.tab.active');
      const isReportsTab = activeTab && activeTab.dataset.tab === 'reports';
      const userRole = isReportsTab ? 'barangay_staff' : 'system_admin';
      
      // Store user role in localStorage for role-based access control
      localStorage.setItem('iSagip_userRole', userRole);
      
      // Navigate with fade-out
      const destination = getDestinationForRole(userRole);
      navigateWithFade(destination);
    });
  }

  /**
   * Get destination page based on user role
   * @param {string} role - User role (system_admin, barangay_staff, live_viewer)
   * @returns {string} - Destination page URL
   */
  function getDestinationForRole(role) {
    const roleDestinations = {
      'system_admin': 'register-staff.html',    // System admin → Registration pages
      'barangay_staff': 'dashboard.html',       // Barangay staff → Dashboard
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
   */
  var logout = document.getElementById('logout');
  if (logout) {
    logout.addEventListener('click', function () {
      // Clear user role from localStorage
      localStorage.removeItem('iSagip_userRole');
      
      // Redirect to login page with fade
      navigateWithFade('index.html');
    });
  }

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
      'system_admin': {
        allowed: ['Registration', 'Resident Management', 'Settings'],
        denied: ['Dashboard', 'Reports', 'Ambulance']
      },
      'barangay_staff': {
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

  // Populate reported time example
  var reported = document.getElementById('reported-at');
  if (reported) {
    var now = new Date();
    var opts = { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };
    reported.textContent = now.toLocaleString(undefined, opts);
  }
  
  // Google Maps init replicating EmergencyMap.tsx logic
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

      // Sample emergencies; replace with dynamic data later
      var emergencies = [
        { id: 'E1', location: { lat: 14.753, lng: 121.013 }, type: 'Medical', description: 'Chest pain', timestamp: new Date().toLocaleString() },
        { id: 'E2', location: { lat: 14.748, lng: 121.02 }, type: 'Fire', description: 'Kitchen fire', timestamp: new Date().toLocaleString() },
        { id: 'E3', location: { lat: 14.745, lng: 121.01 }, type: 'Police', description: 'Disturbance', timestamp: new Date().toLocaleString() }
      ];

      emergencies.forEach(function (em) {
        var marker = new google.maps.Marker({
          position: em.location,
          map: map,
          title: em.type + ': ' + em.description
        });

        marker.addListener('click', function () {
          if (selectedMarker === marker) {
            infoWindow.close();
            selectedMarker = null;
            return;
          }
          selectedMarker = marker;
          infoWindow.setContent('<div><strong>' + em.type + ' Emergency</strong><br/>' +
            '<span>' + em.description + '</span><br/>' +
            '<span style="font-size:12px;color:#666">Time: ' + em.timestamp + '</span></div>');
          infoWindow.open(map, marker);
        });
      });

      map.addListener('click', function () { infoWindow.close(); selectedMarker = null; });
    };
  }

  // Populate filter years
  var yearSel = document.getElementById('filter-year');
  if (yearSel) {
    var currentYear = new Date().getFullYear();
    for (var y = currentYear; y >= currentYear - 5; y--) {
      var opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      yearSel.appendChild(opt);
    }
  }

  // Demo dataset for CSV export
  var allReports = [
    { id: 'REP-2024-002', type: 'Fire', description: 'Kitchen fire, smoke visible', status: 'Relayed', street: 'Block 3, Lot 5', landmark: 'Beside Barangay Hall', location: 'Block 3, Lot 5', reportedBy: 'Alice', timestamp: '2024-03-20 10:15 AM' },
    { id: 'REP-2024-003', type: 'Police', description: 'Suspicious activity reported', status: 'Pending', street: 'Block 2, Lot 1', landmark: 'Near parking Lot', location: 'Block 2, Lot 1', reportedBy: 'Bob', timestamp: '2024-03-20 09:45 AM' },
    { id: 'REP-2024-004', type: 'Medical', description: 'Child with high fever', status: 'Pending', street: 'Block 4, Lot 7', landmark: 'Green Gate 2 floors house', location: 'Block 4, Lot 7', reportedBy: 'Carol', timestamp: '2024-03-21 08:10 AM' },
    { id: 'REP-2025-001', type: 'Medical', description: 'Chest pain', status: 'Ongoing', street: 'Block 1, Lot 2', landmark: 'Near alley', location: 'Block 1, Lot 2', reportedBy: 'Dan', timestamp: '2025-01-05 08:30 PM' }
  ];

  function parseTs(ts){
    var d = new Date(ts);
    if (isNaN(d.getTime())) {
      // Fallback for M/D/YYYY HH:MM AM format
      return new Date(Date.parse(ts));
    }
    return d;
  }

  function filterReports(period, monthIdx, year){
    return allReports.filter(function(r){
      var d = parseTs(r.timestamp);
      if (period === 'year') return d.getFullYear() === year;
      if (period === 'month') return d.getFullYear() === year && d.getMonth() === monthIdx;
      // week: filter by ISO week of year for the selected year and current week of chosen month (approx: within the month)
      if (period === 'week') return d.getFullYear() === year && d.getMonth() === monthIdx && Math.abs(d.getDate() - 15) <= 7;
      return true;
    });
  }

  function toCsv(rows){
    var headers = ['Report ID','Type','Description','Status','Street','Landmark','Location','Reported By','Timestamp'];
    var body = rows.map(function(r){
      return [r.id,r.type,r.description,r.status,r.street,r.landmark,r.location,r.reportedBy,r.timestamp].map(function(val){
        var s = String(val==null?'':val);
        if (s.search(/[",\n]/)>=0) s = '"' + s.replace(/"/g,'""') + '"';
        return s;
      }).join(',');
    });
    return [headers.join(','), body.join('\n')].join('\n');
  }

  function download(filename, text){
    var blob = new Blob([text], {type: 'text/csv;charset=utf-8;'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  var exportBtn = document.getElementById('export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', function(){
      var periodSel = document.getElementById('filter-period');
      var monthSel = document.getElementById('filter-month');
      var yearSel2 = document.getElementById('filter-year');
      var period = periodSel ? periodSel.value : 'month';
      var monthIdx = monthSel ? parseInt(monthSel.value, 10) : (new Date()).getMonth();
      var year = yearSel2 ? parseInt(yearSel2.value, 10) : (new Date()).getFullYear();

      var rows = filterReports(period, monthIdx, year);
      var csv = toCsv(rows);
      var label = period === 'year' ? year : (period === 'month' ? (year + '-' + String(monthIdx+1).padStart(2,'0')) : (year + '-Wk'));
      download('iSagip-reports-' + label + '.csv', csv);
    });
  }

  // Received Reports page logic
  (function setupReceivedReports(){
    var table = document.getElementById('reports-rows');
    if (!table) return;

    var reports = [
      { id:'SIM-2024-001', type:'Medical', description:'Simulated emergency from mobile app', status:'Pending', street:'-', landmark:'-', photo:null, timestamp:'2025-09-10 09:15:28 PM', responseTime:'N/A', reportedBy:'Simulated User', closedBy:'', updatedBy:'System', updatedAt:'2025-09-10 09:15:28 PM', notes:'Auto-generated from mobile app simulation.', location:{ lat:14.7338466, lng:121.01382136 }, history:[{ ts:'2025-09-10 09:15:28 PM', user:'Simulated User', action:'Created', details:'Simulated emergency report received.' }] },
      { id:'REP-2024-002', type:'Fire', description:'Kitchen fire, smoke visible', status:'Relayed', street:'Block 3, Lot 5', landmark:'Beside Barangay Hall', photo:'', timestamp:'2024-03-20 10:15 AM', responseTime:'20 minutes', reportedBy:'Alice', closedBy:'Captain', updatedBy:'Captain', updatedAt:'2024-03-20 10:16 AM', notes:'', location:{ lat:14.748, lng:121.02 }, history:[{ ts:'2024-03-20 10:12 AM', user:'Alice', action:'Submitted', details:'Fire observed.' }] },
      { id:'REP-2024-003', type:'Police', description:'Suspicious activity reported', status:'Pending', street:'Block 2, Lot 1', landmark:'Near parking Lot', photo:'', timestamp:'2024-03-20 09:45 AM', responseTime:'N/A', reportedBy:'Bob', closedBy:'Barangay Secretary', updatedBy:'Barangay Secretary', updatedAt:'2024-03-20 09:50 AM', notes:'', location:{ lat:14.745, lng:121.01 }, history:[{ ts:'2024-03-20 09:45 AM', user:'Bob', action:'Submitted', details:'Suspicious activity.' }] },
      { id:'REP-2024-004', type:'Medical', description:'Child with high fever', status:'Pending', street:'Block 4, Lot 7', landmark:'Green Gate 2 floors house', photo:'', timestamp:'2024-03-21 08:10 AM', responseTime:'N/A', reportedBy:'Carol', closedBy:'Responder', updatedBy:'Responder', updatedAt:'2024-03-21 08:20 AM', notes:'', location:{ lat:14.753, lng:121.013 }, history:[{ ts:'2024-03-21 08:10 AM', user:'Carol', action:'Submitted', details:'High fever child.' }] }
    ];

    // Stats
    var resolved = reports.filter(function(r){return r.status.toLowerCase()==='responded' || r.status.toLowerCase()==='resolved';}).length;
    var active = reports.filter(function(r){return r.status.toLowerCase()==='ongoing' || r.status.toLowerCase()==='pending' || r.status.toLowerCase()==='relayed';}).length;
    var avg = 18; // demo
    var total = reports.length;
    var totalEl = document.getElementById('r-total'); if (totalEl) totalEl.textContent = String(total);
    var resEl = document.getElementById('r-resolved'); if (resEl) resEl.textContent = String(resolved);
    var actEl = document.getElementById('r-active'); if (actEl) actEl.textContent = String(active);
    var avgEl = document.getElementById('r-avg'); if (avgEl) avgEl.textContent = avg + ' minutes';

    function statusBadge(s){
      var map = { Pending:'badge-orange', Relayed:'badge-orange', Ongoing:'badge-blue', Responded:'badge-green', Resolved:'badge-green' };
      return '<span class="badge '+(map[s]||'badge-blue')+'">'+s+'</span>';
    }

    function actionCell(id, status){
      return (
        '<div class="actions">'+
            '<select class="input ambulance-select" data-id="'+id+'">'+
              '<option value="">Choose Ambulance</option><option>Ambulance 1</option><option>Ambulance 2</option><option>Ambulance 3</option>'+
            '</select>'+
          '<button class="btn btn-outline respond-btn" data-id="'+id+'">'+(status==='Ongoing'?'RESPONDED':'ONGOING')+'</button>'+
          '<button class="btn btn-outline view-btn" data-id="'+id+'">VIEW</button>'+
          '<a class="muted history-link history" href="#" data-id="'+id+'">VIEW HISTORY</a>'+
        '</div>'
      );
    }

    function render(){
      table.innerHTML = reports.map(function(r){
        return (
          '<div class="t-row" data-id="'+r.id+'">'+
            '<div>'+r.id+'</div>'+
            '<div>'+r.description+'</div>'+
            '<div>'+statusBadge(r.status)+'</div>'+
            '<div>'+r.street+'</div>'+
            '<div>'+r.landmark+'</div>'+
            '<div>'+(r.photo?'<img src="'+r.photo+'" alt="photo" style="width:80px;height:56px;object-fit:cover;border-radius:6px;">':'<div class="photo"></div>')+'</div>'+
            '<div>'+actionCell(r.id, r.status)+'</div>'+
            '<div>'+r.timestamp+'</div>'+
            '<div>'+r.responseTime+'</div>'+
            '<div>'+r.reportedBy+'</div>'+
            '<div>'+r.closedBy+'</div>'+
            '<div>'+r.updatedBy+'</div>'+
            '<div>'+r.updatedAt+'</div>'+
            '<div>'+r.notes+'</div>'+
          '</div>'
        );
      }).join('');
    }

    render();

    // Toggle Responded/Ongoing
    table.addEventListener('click', function(e){
      var btn = e.target.closest('.respond-btn');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var r = reports.find(function(x){return x.id===id;});
      if (!r) return;
      r.status = (r.status==='Ongoing') ? 'Responded' : 'Ongoing';
      r.updatedBy = 'Current User';
      r.updatedAt = new Date().toLocaleString();
      render();
    });

    // Ambulance selection → persist to localStorage and mark ambulance IN-USE
    table.addEventListener('change', function(e){
      var sel = e.target.closest('.ambulance-select');
      if (!sel) return;
      if (!sel.value) return; // Skip if "Choose Ambulance" is selected
      var id = sel.getAttribute('data-id');
      var r = reports.find(function(x){return x.id===id;});
      if (!r) return;
      var ambName = sel.value || sel.options[sel.selectedIndex].text;
      try {
        var store = JSON.parse(localStorage.getItem('iSagip_ambulances')) || [
          { id: 1, name: 'Ambulance 1', status: 'AVAILABLE', location: '' },
          { id: 2, name: 'Ambulance 2', status: 'AVAILABLE', location: '' },
          { id: 3, name: 'Ambulance 3', status: 'AVAILABLE', location: '' }
        ];
        var idx = store.findIndex(function(a){ return (a.name||('Ambulance '+a.id)) === ambName; });
        if (idx !== -1) {
          store[idx].status = 'IN-USE';
          store[idx].location = r.street;
          store[idx].assignmentId = r.id;
          localStorage.setItem('iSagip_ambulances', JSON.stringify(store));
        }
      } catch(err) {}
    });

    // View details
    var detailsModal = document.getElementById('modal-details');
    var detailsContent = document.getElementById('details-content');
    table.addEventListener('click', function(e){
      var btn = e.target.closest('.view-btn');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var r = reports.find(function(x){return x.id===id;});
      if (!r) return;
      var html = ''+
        '<div style="display:grid; grid-template-columns:160px 1fr; gap:16px; align-items:start;">'+
          '<div class="photo" style="width:160px;height:120px;">'+(r.photo?'<img src="'+r.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"/>':'<div style="display:grid;place-items:center;height:100%;color:#94a3b8;">No Photo</div>')+'</div>'+
          '<div>'+
            '<div><strong>Report ID:</strong> '+r.id+'</div>'+
            '<div><strong>Type:</strong> '+r.type+'</div>'+
            '<div><strong>Description:</strong> '+r.description+'</div>'+
            '<div><strong>Status:</strong> '+r.status+'</div>'+
            '<div><strong>Street:</strong> '+r.street+'</div>'+
            '<div><strong>Landmark:</strong> '+r.landmark+'</div>'+
            '<div><strong>Location:</strong> Lat '+(r.location?r.location.lat:'-')+', Lng '+(r.location?r.location.lng:'-')+'</div>'+
            '<div><strong>Timestamp:</strong> '+r.timestamp+'</div>'+
            '<div><strong>Response Time:</strong> '+r.responseTime+'</div>'+
            '<div><strong>Reported By:</strong> '+r.reportedBy+'</div>'+
            '<div><strong>Closed By:</strong> '+r.closedBy+'</div>'+
            '<div><strong>Last Updated By:</strong> '+r.updatedBy+'</div>'+
            '<div><strong>Last Updated At:</strong> '+r.updatedAt+'</div>'+
            '<div><strong>Notes:</strong> '+(r.notes||'')+'</div>'+
          '</div>'+
        '</div>';
      detailsContent.innerHTML = html;
      detailsModal.hidden = false;
    });

    // History modal
    var historyModal = document.getElementById('modal-history');
    var historyRows = document.getElementById('history-rows');
    table.addEventListener('click', function(e){
      var link = e.target.closest('.history-link');
      if (!link) return;
      var id = link.getAttribute('data-id');
      var r = reports.find(function(x){return x.id===id;});
      if (!r) return;
      historyRows.innerHTML = (r.history||[]).map(function(h){
        return '<div class="t-row"><div>'+h.ts+'</div><div>'+h.user+'</div><div>'+h.action+'</div><div>'+h.details+'</div></div>';
      }).join('');
      historyModal.hidden = false;
    });

    // Close modals
    document.addEventListener('click', function(e){
      if (e.target.matches('[data-close]')) {
        detailsModal && (detailsModal.hidden = true);
        historyModal && (historyModal.hidden = true);
      }
      if (e.target.classList.contains('modal')) {
        e.target.hidden = true;
      }
    });

    // Export CSV for this page
    var exportReportsBtn = document.getElementById('reports-export-csv');
    if (exportReportsBtn) {
      exportReportsBtn.addEventListener('click', function(){
        var headers = ['Description','Status','Street','Landmark','Photo','Actions','Timestamp','Response Time','Reported By','Closed By','Last Updated By','Last Updated At','Notes'];
        var body = reports.map(function(r){
          var row = [r.description,r.status,r.street,r.landmark,r.photo?'Yes':'No','Ambulance/Responded/View/View History',r.timestamp,r.responseTime,r.reportedBy,r.closedBy,r.updatedBy,r.updatedAt,r.notes];
          return row.map(function(v){ var s=String(v||''); if (s.search(/[",\n]/)>=0) s='"'+s.replace(/"/g,'""')+'"'; return s; }).join(',');
        }).join('\n');
        var csv = headers.join(',') + '\n' + body;
        var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href=url; a.download='received-reports.csv'; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(url); a.remove();},0);
      });
    }
  })();

  // Register page logic
  (function setupRegister(){
    var roleSel = document.getElementById('reg-role');
    var responderWrap = document.getElementById('reg-responder-type-wrap');
    // Simple tab switch based on our local tabs within this page
    var tabsContainer = document.querySelector('main .tabs');
    var respForm = document.getElementById('register-form');
    var residentForm = document.getElementById('resident-register-form');
    if (tabsContainer && respForm && residentForm) {
      // Ensure initial state: show responder/staff, hide resident
      respForm.hidden = false;
      residentForm.hidden = true;
      tabsContainer.addEventListener('click', function(e){
        var btn = e.target.closest('.tab'); if (!btn) return;
        tabsContainer.querySelectorAll('.tab').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var t = btn.getAttribute('data-tab');
        if (t === 'resident') { respForm.hidden = true; residentForm.hidden = false; }
        else { respForm.hidden = false; residentForm.hidden = true; }
      });
      // Also enable role toggle when switching back
      tabsContainer.querySelector('#tab-staff').addEventListener('click', function(){
        if (roleSel && responderWrap) {
          responderWrap.style.display = (roleSel.value === 'responder') ? '' : 'none';
        }
      });
    }
    if (roleSel && responderWrap) {
      var toggleResponder = function(){
        var isResponder = roleSel.value === 'responder';
        responderWrap.style.display = isResponder ? '' : 'none';
      };
      roleSel.addEventListener('change', toggleResponder);
      toggleResponder();
    }
  })();

  // Ambulance status page logic
  (function setupAmbulance(){
    var grid = document.getElementById('ambulance-grid');
    if (!grid) return;

    function loadAmb(){ try { return JSON.parse(localStorage.getItem('iSagip_ambulances')); } catch(e){ return null; } }
    function saveAmb(a){ try { localStorage.setItem('iSagip_ambulances', JSON.stringify(a)); } catch(e){} }

    var ambulances = loadAmb() || [
      { id: 1, name: 'Ambulance 1', status: 'AVAILABLE', location: '' },
      { id: 2, name: 'Ambulance 2', status: 'IN-USE', location: 'Block 1, Lot 2' },
      { id: 3, name: 'Ambulance 3', status: 'MAINTENANCE', location: '' }
    ];
    saveAmb(ambulances);

    function badge(status){
      var color = status === 'AVAILABLE' ? '#16a34a' : status === 'IN-USE' ? '#f59e0b' : '#ef4444';
      return '<span class="amb-badge" style="color:'+color+'">'+status+'</span>';
    }

    function render(){
      grid.innerHTML = ambulances.map(function(a){
        return (
          '<div class="ambulance-card" data-id="'+a.id+'">'+
            '<div class="amb-title">'+a.name+'</div>'+
            '<div class="amb-status">Status: '+badge(a.status)+'</div>'+
            (a.location?'<div class="amb-status">Location: '+a.location+(a.assignmentId? ' <span style="color:#64748b">(Report '+a.assignmentId+')</span>':'' )+'</div>':'')+
            '<div class="amb-actions">'+
              '<button class="amb-btn set-available">MARK AVAILABLE</button>'+
              '<button class="amb-btn set-inuse">MARK IN USE</button>'+
              '<button class="amb-btn set-maint">MARK MAINTENANCE</button>'+
            '</div>'+
          '</div>'
        );
      }).join('');
    }
    render();

    grid.addEventListener('click', function(e){
      var card = e.target.closest('.ambulance-card');
      if (!card) return;
      var id = parseInt(card.getAttribute('data-id'), 10);
      var amb = ambulances.find(function(x){return x.id===id;});
      if (!amb) return;
      if (e.target.classList.contains('set-available')) amb.status = 'AVAILABLE';
      else if (e.target.classList.contains('set-inuse')) amb.status = 'IN-USE';
      else if (e.target.classList.contains('set-maint')) amb.status = 'MAINTENANCE';
      if (amb.status !== 'IN-USE') { amb.location = ''; amb.assignmentId = undefined; }
      saveAmb(ambulances);
      render();
    });
  })();

  // Resident management page logic
  (function setupResidents(){
    var rows = document.getElementById('res-rows');
    if (!rows) return;

    var approvalsEl = document.getElementById('res-approvals');
    var search = document.getElementById('res-search');
    var statusSel = document.getElementById('res-status');

    // Storage helpers
    function load(key, fallback){
      try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch(e){ return fallback; }
    }
    function save(key, value){
      try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){}
    }

    var residents = load('iSagip_residents', null) || [
      { username:'john_doe', first:'John', last:'Doe', email:'john@example.com', contact:'1234567890', status:'active', address:'123 Main St', notes:'' },
      { username:'jane_smith', first:'Jane', last:'Smith', email:'jane@example.com', contact:'2345678901', status:'active', address:'', notes:'' },
      { username:'maria_lee', first:'Maria', last:'Lee', email:'maria@example.com', contact:'3456789012', status:'active', address:'', notes:'' }
    ];
    save('iSagip_residents', residents);

    var pendingUpdates = load('iSagip_pending_updates', null) || [
      { username:'john_doe', changes:{ email:'john.new@example.com', contact:'1112223333' }, requestedAt:'2025-09-10 09:15 PM' }
    ];
    save('iSagip_pending_updates', pendingUpdates);

    function fullName(r){ return r.first + ' ' + r.last; }

    function render(){
      var q = (search ? search.value.toLowerCase() : '');
      var filter = statusSel ? statusSel.value : 'all';
      var list = residents.filter(function(r){
        var matches = !q || r.username.toLowerCase().includes(q) || fullName(r).toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
        var statusOk = filter==='all' || (filter==='pending' ? pendingUpdates.some(function(p){return p.username===r.username;}) : r.status===filter);
        return matches && statusOk;
      });

      rows.innerHTML = list.map(function(r){
        return '<div class="t-row" data-u="'+r.username+'">'+
          '<div>'+r.username+'</div>'+
          '<div>'+fullName(r)+'</div>'+
          '<div>'+r.email+'</div>'+
          '<div>'+r.contact+'</div>'+
          '<div class="res-actions">'+
            '<button class="icon-btn edit">✎</button>'+
            '<button class="icon-btn delete">🗑</button>'+
            '<button class="icon-btn warn reset">⟲</button>'+
          '</div>'+
        '</div>';
      }).join('');

      approvalsEl.innerHTML = pendingUpdates.map(function(p){
        var changeList = Object.keys(p.changes).map(function(k){ return '<strong>'+k+':</strong> '+p.changes[k];}).join(', ');
        return '<div class="t-row" data-u="'+p.username+'">'+
          '<div>'+p.username+'</div>'+
          '<div>'+changeList+'</div>'+
          '<div>'+p.requestedAt+'</div>'+
          '<div class="res-actions">'+
            '<button class="icon-btn approve">Approve</button>'+
            '<button class="icon-btn delete reject">Reject</button>'+
          '</div>'+
        '</div>';
      }).join('');
    }
    render();

    if (search) search.addEventListener('input', render);
    if (statusSel) statusSel.addEventListener('change', render);

    // Edit modal
    var editModal = document.getElementById('res-edit-modal');
    var editFirst = document.getElementById('edit-first');
    var editLast = document.getElementById('edit-last');
    var editEmail = document.getElementById('edit-email');
    var editContact = document.getElementById('edit-contact');
    var editAddress = document.getElementById('edit-address');
    var editNotes = document.getElementById('edit-notes');
    var saveBtn = document.getElementById('res-save');
    var editingUser = null;

    rows.addEventListener('click', function(e){
      var tr = e.target.closest('.t-row');
      if (!tr) return;
      var username = tr.getAttribute('data-u');
      var r = residents.find(function(x){return x.username===username;});
      if (!r) return;

      if (e.target.classList.contains('edit')) {
        editingUser = r;
        editFirst.value = r.first; editLast.value = r.last; editEmail.value = r.email; editContact.value = r.contact; editAddress.value = r.address||''; editNotes.value = r.notes||'';
        editModal.hidden = false;
      } else if (e.target.classList.contains('delete')) {
        residents = residents.filter(function(x){return x.username!==username;});
        // Also remove pending updates for this user
        pendingUpdates = pendingUpdates.filter(function(p){return p.username!==username;});
        save('iSagip_residents', residents); save('iSagip_pending_updates', pendingUpdates);
        render();
      } else if (e.target.classList.contains('reset')) {
        currentResetUser = r;
        resetModal.hidden = false;
      }
    });

    // Save edits
    if (saveBtn) {
      saveBtn.addEventListener('click', function(){
        if (!editingUser) return;
        editingUser.first = editFirst.value.trim();
        editingUser.last = editLast.value.trim();
        editingUser.email = editEmail.value.trim();
        editingUser.contact = editContact.value.trim();
        editingUser.address = editAddress.value.trim();
        editingUser.notes = editNotes.value.trim();
        editModal.hidden = true;
        save('iSagip_residents', residents);
        render();
      });
    }

    // Reset password modal
    var resetModal = document.getElementById('res-reset-modal');
    var resetInput = document.getElementById('reset-pass');
    var resetBtn = document.getElementById('res-reset');
    var currentResetUser = null;
    if (resetBtn) {
      resetBtn.addEventListener('click', function(){
        // In real app: call API; here we just close modal
        resetModal.hidden = true; resetInput.value = '';
      });
    }

    // Approvals
    approvalsEl.addEventListener('click', function(e){
      var tr = e.target.closest('.t-row');
      if (!tr) return;
      var username = tr.getAttribute('data-u');
      var idx = pendingUpdates.findIndex(function(p){return p.username===username;});
      if (idx === -1) return;
      if (e.target.classList.contains('approve')) {
        var p = pendingUpdates[idx];
        var r = residents.find(function(x){return x.username===username;});
        if (r) Object.assign(r, p.changes);
        pendingUpdates.splice(idx,1);
        save('iSagip_residents', residents); save('iSagip_pending_updates', pendingUpdates);
        render();
      } else if (e.target.classList.contains('reject')) {
        pendingUpdates.splice(idx,1);
        save('iSagip_pending_updates', pendingUpdates);
        render();
      }
    });

    // Close modals
    document.addEventListener('click', function(e){
      if (e.target.matches('[data-close]')) {
        editModal && (editModal.hidden = true);
        resetModal && (resetModal.hidden = true);
      }
      if (e.target.classList.contains('modal')) {
        e.target.hidden = true;
      }
    });
  })();

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
   * Handles dark mode toggle, password change, and role display
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
    if (prefersReduced) { window.location.href = url; return; }

    document.body.classList.remove('page-enter');
    document.body.classList.add('page-leave');
    setTimeout(function(){ window.location.href = url; }, 180);
  }

  // ========================================
  // OPTIONAL: FIREBASE INTEGRATION LAYER (NO-OP SAFE)
  // ========================================
  var Firebase = (function(){
    var app = null;
    var db = null;

    function hasSdk(){ return typeof window !== 'undefined' && !!(window.firebase && (window.firebase.initializeApp || (window.firebase.app && window.firebase.app()))); }
    function hasConfig(){ return typeof window !== 'undefined' && !!window.iSagipFirebaseConfig; }
    function isEnabled(){ try { return localStorage.getItem('iSagip_useFirebase') === 'true'; } catch(e){ return false; } }

    function init(){
      if (!hasSdk() || !hasConfig()) return false;
      try {
        // Compat style initialization (works with v8/v9 compat)
        if (!window.firebase.apps || !window.firebase.apps.length) {
          app = window.firebase.initializeApp(window.iSagipFirebaseConfig);
        } else {
          app = window.firebase.app();
        }
        db = window.firebase.firestore ? window.firebase.firestore() : (window.firebase.firestore && window.firebase.firestore.getFirestore ? window.firebase.firestore.getFirestore() : null);
        return true;
      } catch(e){ console.log('Firebase init failed:', e); return false; }
    }

    function getDb(){ return db; }

    return { isAvailable: function(){ return hasSdk() && hasConfig(); }, init: init, getDb: getDb };
  })();

  // Example data API wrapping Firestore reads/writes if available
  var ReportsAPI = (function(){
    function onNewReports(callback){
      var db = Firebase.getDb();
      if (!db || !db.collection) return function(){}; // no-op unsubscribe
      try {
        var unsub = db.collection('reports').orderBy('timestamp','desc').limit(20).onSnapshot(function(snap){
          var list = [];
          snap.forEach(function(doc){ var d = doc.data(); d.id = d.id || doc.id; list.push(d); });
          callback(list);
        });
        return unsub;
      } catch(e){ console.log('onNewReports error:', e); return function(){}; }
    }

    function add(report){
      var db = Firebase.getDb();
      if (!db || !db.collection) return Promise.resolve(false);
      try { return db.collection('reports').add(report); } catch(e){ console.log('add report error:', e); return Promise.resolve(false); }
    }

    return { onNewReports: onNewReports, add: add };
  })();

  // Auto-init Firebase if SDK+config present or flag set
  (function maybeInitFirebase(){
    try {
      if ((window.iSagipFirebaseConfig && window.firebase) || localStorage.getItem('iSagip_useFirebase')==='true') {
        Firebase.init();
      }
    } catch(e){}
  })();

  /**
   * Initialize password change functionality
   * Handles modal opening/closing and form submission
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
    closeModalBtn.addEventListener('click', closePasswordModal);
    cancelBtn.addEventListener('click', closePasswordModal);
    
    // Close modal when clicking outside
    changePasswordModal.addEventListener('click', function(e) {
      if (e.target === changePasswordModal) {
        closePasswordModal();
      }
    });
    
    // Handle form submission
    passwordForm.addEventListener('submit', handlePasswordChange);
    
    function closePasswordModal() {
      changePasswordModal.hidden = true;
      passwordForm.reset();
    }
  }

  /**
   * Handle password change form submission
   * @param {Event} e - Form submit event
   */
  function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match. Please try again.');
      return;
    }
    
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters long.');
      return;
    }
    
    // TODO: Implement actual password change logic with backend
    // For now, just show success message
    alert('Password changed successfully!');
    
    // Close modal and reset form
    document.getElementById('change-password-modal').hidden = true;
    e.target.reset();
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
  // NOTIFICATION SYSTEM
  // ========================================
  
  /**
   * Initialize notification system for Barangay Staff
   * Handles new report notifications with sound and visual alerts
   */
  (function initializeNotificationSystem() {
    // Only initialize for Barangay Staff users
    const userRole = localStorage.getItem('iSagip_userRole');
    if (userRole !== 'barangay_staff') return;
    
    // Initialize notification container
    initializeNotificationContainer();
    
    // Start simulating new reports (for demo purposes)
    // TODO: Replace with real-time backend integration
    startReportSimulation();
  })();

  /**
   * Initialize notification container and event handlers
   */
  function initializeNotificationContainer() {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    // Handle notification close events
    container.addEventListener('click', function(e) {
      if (e.target.classList.contains('notification-close')) {
        const notification = e.target.closest('.notification');
        if (notification) {
          removeNotification(notification);
        }
      }
    });
  }

  /**
   * Show a new report notification
   * @param {Object} reportData - Report data object
   */
  function showNewReportNotification(reportData) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    // Create notification element
    const notification = createNotificationElement(reportData);
    
    // Add to container
    container.appendChild(notification);
    
    // Show notification with animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    // Play notification sound
    playNotificationSound();
    
    // Show sound indicator
    showSoundIndicator();
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      removeNotification(notification);
    }, 10000);
  }

  /**
   * Create notification element HTML
   * @param {Object} reportData - Report data
   * @returns {HTMLElement} - Notification element
   */
  function createNotificationElement(reportData) {
    const notification = document.createElement('div');
    notification.className = 'notification emergency';
    
    const currentTime = new Date().toLocaleTimeString();
    
    notification.innerHTML = `
      <div class="notification-header">
        <div class="notification-title">🚨 New Emergency Report</div>
        <button class="notification-close">&times;</button>
      </div>
      <div class="notification-body">
        <strong>Report ID:</strong> ${reportData.id}<br>
        <strong>Description:</strong> ${reportData.description}<br>
        <strong>Location:</strong> ${reportData.street}<br>
        <strong>Reported by:</strong> ${reportData.reportedBy}
      </div>
      <div class="notification-time">${currentTime}</div>
    `;
    
    return notification;
  }

  /**
   * Remove notification with animation
   * @param {HTMLElement} notification - Notification element to remove
   */
  function removeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  /**
   * Play notification sound
   * Uses Web Audio API to generate a notification sound
   */
  function playNotificationSound() {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create oscillator for notification sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure sound (emergency notification tone)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      // Configure volume
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
      
      // Play sound
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }

  /**
   * Show sound indicator
   * Displays a temporary indicator that sound was played
   */
  function showSoundIndicator() {
    const indicator = document.getElementById('sound-indicator');
    if (!indicator) return;
    
    indicator.classList.add('show');
    
    setTimeout(() => {
      indicator.classList.remove('show');
    }, 2000);
  }

  /**
   * Start report simulation for demo purposes
   * TODO: Replace with real-time backend integration
   */
  function startReportSimulation() {
    // Simulate new reports every 30-60 seconds
    const simulateNewReport = () => {
      const mockReports = [
        {
          id: 'REP-' + Date.now(),
          description: 'Kitchen fire, smoke visible',
          street: 'Block 3, Lot 5',
          reportedBy: 'Alice Johnson'
        },
        {
          id: 'REP-' + Date.now(),
          description: 'Medical emergency - chest pain',
          street: 'Block 1, Lot 12',
          reportedBy: 'Bob Smith'
        },
        {
          id: 'REP-' + Date.now(),
          description: 'Suspicious activity reported',
          street: 'Block 2, Lot 8',
          reportedBy: 'Carol Davis'
        },
        {
          id: 'REP-' + Date.now(),
          description: 'Child with high fever',
          street: 'Block 4, Lot 3',
          reportedBy: 'David Wilson'
        }
      ];
      
      // Pick random report
      const randomReport = mockReports[Math.floor(Math.random() * mockReports.length)];
      
      // Show notification
      showNewReportNotification(randomReport);
      
      // Update reports table if on reports page
      updateReportsTable(randomReport);
      
      // Schedule next simulation
      const nextDelay = Math.random() * 30000 + 30000; // 30-60 seconds
      setTimeout(simulateNewReport, nextDelay);
    };
    
    // Start first simulation after 10 seconds
    setTimeout(simulateNewReport, 10000);
  }

  /**
   * Initialize test notification button for demo purposes
   */
  (function initializeTestNotificationButton() {
    const testBtn = document.getElementById('test-notification-btn');
    if (!testBtn) return;
    
    testBtn.addEventListener('click', function() {
      // Create a test notification
      const testReport = {
        id: 'TEST-' + Date.now(),
        description: 'Test emergency notification',
        street: 'Test Location',
        reportedBy: 'System Test'
      };
      
      showNewReportNotification(testReport);
    });
  })();

  /**
   * Update reports table with new report
   * @param {Object} newReport - New report data
   */
  function updateReportsTable(newReport) {
    // Check if we're on the reports page
    if (!document.getElementById('reports-rows')) return;
    
    // Get existing reports from localStorage or use default
    let reports = JSON.parse(localStorage.getItem('iSagip_reports')) || [
      { id: 'REP-2024-001', description: 'Kitchen fire, smoke visible', status: 'Ongoing', street: 'Block 3, Lot 5', landmark: 'Beside Barangay Hall', reportedBy: 'Alice', timestamp: '2024-03-20 10:15 AM', responseTime: '20 minutes', closedBy: '', updatedBy: '', updatedAt: '', notes: '' },
      { id: 'REP-2024-002', description: 'Suspicious activity reported', status: 'Pending', street: 'Block 2, Lot 1', landmark: 'Near parking Lot', reportedBy: 'Bob', timestamp: '2024-03-20 09:45 AM', responseTime: 'N/A', closedBy: '', updatedBy: '', updatedAt: '', notes: '' },
      { id: 'REP-2024-003', description: 'Child with high fever', status: 'Pending', street: 'Block 4, Lot 7', landmark: 'Green Gate 2 floors house', reportedBy: 'Carol', timestamp: '2024-03-21 08:10 AM', responseTime: 'N/A', closedBy: '', updatedBy: '', updatedAt: '', notes: '' }
    ];
    
    // Add new report to the beginning of the array
    const reportWithTimestamp = {
      ...newReport,
      status: 'Pending',
      landmark: 'Near reported location',
      timestamp: new Date().toLocaleString(),
      responseTime: 'N/A',
      closedBy: '',
      updatedBy: '',
      updatedAt: '',
      notes: ''
    };
    
    reports.unshift(reportWithTimestamp);
    
    // Save updated reports
    localStorage.setItem('iSagip_reports', JSON.stringify(reports));
    
    // Re-render the table
    if (typeof renderReportsTable === 'function') {
      renderReportsTable();
    }
  }
})();


