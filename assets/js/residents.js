(function(){
  var rows=document.getElementById('res-rows');
  if (!rows) return;

  var approvalsEl=document.getElementById('res-approvals');
  var appRegsEl=document.getElementById('app-registrations');
  var rejectModal=document.getElementById('appreg-reject-modal');
  var rejectReason=document.getElementById('appreg-reject-reason');
  var rejectSubmit=document.getElementById('appreg-reject-submit');
  var search=document.getElementById('res-search');
  var statusSel=document.getElementById('res-status');

  function load(key, fallback){ try { var s=localStorage.getItem(key); return s?JSON.parse(s):fallback; } catch(e){ return fallback; } }
  function save(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

  var residents=load('iSagip_residents', null) || [
    { username:'john_doe', first:'John', last:'Doe', email:'john@example.com', contact:'1234567890', status:'active', address:'123 Main St', notes:'' },
    { username:'jane_smith', first:'Jane', last:'Smith', email:'jane@example.com', contact:'2345678901', status:'active', address:'', notes:'' },
    { username:'maria_lee', first:'Maria', last:'Lee', email:'maria@example.com', contact:'3456789012', status:'active', address:'', notes:'' }
  ];
  save('iSagip_residents', residents);

  var pendingUpdates=load('iSagip_pending_updates', null) || [ { username:'john_doe', changes:{ email:'john.new@example.com', contact:'1112223333' }, requestedAt:'2025-09-10 09:15 PM' } ];
  save('iSagip_pending_updates', pendingUpdates);
  var appRegs=load('iSagip_app_registrations', null) || [];
  if (!Array.isArray(appRegs) || appRegs.length===0){
    appRegs = [
      { username:'app_jdoe', first:'John', last:'Doe', suffix:'', email:'john.doe@app.test', contact:'0912345678901', address:'Block 3, Lot 5', proofs:['https://via.placeholder.com/640x420.png?text=Proof+of+Residency'] },
      { username:'app_mlee', first:'Maria', last:'Lee', suffix:'Jr.', email:'maria.lee@app.test', contact:'0998765432100', address:'Block 1, Lot 2', proofs:['https://via.placeholder.com/640x420.png?text=Barangay+ID'] }
    ];
  }
  save('iSagip_app_registrations', appRegs);
  var appRegsFeedback=load('iSagip_app_registrations_feedback', null) || {};
  save('iSagip_app_registrations_feedback', appRegsFeedback);

  function fullName(r){ var s=(r.suffix&&(' '+r.suffix))||''; return r.first+' '+r.last+s; }

  function render(){
    var q=(search?search.value.toLowerCase():'');
    var filter=statusSel?statusSel.value:'all';
    var list=residents.filter(function(r){
      var matches=!q || r.username.toLowerCase().includes(q) || fullName(r).toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
      var statusOk=filter==='all' || (filter==='pending' ? pendingUpdates.some(function(p){return p.username===r.username;}) : r.status===filter);
      return matches && statusOk;
    });
    rows.innerHTML=list.map(function(r){
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

    approvalsEl.innerHTML=pendingUpdates.map(function(p){
      var changeList=Object.keys(p.changes).map(function(k){ return '<strong>'+k+':</strong> '+p.changes[k];}).join(', ');
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
    
    if (appRegsEl){
      if (!appRegs.length){ 
        appRegsEl.innerHTML = '<div class="t-row"><div style="grid-column:1/-1;color:var(--muted);padding:12px 16px;">No pending registrations.</div></div>';
      } else {
        appRegsEl.innerHTML=appRegs.map(function(a, idx){
        var name=(a.first||'')+' '+(a.last||'')+((a.suffix&&(' '+a.suffix))||'');
        var hasProof=a.proofPhoto||a.proofId|| (Array.isArray(a.proofs)&&a.proofs.length>0);
        var proofHtml=hasProof?'<button class="icon-btn view-proof" data-idx="'+idx+'">View</button>':'None';
        return '<div class="t-row" data-idx="'+idx+'">'+
          '<div>'+ (a.username||'') +'</div>'+
          '<div>'+ name +'</div>'+
          '<div>'+ (a.email||'') +'</div>'+
          '<div>'+ (a.contact||'') +'</div>'+
          '<div>'+ proofHtml +'</div>'+
          '<div class="res-actions">'+
            '<button class="icon-btn approve-app">Approve</button>'+
            '<button class="icon-btn delete reject-app">Reject</button>'+
          '</div>'+
        '</div>';
      }).join('');
      }
    }
  }
  render();

  if (search) search.addEventListener('input', render);
  if (statusSel) statusSel.addEventListener('change', render);

  var editModal=document.getElementById('res-edit-modal');
  var editFirst=document.getElementById('edit-first');
  var editLast=document.getElementById('edit-last');
  var editEmail=document.getElementById('edit-email');
  var editContact=document.getElementById('edit-contact');
  var editAddress=document.getElementById('edit-address');
  var editNotes=document.getElementById('edit-notes');
  var editSuffix=document.getElementById('edit-suffix');
  var editPhoto=document.getElementById('edit-photo');
  var editValidId=document.getElementById('edit-validid');
  var saveBtn=document.getElementById('res-save');
  var editingUser=null;

  rows.addEventListener('click', function(e){
    var tr=e.target.closest('.t-row'); if(!tr) return; var username=tr.getAttribute('data-u'); var r=residents.find(function(x){return x.username===username;}); if(!r) return;
    if (e.target.classList.contains('edit')){ editingUser=r; editFirst.value=r.first; editLast.value=r.last; editEmail.value=r.email; editContact.value=r.contact; editAddress.value=r.address||''; editNotes.value=r.notes||''; editSuffix && (editSuffix.value=r.suffix||''); if(editPhoto) editPhoto.value=''; if(editValidId) editValidId.value=''; editModal.hidden=false; }
    else if (e.target.classList.contains('delete')){ residents=residents.filter(function(x){return x.username!==username;}); pendingUpdates=pendingUpdates.filter(function(p){return p.username!==username;}); save('iSagip_residents', residents); save('iSagip_pending_updates', pendingUpdates); render(); }
    else if (e.target.classList.contains('reset')){ currentResetUser=r; resetModal.hidden=false; }
  });

  function toBase64(file){ return new Promise(function(res, rej){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.onerror=rej; r.readAsDataURL(file); }); }

  if (saveBtn){
    saveBtn.addEventListener('click', async function(){
      if(!editingUser) return;
      editingUser.first=editFirst.value.trim();
      editingUser.last=editLast.value.trim();
      editingUser.suffix=editSuffix?editSuffix.value.trim():editingUser.suffix;
      editingUser.email=editEmail.value.trim();
      editingUser.contact=editContact.value.trim();
      editingUser.address=editAddress.value.trim();
      editingUser.notes=editNotes.value.trim();
      if (editPhoto && editPhoto.files && editPhoto.files[0]){ try { editingUser.photo=await toBase64(editPhoto.files[0]); } catch(_){} }
      if (editValidId && editValidId.files && editValidId.files[0]){ try { editingUser.validId=await toBase64(editValidId.files[0]); } catch(_){} }
      editModal.hidden=true;
      save('iSagip_residents', residents);
      render();
    });
  }

  var resetModal=document.getElementById('res-reset-modal');
  var resetInput=document.getElementById('reset-pass');
  var resetBtn=document.getElementById('res-reset');
  var currentResetUser=null;
  if (resetBtn){ resetBtn.addEventListener('click', function(){ resetModal.hidden=true; resetInput.value=''; }); }

  approvalsEl.addEventListener('click', function(e){
    var tr=e.target.closest('.t-row'); if(!tr) return; var username=tr.getAttribute('data-u'); var idx=pendingUpdates.findIndex(function(p){return p.username===username;}); if(idx===-1) return;
    if (e.target.classList.contains('approve')){ var p=pendingUpdates[idx]; var r=residents.find(function(x){return x.username===username;}); if(r) Object.assign(r, p.changes); pendingUpdates.splice(idx,1); save('iSagip_residents', residents); save('iSagip_pending_updates', pendingUpdates); render(); }
    else if (e.target.classList.contains('reject')){ pendingUpdates.splice(idx,1); save('iSagip_pending_updates', pendingUpdates); render(); }
  });
  
  if (appRegsEl){
    var rejectIdx=null;
    appRegsEl.addEventListener('click', function(e){
      var tr=e.target.closest('.t-row'); if(!tr) return; var idx=parseInt(tr.getAttribute('data-idx'),10); if (isNaN(idx)) return;
      if (e.target.classList.contains('view-proof')){ 
        var a=appRegs[idx]; 
        var imgs=[]; 
        if (a.proofPhoto) imgs.push(a.proofPhoto); 
        if (a.proofId) imgs.push(a.proofId); 
        if (Array.isArray(a.proofs)) imgs=imgs.concat(a.proofs.filter(Boolean)); 
        if (imgs.length){ window.open(imgs[0], '_blank'); } 
        return; 
      }
      if (e.target.classList.contains('approve-app')){ 
        var a2=appRegs[idx]; 
        var newRes={ username:a2.username||'', first:a2.first||'', last:a2.last||'', suffix:a2.suffix||'', email:a2.email||'', contact:a2.contact||'', status:'active', address:a2.address||'', notes:'', photo:a2.photo||'', validId:a2.validId||'' }; 
        residents.push(newRes); 
        appRegsFeedback[a2.username||('u'+Date.now())]={ status:'approved', reviewedAt:new Date().toLocaleString(), reason:'' };
        appRegs.splice(idx,1); 
        save('iSagip_residents', residents); 
        save('iSagip_app_registrations', appRegs); 
        save('iSagip_app_registrations_feedback', appRegsFeedback);
        render(); 
        return; 
      }
      if (e.target.classList.contains('reject-app')){ 
        rejectIdx=idx; 
        if (rejectModal){ rejectModal.hidden=false; document.body.classList.add('modal-open'); if(rejectReason) rejectReason.value=''; }
        return; 
      }
    });
    if (rejectSubmit){ 
      rejectSubmit.addEventListener('click', function(){
        if (rejectIdx==null) { if(rejectModal){ rejectModal.hidden=true; document.body.classList.remove('modal-open'); } return; }
        var a3=appRegs[rejectIdx]; 
        var reason=(rejectReason && rejectReason.value.trim()) || 'Registration did not meet requirements.';
        appRegsFeedback[a3.username||('u'+Date.now())]={ status:'rejected', reviewedAt:new Date().toLocaleString(), reason:reason };
        appRegs.splice(rejectIdx,1);
        save('iSagip_app_registrations', appRegs);
        save('iSagip_app_registrations_feedback', appRegsFeedback);
        if(rejectModal){ rejectModal.hidden=true; document.body.classList.remove('modal-open'); }
        rejectIdx=null;
        render();
      }); 
    }
  }

  document.addEventListener('click', function(e){
    var dc=e.target.closest('[data-close]');
    if (dc){ var m=dc.closest('.modal'); if(m){ m.hidden=true; document.body.classList.remove('modal-open'); } return; }
    if (e.target.classList.contains('modal')){ e.target.hidden=true; document.body.classList.remove('modal-open'); }
  });
})();


