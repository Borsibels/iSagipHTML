// Login page: redirect based on account role (no tabs / no shortcuts)
(function(){

  function isPageAllowedForRole(role, path){
    var allow={ 'system_admin':['register-staff.html','register-resident.html','resident-management.html','settings.html'], 'barangay_staff':['dashboard.html','reports.html','ambulance.html','reportsViewing.html','settings.html'], 'live_viewer':['reportsViewing.html','settings.html'] };
    var list=allow[role]||[]; return list.indexOf(path)!==-1;
  }
  function getDestinationForRole(role){
    try { var preferred=localStorage.getItem('iSagip_defaultLanding'); if (preferred && isPageAllowedForRole(role, preferred)) return preferred; } catch(e){}
    var roleDest={ 'system_admin':'register-staff.html', 'barangay_staff':'dashboard.html', 'live_viewer':'reportsViewing.html' };
    return roleDest[role]||'dashboard.html';
  }

  function normalizeRole(role){
    var r=(role||'').toString().toLowerCase();
    if (r.indexOf('admin')!==-1) return 'system_admin';
    if (r.indexOf('viewer')!==-1) return 'live_viewer';
    return 'barangay_staff';
  }

  // Seed default accounts for testing if none exist
  (function seedAccountsIfMissing(){
    try {
      var existing=JSON.parse(localStorage.getItem('iSagip_accounts')||'null');
      if (!Array.isArray(existing) || existing.length===0){
        localStorage.setItem('iSagip_accounts', JSON.stringify([
          { username: 'admin', password: 'pass', role: 'system_admin' },
          { username: 'staff', password: 'pass', role: 'barangay_staff' },
          { username: 'tv',    password: 'pass', role: 'live_viewer' }
        ]));
      }
    } catch(e){}
  })();

  function findAccount(username, password){
    try {
      var accounts=JSON.parse(localStorage.getItem('iSagip_accounts')||'null');
      if (Array.isArray(accounts)){
        var uname=(username||'').toString().toLowerCase();
        for (var i=0;i<accounts.length;i++){
          var a=accounts[i]||{};
          var an=(a.username||a.email||'').toString().toLowerCase();
          if (an===uname){
            // If password exists in store, match it; otherwise accept
            if (!a.password || a.password===password) return a;
          }
        }
      }
    } catch(e){}
    return null;
  }

  function findAccountByUsername(username){
    try {
      var accounts=JSON.parse(localStorage.getItem('iSagip_accounts')||'null');
      if (Array.isArray(accounts)){
        var uname=(username||'').toString().toLowerCase();
        for (var i=0;i<accounts.length;i++){
          var a=accounts[i]||{};
          var an=(a.username||a.email||'').toString().toLowerCase();
          if (an===uname) return a;
        }
      }
    } catch(e){}
    return null;
  }

  function getErrorEl(){
    var form=document.getElementById('login-form'); if(!form) return null;
    var node=document.getElementById('login-error');
    if(!node){ node=document.createElement('div'); node.id='login-error'; node.className='error-message'; node.style.display='none'; node.style.color='#ef4444'; form.appendChild(node); }
    return node;
  }

  function showLoginError(msg){ var el=getErrorEl(); if(!el) return; el.textContent=msg; el.style.color='#ef4444'; el.style.display=''; }
  function clearLoginError(){ var el=getErrorEl(); if(!el) return; el.textContent=''; el.style.display='none'; }

  var form=document.getElementById('login-form');
  if (form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      clearLoginError();
      var username=document.getElementById('username')?document.getElementById('username').value:'';
      var password=document.getElementById('password')?document.getElementById('password').value:'';
      var u=(username||'').trim(); var p=(password||'').trim();
      if(!u || !p){ showLoginError('Please enter your username and password.'); return; }

      var accountsRaw=null; try{ accountsRaw=JSON.parse(localStorage.getItem('iSagip_accounts')||'null'); }catch(_){ accountsRaw=null; }
      if (!Array.isArray(accountsRaw) || accountsRaw.length===0){ showLoginError('No accounts Found. Please contact your administrator.'); return; }
      var byUser=findAccountByUsername(u);
      if(!byUser){ showLoginError('Account not found.'); return; }
      if (String(byUser.password||'')!==p){ showLoginError('Incorrect password.'); return; }
      var role=normalizeRole(byUser.role);
      try { localStorage.setItem('iSagip_userRole', role); } catch(e){}
      var dest=getDestinationForRole(role);
      navigateWithFade(dest);
    });
  }
})();


