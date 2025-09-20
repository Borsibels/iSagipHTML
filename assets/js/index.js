// Login page: tab switch + redirect based on chosen role
(function(){
  var tabs = document.querySelectorAll('.tab');
  function updateLoginPageContent(isReportsTab){
    var title=document.getElementById('login-title');
    var subtitle=document.getElementById('login-subtitle');
    var button=document.getElementById('login-button');
    if (!title||!subtitle||!button) return;
    if (isReportsTab){ title.textContent='iSagip Barangay Staff'; subtitle.textContent='Sign in to barangay staff dashboard'; button.textContent='Login to Staff Dashboard'; }
    else { title.textContent='iSagip System Admin'; subtitle.textContent='Sign in to system admin dashboard'; button.textContent='Login to Admin Dashboard'; }
  }
  if (tabs.length){
    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        var card=document.querySelector('.login-card'); if(card){ card.classList.add('fade-swap','is-swapping'); }
        tabs.forEach(function(t){ t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
        tab.classList.add('active'); tab.setAttribute('aria-selected','true');
        setTimeout(function(){ updateLoginPageContent(tab.dataset.tab==='reports'); if(card){ card.classList.remove('is-swapping'); } }, 120);
      });
    });
  }

  function isPageAllowedForRole(role, path){
    var allow={ 'system_admin':['register-staff.html','register-resident.html','resident-management.html','settings.html'], 'barangay_staff':['dashboard.html','reports.html','ambulance.html','reportsViewing.html','settings.html'], 'live_viewer':['reportsViewing.html','settings.html'] };
    var list=allow[role]||[]; return list.indexOf(path)!==-1;
  }
  function getDestinationForRole(role){
    try { var preferred=localStorage.getItem('iSagip_defaultLanding'); if (preferred && isPageAllowedForRole(role, preferred)) return preferred; } catch(e){}
    var roleDest={ 'system_admin':'register-staff.html', 'barangay_staff':'dashboard.html', 'live_viewer':'reportsViewing.html' };
    return roleDest[role]||'dashboard.html';
  }

  var form=document.getElementById('login-form');
  if (form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var active=document.querySelector('.tab.active');
      var isReports=active && active.dataset.tab==='reports';
      var role=isReports?'barangay_staff':'system_admin';
      try { localStorage.setItem('iSagip_userRole', role); } catch(e){}
      var dest=getDestinationForRole(role);
      navigateWithFade(dest);
    });
  }

  // Shortcut into live viewing (TV mode)
  var liveViewingBtn=document.getElementById('live-viewing-button');
  if (liveViewingBtn){
    liveViewingBtn.addEventListener('click', function(){
      try { localStorage.setItem('iSagip_userRole','live_viewer'); } catch(e){}
      navigateWithFade('reportsViewing.html');
    });
  }
})();


