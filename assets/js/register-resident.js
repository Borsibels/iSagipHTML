(function(){
  var form=document.getElementById('resident-register-form'); if(!form) return;

  function toBase64(file){ return new Promise(function(res, rej){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.onerror=rej; r.readAsDataURL(file); }); }
  function getErr(){ var el=document.getElementById('res-reg-error'); if(!el){ el=document.createElement('div'); el.id='res-reg-error'; el.className='error-message'; el.style.color='#ef4444'; el.style.marginTop='8px'; el.style.display='none'; form.appendChild(el);} return el; }
  function showErr(m){ var el=getErr(); el.textContent=m; el.style.display=''; }
  function hideErr(){ var el=getErr(); el.textContent=''; el.style.display='none'; }

  var emailEl=document.getElementById('res-email');
  var contactEl=document.getElementById('res-contact');
  var passEl=document.getElementById('res-password');
  var pass2El=document.getElementById('res-password2');

  if (emailEl){ emailEl.addEventListener('blur', function(){ var v=(emailEl.value||'').trim(); if (v && v.indexOf('@')===-1){ alert('Please enter a valid email address.'); } }); }
  if (contactEl){ contactEl.addEventListener('input', function(){ var d=(contactEl.value||'').replace(/\D/g,''); if(d.length>13) d=d.slice(0,13); contactEl.value=d; }); }

  function ensurePassMeter(el){ if(!el) return null; var ex=document.getElementById(el.id+'-meter'); if(ex) return ex; var wrap=document.createElement('div'); wrap.id=el.id+'-meter'; wrap.className='progress-bar'; wrap.style.marginTop='0px'; var fill=document.createElement('div'); fill.className='progress-fill'; fill.style.width='0%'; fill.style.height='6px'; fill.style.borderRadius='4px'; wrap.appendChild(fill); el.parentElement && el.parentElement.appendChild(wrap); var label=document.createElement('div'); label.id=el.id+'-meter-label'; label.style.fontSize='12px'; label.style.marginTop='0px'; el.parentElement && el.parentElement.appendChild(label); return wrap; }
  function updateStrength(el){ var v=(el.value||''); var s=0; if(v.length>=8)s+=25; if(/[A-Z]/.test(v))s+=25; if(/[0-9]/.test(v))s+=25; if(/[^A-Za-z0-9]/.test(v))s+=25; var wrap=ensurePassMeter(el); if(!wrap) return; var fill=wrap.querySelector('.progress-fill'); var label=document.getElementById(el.id+'-meter-label'); var color=s<50?'#ef4444':(s<75?'#f59e0b':'#10b981'); if(fill){ fill.style.width=s+'%'; fill.style.background=color; } if(label){ label.textContent=s<50?'Weak':(s<75?'Medium':'Strong'); label.style.color=color; } }
  if (passEl){ passEl.addEventListener('input', function(){ updateStrength(passEl); }); ensurePassMeter(passEl); }
  function ensureFieldError(afterEl, id){ var el=document.getElementById(id); if(el) return el; el=document.createElement('div'); el.id=id; el.style.color='#ef4444'; el.style.fontSize='12px'; el.style.marginTop='4px'; afterEl.parentElement && afterEl.parentElement.appendChild(el); return el; }
  if (pass2El){ pass2El.addEventListener('input', function(){ var err=ensureFieldError(pass2El,'res-pass2-err'); if (pass2El.value && passEl && pass2El.value!==passEl.value){ err.textContent='Passwords do not match.'; } else { err.textContent=''; } }); }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var u=document.getElementById('res-username').value.trim();
    var email=document.getElementById('res-email').value.trim();
    var pass=document.getElementById('res-password').value;
    var pass2=document.getElementById('res-password2').value;
    var first=document.getElementById('res-first').value.trim();
    var middle=document.getElementById('res-middle').value.trim();
    var last=document.getElementById('res-last').value.trim();
    var suffix=(document.getElementById('res-suffix')||{value:''}).value.trim();
    var gender=document.getElementById('res-gender').value;
    var birth=document.getElementById('res-birth').value.trim();
    var address=document.getElementById('res-address').value.trim();
    var contact=document.getElementById('res-contact').value.trim();
    var photoFile=(document.getElementById('res-photo')||{}).files ? document.getElementById('res-photo').files[0] : null;
    var idFile=(document.getElementById('res-validid')||{}).files ? document.getElementById('res-validid').files[0] : null;

    hideErr();
    if(!u||!email||!pass||!pass2||!first||!last||!gender||!birth||!address||!contact){ showErr('Please fill all required fields.'); return; }
    if (email.indexOf('@')===-1){ showErr('Please enter a valid email address.'); return; }
    if ((contact||'').replace(/\D/g,'').length!==13){ showErr('Contact number must be exactly 13 digits.'); return; }
    if(pass!==pass2){ showErr('Passwords do not match.'); return; }
    function invalidFile(f){ return !f ? false : (!/^image\//.test(f.type) || f.size>5*1024*1024); }
    if (invalidFile(photoFile)){ showErr('Photo must be an image up to 5MB.'); return; }
    if (invalidFile(idFile)){ showErr('Valid ID must be an image up to 5MB.'); return; }

    var photo64=photoFile?await toBase64(photoFile):'';
    var id64=idFile?await toBase64(idFile):'';

    var residents=[]; try{ residents=JSON.parse(localStorage.getItem('iSagip_residents')||'[]'); }catch(_){ residents=[]; }
    if (residents.some(function(r){ return (r.username||'').toLowerCase()===u.toLowerCase(); })){ showErr('Username already exists.'); return; }

    var newRes={ username:u, first:first, middle:middle, last:last, suffix:suffix, email:email, contact:contact, status:'active', address:address, notes:'', gender:gender, birth:birth, photo:photo64, validId:id64 };
    residents.push(newRes);
    try { localStorage.setItem('iSagip_residents', JSON.stringify(residents)); } catch(_){}
    hideErr();
    alert('Resident saved locally.');
    try { form.reset(); } catch(_){ }
  });
})();


