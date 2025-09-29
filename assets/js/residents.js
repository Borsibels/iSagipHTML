// Residents: search/filter + edit/delete/reset + approvals
(function(){
  var rows=document.getElementById('res-rows');
  if (!rows) return;

  var approvalsEl=document.getElementById('res-approvals');
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

  document.addEventListener('click', function(e){ if (e.target.matches('[data-close]')){ editModal && (editModal.hidden=true); resetModal && (resetModal.hidden=true); } if (e.target.classList.contains('modal')){ e.target.hidden=true; } });
})();


