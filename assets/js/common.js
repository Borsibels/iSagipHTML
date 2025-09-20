// Common stuff used on most pages
// - theme (dark/light), sidebar + RBAC, logout, simple page fade
// - tiny notification helper (for staff)
// - basic Firebase hooks (safe to ignore if SDK not loaded)

(function(){
  // Theme (dark/light) bootstrap
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    setTimeout(function(){
      document.body.offsetHeight;
      updateCustomElementsForTheme(theme);
    }, 100);
  }

  function updateCustomElementsForTheme(theme) {
    var selectors = ['.table', '.stat', '.ambulance-card', '.notification', '.modal-dialog', '.settings-section', '.search-section'];
    selectors.forEach(function(sel){
      var els = document.querySelectorAll(sel);
      els.forEach(function(el){ el.style.display='none'; el.offsetHeight; el.style.display=''; });
    });
  }

  (function initializeGlobalDarkMode(){
    try { applyTheme(localStorage.getItem('iSagip_theme') || 'light'); } catch(e){ applyTheme('light'); }
    document.addEventListener('DOMContentLoaded', function(){ document.body.classList.add('page-enter'); });
  })();

  // expose a few helpers for page scripts
  window.applyTheme = applyTheme;
  window.updateCustomElementsForTheme = updateCustomElementsForTheme;

  // Little fade when navigating between pages
  function navigateWithFade(url){
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { window.location.href = url; return; }
    document.body.classList.remove('page-enter');
    document.body.classList.add('page-leave');
    setTimeout(function(){ window.location.href = url; }, 180);
  }
  window.navigateWithFade = navigateWithFade;

  // Logout button (if present)
  (function attachLogout(){
    var logout = document.getElementById('logout');
    if (!logout) return;
    logout.addEventListener('click', function(){
      try { localStorage.removeItem('iSagip_userRole'); } catch(e){}
      navigateWithFade('index.html');
    });
  })();

  // Sidebar + simple role-based menu filtering
  function shouldShowMenuItem(userRole, menuText) {
    var rolePermissions = {
      'system_admin': { allowed: ['Registration', 'Resident Management', 'Settings'], denied: ['Dashboard', 'Reports', 'Ambulance'] },
      'barangay_staff': { allowed: ['Dashboard', 'Reports', 'Ambulance', 'Settings'], denied: ['Registration', 'Resident Management'] },
      'live_viewer': { allowed: ['Reports Viewing', 'Settings'], denied: ['Dashboard', 'Reports', 'Ambulance', 'Registration', 'Resident Management'] }
    };
    var permissions = rolePermissions[userRole] || rolePermissions['system_admin'];
    var isDenied = permissions.denied.some(function(d){ return menuText.indexOf(d) !== -1; });
    if (isDenied) return false;
    return permissions.allowed.some(function(a){ return menuText.indexOf(a) !== -1; });
  }

  function isMenuItemActive(href, currentPath) {
    if (href === '#' && (currentPath === '' || currentPath === 'dashboard.html')) return true;
    return href === currentPath || href === ('./' + currentPath);
  }

  function highlightActiveMenuItem(menu){
    var links = menu.querySelectorAll('.menu-item');
    var currentPath = location.pathname.split('/').pop();
    links.forEach(function(link){
      var href = link.getAttribute('href');
      var active = isMenuItemActive(href, currentPath);
      if (active) link.classList.add('active'); else link.classList.remove('active');
    });
  }

  function applyRoleBasedAccessControl(menu, userRole){
    var links = menu.querySelectorAll('.menu-item');
    links.forEach(function(item){
      var menuText = item.textContent.trim();
      var show = shouldShowMenuItem(userRole, menuText);
      item.style.display = show ? '' : 'none';
    });
  }

  (function initSidebar(){
    var menu = document.getElementById('sidebar-menu');
    if (!menu) return;
    var userRole = localStorage.getItem('iSagip_userRole') || 'system_admin';
    applyRoleBasedAccessControl(menu, userRole);
    highlightActiveMenuItem(menu);
    menu.addEventListener('click', function(e){
      var link = e.target.closest('a.menu-item');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href === '#') return;
      e.preventDefault();
      navigateWithFade(href);
    });
  })();

  // Basic notification popups (only for barangay staff)
  function initializeNotificationContainer() {
    var container = document.getElementById('notification-container');
    if (!container) return;
    container.addEventListener('click', function(e){
      if (e.target.classList.contains('notification-close')) {
        var n = e.target.closest('.notification');
        if (n) removeNotification(n);
      }
    });
  }

  function createNotificationElement(reportData) {
    var el = document.createElement('div');
    el.className = 'notification emergency';
    var t = new Date().toLocaleTimeString();
    el.innerHTML = '<div class="notification-header">\
      <div class="notification-title">🚨 New Emergency Report</div>\
      <button class="notification-close">&times;</button>\
    </div>\
    <div class="notification-body">\
      <strong>Report ID:</strong> ' + (reportData.id||'') + '<br>\
      <strong>Description:</strong> ' + (reportData.description||'') + '<br>\
      <strong>Location:</strong> ' + (reportData.street||'') + '<br>\
      <strong>Reported by:</strong> ' + (reportData.reportedBy||'') + '\
    </div>\
    <div class="notification-time">' + t + '</div>';
    return el;
  }

  function removeNotification(notification){
    notification.classList.remove('show');
    setTimeout(function(){ if (notification.parentNode) notification.parentNode.removeChild(notification); }, 300);
  }

  function showSoundIndicator(){
    var indicator = document.getElementById('sound-indicator');
    if (!indicator) return;
    indicator.classList.add('show');
    setTimeout(function(){ indicator.classList.remove('show'); }, 2000);
  }

  function playNotificationSound(){
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch(e){}
  }

  function showNewReportNotification(reportData){
    var container = document.getElementById('notification-container');
    if (!container) return;
    var n = createNotificationElement(reportData || {});
    container.appendChild(n);
    setTimeout(function(){ n.classList.add('show'); }, 100);
    playNotificationSound();
    showSoundIndicator();
    setTimeout(function(){ removeNotification(n); }, 10000);
  }

  function startReportSimulation(){
    var simulate = function(){
      var list = [
        { id:'REP-'+Date.now(), description:'Kitchen fire, smoke visible', street:'Block 3, Lot 5', reportedBy:'Alice Johnson' },
        { id:'REP-'+Date.now(), description:'Medical emergency - chest pain', street:'Block 1, Lot 12', reportedBy:'Bob Smith' },
        { id:'REP-'+Date.now(), description:'Suspicious activity reported', street:'Block 2, Lot 8', reportedBy:'Carol Davis' },
        { id:'REP-'+Date.now(), description:'Child with high fever', street:'Block 4, Lot 3', reportedBy:'David Wilson' }
      ];
      var r = list[Math.floor(Math.random()*list.length)];
      showNewReportNotification(r);
      updateReportsTable(r);
      var next = Math.random()*30000 + 30000;
      setTimeout(simulate, next);
    };
    setTimeout(simulate, 10000);
  }

  function initializeNotificationSystem(){
    var role = localStorage.getItem('iSagip_userRole');
    if (role !== 'barangay_staff') return;
    initializeNotificationContainer();
    startReportSimulation();
    (function initTestBtn(){
      var testBtn = document.getElementById('test-notification-btn');
      if (!testBtn) return;
      testBtn.addEventListener('click', function(){
        showNewReportNotification({ id:'TEST-'+Date.now(), description:'Test emergency notification', street:'Test Location', reportedBy:'System Test' });
      });
    })();
  }
  initializeNotificationSystem();

  // expose selectively
  window.showNewReportNotification = showNewReportNotification;
  window.updateReportsTable = updateReportsTable;

  // If the reports page is open, try to add rows there too
  function updateReportsTable(newReport){
    if (!document.getElementById('reports-rows')) return;
    var reports = [];
    try {
      reports = JSON.parse(localStorage.getItem('iSagip_reports')) || [];
    } catch(e){ reports = []; }
    var enriched = Object.assign({
      status:'Pending', landmark:'Near reported location', timestamp:new Date().toLocaleString(),
      responseTime:'N/A', closedBy:'', updatedBy:'', updatedAt:'', notes:''
    }, newReport||{});
    reports.unshift(enriched);
    try { localStorage.setItem('iSagip_reports', JSON.stringify(reports)); } catch(e){}
    if (typeof window.renderReportsTable === 'function') { window.renderReportsTable(); }
  }

  // Optional Firebase layer (works only if SDK + config are present)
  var Firebase = (function(){
    var app=null, db=null;
    function hasSdk(){ return typeof window!=='undefined' && !!(window.firebase && (window.firebase.initializeApp || (window.firebase.app && window.firebase.app()))); }
    function hasConfig(){ return typeof window!=='undefined' && !!window.iSagipFirebaseConfig; }
    function init(){
      if (!hasSdk() || !hasConfig()) return false;
      try {
        if (!window.firebase.apps || !window.firebase.apps.length) { app = window.firebase.initializeApp(window.iSagipFirebaseConfig); }
        else { app = window.firebase.app(); }
        db = window.firebase.firestore ? window.firebase.firestore() : null;
        return true;
      } catch(e){ return false; }
    }
    function getDb(){ return db; }
    return { isAvailable:function(){return hasSdk()&&hasConfig();}, init:init, getDb:getDb };
  })();
  window.Firebase = Firebase;

  var ReportsAPI = (function(){
    function onNewReports(cb){ var db = Firebase.getDb(); if (!db||!db.collection) return function(){}; try { return db.collection('reports').orderBy('timestamp','desc').limit(20).onSnapshot(function(s){ var list=[]; s.forEach(function(doc){ var d=doc.data(); d.id=d.id||doc.id; list.push(d); }); cb(list); }); } catch(e){ return function(){}; } }
    function add(r){ var db = Firebase.getDb(); if (!db||!db.collection) return Promise.resolve(false); try { return db.collection('reports').add(r); } catch(e){ return Promise.resolve(false);} }
    return { onNewReports:onNewReports, add:add };
  })();
  window.ReportsAPI = ReportsAPI;

  (function maybeInitFirebase(){ try { if ((window.iSagipFirebaseConfig && window.firebase) || localStorage.getItem('iSagip_useFirebase')==='true') { Firebase.init(); } } catch(e){} })();
})();


