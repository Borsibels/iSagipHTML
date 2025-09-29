// Registration (staff/responder): show responder type only when needed
(function(){
  var roleSel=document.getElementById('reg-role');
  var typeWrap=document.getElementById('reg-responder-type-wrap');
  function toggleType(){ if (!roleSel||!typeWrap) return; typeWrap.style.display = (roleSel.value==='responder') ? '' : 'none'; }
  if (roleSel){ roleSel.addEventListener('change', toggleType); toggleType(); }

  var form=document.getElementById('register-form');
  if (!form) return;

  function toBase64(file){ return new Promise(function(res, rej){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.onerror=rej; r.readAsDataURL(file); }); }

  function getErr(){ var el=document.getElementById('reg-error'); if(!el){ el=document.createElement('div'); el.id='reg-error'; el.className='error-message'; el.style.color='#ef4444'; el.style.marginTop='8px'; el.style.display='none'; form.appendChild(el);} return el; }
  function showErr(m){ var el=getErr(); el.textContent=m; el.style.display=''; }
  function hideErr(){ var el=getErr(); el.textContent=''; el.style.display='none'; }

  // Field references
  var emailEl=document.getElementById('reg-email');
  var contactEl=document.getElementById('reg-contact');
  var passEl=document.getElementById('reg-password');
  var pass2El=document.getElementById('reg-password2');

  // Email basic validation (popup)
  if (emailEl){ emailEl.addEventListener('blur', function(){ var v=(emailEl.value||'').trim(); if (v && v.indexOf('@')===-1){ alert('Please enter a valid email address.'); } }); }

  // Contact: allow digits only, cap at 13
  if (contactEl){ contactEl.addEventListener('input', function(){ var digits=(contactEl.value||'').replace(/\D/g,''); if (digits.length>13) digits=digits.slice(0,13); contactEl.value=digits; }); }

  // Password strength meter
  function ensurePassMeter(el){
    if (!el) return null;
    var existing=document.getElementById(el.id+'-meter');
    if (existing) return existing;
    var wrap=document.createElement('div');
    wrap.id=el.id+'-meter';
    wrap.className='progress-bar';
    wrap.style.marginTop='0px';
    var fill=document.createElement('div');
    fill.className='progress-fill';
    fill.style.width='0%';
    fill.style.height='6px';
    fill.style.borderRadius='4px';
    wrap.appendChild(fill);
    el.parentElement && el.parentElement.appendChild(wrap);
    var label=document.createElement('div');
    label.id=el.id+'-meter-label';
    label.style.fontSize='12px';
    label.style.marginTop='0px';
    el.parentElement && el.parentElement.appendChild(label);
    return wrap;
  }

  function updateStrength(el){
    var v=(el.value||'');
    var score=0; if (v.length>=8) score+=25; if (/[A-Z]/.test(v)) score+=25; if (/[0-9]/.test(v)) score+=25; if (/[^A-Za-z0-9]/.test(v)) score+=25;
    var wrap=ensurePassMeter(el); if(!wrap) return; var fill=wrap.querySelector('.progress-fill'); var label=document.getElementById(el.id+'-meter-label');
    var color= score<50 ? '#ef4444' : (score<75 ? '#f59e0b' : '#10b981');
    if (fill){ fill.style.width=score+'%'; fill.style.background=color; }
    if (label){ label.textContent= score<50 ? 'Weak' : (score<75 ? 'Medium' : 'Strong'); label.style.color=color; }
  }

  if (passEl){ passEl.addEventListener('input', function(){ updateStrength(passEl); }); ensurePassMeter(passEl); }

  // Confirm password inline check
  function ensureFieldError(afterEl, id){ var el=document.getElementById(id); if(el) return el; el=document.createElement('div'); el.id=id; el.style.color='#ef4444'; el.style.fontSize='12px'; el.style.marginTop='4px'; afterEl.parentElement && afterEl.parentElement.appendChild(el); return el; }
  if (pass2El){ pass2El.addEventListener('input', function(){ var err=ensureFieldError(pass2El,'reg-pass2-err'); if (pass2El.value && passEl && pass2El.value!==passEl.value){ err.textContent='Passwords do not match.'; } else { err.textContent=''; } }); }

  form.addEventListener('submit', async function(e){
    try { e.preventDefault(); } catch(_){}
    hideErr();
    var u=document.getElementById('reg-username').value.trim();
    var email=document.getElementById('reg-email').value.trim();
    var pass=document.getElementById('reg-password').value;
    var pass2=document.getElementById('reg-password2').value;
    var first=document.getElementById('reg-first').value.trim();
    var middle=document.getElementById('reg-middle').value.trim();
    var last=document.getElementById('reg-last').value.trim();
    var suffix=(document.getElementById('reg-suffix')||{value:''}).value.trim();
    var age=document.getElementById('reg-age').value.trim();
    var birth=document.getElementById('reg-birth').value.trim();
    var contact=document.getElementById('reg-contact').value.trim();
    var address=document.getElementById('reg-address').value.trim();
    var photoFile=(document.getElementById('reg-photo')||{}).files ? document.getElementById('reg-photo').files[0] : null;
    var idFile=(document.getElementById('reg-validid')||{}).files ? document.getElementById('reg-validid').files[0] : null;
    var responderType=(document.getElementById('reg-responder-type')||{value:''}).value;
    var role=(document.getElementById('reg-role')||{value:'barangay_staff'}).value;

    if (!u || !email || !pass || !pass2 || !first || !last || !age || !birth || !contact || !address){ showErr('Please fill all required fields.'); return; }
    if (email.indexOf('@')===-1){ showErr('Please enter a valid email address.'); return; }
    if ((contact||'').replace(/\D/g,'').length!==13){ showErr('Contact number must be exactly 13 digits.'); return; }
    if (pass!==pass2){ showErr('Passwords do not match.'); return; }

    // Optional file checks (<= 5MB, image only)
    function invalidFile(f){ return !f ? false : (!/^image\//.test(f.type) || f.size>5*1024*1024); }
    if (invalidFile(photoFile)){ showErr('Photo must be an image up to 5MB.'); return; }
    if (invalidFile(idFile)){ showErr('Valid ID must be an image up to 5MB.'); return; }

    var photo64=photoFile ? await toBase64(photoFile) : '';
    var id64=idFile ? await toBase64(idFile) : '';

    var accounts=[]; try { accounts=JSON.parse(localStorage.getItem('iSagip_accounts')||'[]'); } catch(_) { accounts=[]; }
    if (accounts.some(function(a){ return (a.username||'').toLowerCase()===u.toLowerCase(); })){ showErr('Username already exists.'); return; }

    var newAcc={ username:u, email:email, password:pass, role: 'barangay_staff',
      profile:{ first:first, middle:middle, last:last, suffix:suffix, age:age, birth:birth, contact:contact, address:address, responderType: role==='responder'?responderType:'', photo:photo64, validId:id64 } };
    try { accounts.push(newAcc); localStorage.setItem('iSagip_accounts', JSON.stringify(accounts)); } catch(_){}

    // Keep a staff directory for quick lookup
    var staff=[]; try { staff=JSON.parse(localStorage.getItem('iSagip_staff')||'[]'); } catch(_) { staff=[]; }
    staff.push({ username:u, role:newAcc.role, first:first, last:last, suffix:suffix, email:email, contact:contact, responderType:newAcc.profile.responderType, photo:photo64, validId:id64 });
    try { localStorage.setItem('iSagip_staff', JSON.stringify(staff)); } catch(_){}

    hideErr();
    alert('Registration saved locally.');
    try { form.reset(); } catch(_){}
  });
})();


