// Settings: theme toggle, change password, language/timezone, default landing
(function(){
  if (!document.getElementById('dark-mode-toggle')) return;

  function initializeDarkModeToggle(){
    var toggle=document.getElementById('dark-mode-toggle'); if(!toggle) return;
    var saved=localStorage.getItem('iSagip_theme')||'light';
    applyTheme(saved); toggle.checked = saved==='dark';
    toggle.addEventListener('change', function(){ var t=this.checked?'dark':'light'; applyTheme(t); try { localStorage.setItem('iSagip_theme', t); } catch(e){} });
  }

  function displayCurrentRole(){ var roleDisplay=document.getElementById('current-role-display'); if(!roleDisplay) return; var role=localStorage.getItem('iSagip_userRole')||'system_admin'; var names={'system_admin':'System Administrator','barangay_staff':'Barangay Staff','live_viewer':'Live Viewer'}; roleDisplay.textContent=names[role]||'Unknown Role'; }

  function populateTimezones(selectEl){ var zones=[]; try { zones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []; } catch(e){} if(!zones||!zones.length){ zones=['Asia/Manila','UTC','Asia/Singapore','Asia/Hong_Kong','Asia/Tokyo']; } var current=(function(){ try { return localStorage.getItem('iSagip_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(e){ return 'Asia/Manila'; } })(); selectEl.innerHTML=zones.map(function(z){ return '<option value="'+z+'"'+(z===current?' selected':'')+'>'+z+'</option>'; }).join(''); }

  function initializeLocaleSettings(){
    var langEl=document.getElementById('settings-language');
    var timeFmtEl=document.getElementById('settings-time-format');
    var dateFmtEl=document.getElementById('settings-date-format');
    var tzEl=document.getElementById('settings-timezone');
    var saveBtn=document.getElementById('save-locale-btn');
    if (!langEl||!timeFmtEl||!dateFmtEl||!tzEl||!saveBtn) return;
    populateTimezones(tzEl);
    try { var lang=localStorage.getItem('iSagip_language'); if (lang) langEl.value=lang; var tf=localStorage.getItem('iSagip_timeFormat'); if (tf) timeFmtEl.value=tf; var df=localStorage.getItem('iSagip_dateFormat'); if (df) dateFmtEl.value=df; var tz=localStorage.getItem('iSagip_timezone'); if (tz) tzEl.value=tz; } catch(e){}
    saveBtn.addEventListener('click', function(){ try { localStorage.setItem('iSagip_language', langEl.value); localStorage.setItem('iSagip_timeFormat', timeFmtEl.value); localStorage.setItem('iSagip_dateFormat', dateFmtEl.value); localStorage.setItem('iSagip_timezone', tzEl.value); } catch(e){} alert('Language & region preferences saved.'); });
  }

  function initializeDefaultLandingSetting(){ var sel=document.getElementById('settings-default-landing'); if(!sel) return; try { var saved=localStorage.getItem('iSagip_defaultLanding'); if(saved) sel.value=saved; } catch(e){} sel.addEventListener('change', function(){ try { localStorage.setItem('iSagip_defaultLanding', sel.value); } catch(e){} }); }

  function initializePasswordChange(){
    var changeBtn=document.getElementById('change-password-btn');
    var modal=document.getElementById('change-password-modal');
    var closeBtn=document.getElementById('close-password-modal');
    var cancelBtn=document.getElementById('cancel-password-change');
    var form=document.getElementById('change-password-form');
    var newPwd=document.getElementById('new-password');
    var meterFill=document.getElementById('password-meter-fill');
    var meterLabel=document.getElementById('password-strength-label');
    if (!changeBtn||!modal) return;
    changeBtn.addEventListener('click', function(){ modal.hidden=false; });
    closeBtn.addEventListener('click', function(){ modal.hidden=true; form.reset(); });
    cancelBtn.addEventListener('click', function(){ modal.hidden=true; form.reset(); });
    modal.addEventListener('click', function(e){ if (e.target===modal){ modal.hidden=true; form.reset(); } });
    form.addEventListener('submit', function(e){ e.preventDefault(); var cur=document.getElementById('current-password').value; var np=document.getElementById('new-password').value; var cp=document.getElementById('confirm-password').value; if (np!==cp){ alert('New passwords do not match.'); return; } if (np.length<6){ alert('New password must be at least 6 characters long.'); return; } alert('Password changed successfully!'); modal.hidden=true; form.reset(); });
    if (newPwd&&meterFill&&meterLabel){ newPwd.addEventListener('input', function(){ var s=evaluatePasswordStrength(newPwd.value||''); meterFill.style.width=s.score+'%'; meterFill.style.background=s.color; meterLabel.textContent=s.label; }); }
  }

  function evaluatePasswordStrength(pwd){ var score=0; if(pwd.length>=6) score+=20; if(pwd.length>=10) score+=20; if(/[a-z]/.test(pwd)) score+=20; if(/[A-Z]/.test(pwd)) score+=20; if(/[0-9]/.test(pwd)) score+=10; if(/[^A-Za-z0-9]/.test(pwd)) score+=10; if(score>100) score=100; var label=score<40?'Weak':score<70?'Medium':'Strong'; var color=score<40?'#ef4444':score<70?'#f59e0b':'#10b981'; return {score:score,label:label,color:color}; }

  initializeDarkModeToggle();
  initializePasswordChange();
  displayCurrentRole();
  initializeLocaleSettings();
  initializeDefaultLandingSetting();
})();


