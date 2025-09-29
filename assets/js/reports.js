// Received Reports: table actions + CSV + history modal
(function(){
  var table=document.getElementById('reports-rows');
  if (!table) return;

  var reports=[
    { id:'SIM-2024-001', type:'Medical', description:'Simulated emergency from mobile app', status:'Pending', street:'-', landmark:'-', photo:null, timestamp:'2025-09-10 09:15:28 PM', responseTime:'N/A', reportedBy:'Simulated User', closedBy:'', updatedBy:'System', updatedAt:'2025-09-10 09:15:28 PM', notes:'Auto-generated from mobile app simulation.', location:{ lat:14.7338466, lng:121.01382136 }, history:[{ ts:'2025-09-10 09:15:28 PM', user:'Simulated User', action:'Created', details:'Simulated emergency report received.' }] },
    { id:'REP-2024-002', type:'Fire', description:'Kitchen fire, smoke visible', status:'Relayed', street:'Block 3, Lot 5', landmark:'Beside Barangay Hall', photo:'', timestamp:'2024-03-20 10:15 AM', responseTime:'20 minutes', reportedBy:'Alice', closedBy:'Captain', updatedBy:'Captain', updatedAt:'2024-03-20 10:16 AM', notes:'', location:{ lat:14.748, lng:121.02 }, history:[{ ts:'2024-03-20 10:12 AM', user:'Alice', action:'Submitted', details:'Fire observed.' }] },
    { id:'REP-2024-003', type:'Police', description:'Suspicious activity reported', status:'Pending', street:'Block 2, Lot 1', landmark:'Near parking Lot', photo:'', timestamp:'2024-03-20 09:45 AM', responseTime:'N/A', reportedBy:'Bob', closedBy:'Barangay Secretary', updatedBy:'Barangay Secretary', updatedAt:'2024-03-20 09:50 AM', notes:'', location:{ lat:14.745, lng:121.01 }, history:[{ ts:'2024-03-20 09:45 AM', user:'Bob', action:'Submitted', details:'Suspicious activity.' }] },
    { id:'REP-2024-004', type:'Medical', description:'Child with high fever', status:'Pending', street:'Block 4, Lot 7', landmark:'Green Gate 2 floors house', photo:'', timestamp:'2024-03-21 08:10 AM', responseTime:'N/A', reportedBy:'Carol', closedBy:'Responder', updatedBy:'Responder', updatedAt:'2024-03-21 08:20 AM', notes:'', location:{ lat:14.753, lng:121.013 }, history:[{ ts:'2024-03-21 08:10 AM', user:'Carol', action:'Submitted', details:'High fever child.' }] }
  ];

  // small status to colored badge
  function statusBadge(s){ var map={ Pending:'badge-orange', Relayed:'badge-orange', Ongoing:'badge-blue', Responded:'badge-green', Resolved:'badge-green' }; return '<span class="badge '+(map[s]||'badge-blue')+'">'+s+'</span>'; }

  // responders: load from storage or provide simple defaults
  function getResponders(){
    try {
      var staff=JSON.parse(localStorage.getItem('iSagip_staff')||'null');
      if (Array.isArray(staff) && staff.length){ return staff; }
    } catch(err){}
    try {
      var resp=JSON.parse(localStorage.getItem('iSagip_responders')||'null');
      if (Array.isArray(resp) && resp.length){ return resp; }
    } catch(err){}
    return [ { id:1, name:'Responder 1' }, { id:2, name:'Responder 2' }, { id:3, name:'Responder 3' } ];
  }

  function responderNameOf(item){ return (item && (item.name||item.fullName||item.username||('Responder '+(item.id||''))))||''; }

  function loadAssignments(){ try { return JSON.parse(localStorage.getItem('iSagip_report_assignments')||'{}'); } catch(e){ return {}; } }
  function saveAssignments(a){ try { localStorage.setItem('iSagip_report_assignments', JSON.stringify(a||{})); } catch(e){} }

  function responderOptionsHTML(selected){
    var list=getResponders();
    var html='<option value="">Choose Responder</option>';
    for (var i=0;i<list.length;i++){
      var n=responderNameOf(list[i]);
      var sel=(selected&&selected===n)?' selected':'';
      html+='<option'+sel+'>'+n+'</option>';
    }
    return html;
  }

  function actionCell(id, status){
    var assignments=loadAssignments();
    var selectedResponder=(assignments[id]&&assignments[id].responderName)||'';
    var selectedSeverity=(assignments[id]&&assignments[id].severity)||'';
    return '<div class="actions">'+
      '<select class="input responder-select" data-id="'+id+'">'+responderOptionsHTML(selectedResponder)+'</select>'+
      '<select class="input ambulance-select" data-id="'+id+'"><option value="">Choose Ambulance</option><option>Ambulance 1</option><option>Ambulance 2</option><option>Ambulance 3</option></select>'+
      '<select class="input severity-select" data-id="'+id+'">'+
        '<option value="">Select Severity</option>'+
        '<option'+(selectedSeverity==='Low'?' selected':'')+'>Low</option>'+
        '<option'+(selectedSeverity==='Medium'?' selected':'')+'>Medium</option>'+
        '<option'+(selectedSeverity==='High'?' selected':'')+'>High</option>'+
        '<option'+(selectedSeverity==='Critical'?' selected':'')+'>Critical</option>'+
      '</select>'+
      '<button class="btn btn-outline respond-btn" data-id="'+id+'">'+(status==='Ongoing'?'RESPONDED':'ONGOING')+'</button>'+
      '<button class="btn btn-outline view-btn" data-id="'+id+'">VIEW</button>'+
      '<a class="muted history-link history" href="#" data-id="'+id+'">VIEW HISTORY</a>'+
    '</div>';
  }

  window.renderReportsTable = function(){
    table.innerHTML = reports.map(function(r){
      return '<div class="t-row" data-id="'+r.id+'">'+
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
      '</div>';
    }).join('');
  };

  renderReportsTable();

  table.addEventListener('click', function(e){
    var btn=e.target.closest('.respond-btn'); if(btn){ var id=btn.getAttribute('data-id'); var r=reports.find(function(x){return x.id===id;}); if(!r) return; r.status=(r.status==='Ongoing')?'Responded':'Ongoing'; r.updatedBy='Current User'; r.updatedAt=new Date().toLocaleString(); renderReportsTable(); return; }
    var view=e.target.closest('.view-btn'); if(view){
      var idv=view.getAttribute('data-id'); var rv=reports.find(function(x){return x.id===idv;}); if(!rv) return;
      var html='<div style="display:grid; grid-template-columns:160px 1fr; gap:16px; align-items:start;">'+
        '<div class="photo" style="width:160px;height:120px;">'+(rv.photo?'<img src="'+rv.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"/>':'<div style="display:grid;place-items:center;height:100%;color:#94a3b8;">No Photo</div>')+'</div>'+
        '<div>'+
          '<div><strong>Report ID:</strong> '+rv.id+'</div>'+
          '<div><strong>Type:</strong> '+rv.type+'</div>'+
          '<div><strong>Description:</strong> '+rv.description+'</div>'+
          '<div><strong>Status:</strong> '+rv.status+'</div>'+
          '<div><strong>Street:</strong> '+rv.street+'</div>'+
          '<div><strong>Landmark:</strong> '+rv.landmark+'</div>'+
          '<div><strong>Location:</strong> Lat '+(rv.location?rv.location.lat:'-')+', Lng '+(rv.location?rv.location.lng:'-')+'</div>'+
          '<div><strong>Timestamp:</strong> '+rv.timestamp+'</div>'+
          '<div><strong>Response Time:</strong> '+rv.responseTime+'</div>'+
          '<div><strong>Reported By:</strong> '+rv.reportedBy+'</div>'+
          '<div><strong>Closed By:</strong> '+rv.closedBy+'</div>'+
          '<div><strong>Last Updated By:</strong> '+rv.updatedBy+'</div>'+
          '<div><strong>Last Updated At:</strong> '+rv.updatedAt+'</div>'+
          '<div><strong>Notes:</strong> '+(rv.notes||'')+'</div>'+
        '</div>'+
      '</div>';
      var detailsModal=document.getElementById('modal-details'); var detailsContent=document.getElementById('details-content'); if(detailsContent){ detailsContent.innerHTML=html; } if(detailsModal){ detailsModal.hidden=false; }
      return;
    }
    var closeBtn=e.target.closest('[data-close]'); if(closeBtn){ var m=closeBtn.closest('.modal'); if(m) m.hidden=true; return; }
  });

  table.addEventListener('change', function(e){
    var rs=e.target.closest('.responder-select');
    if (rs){
      var rid=rs.getAttribute('data-id'); var rr=reports.find(function(x){return x.id===rid;}); if(!rr) return; var name=rs.value || rs.options[rs.selectedIndex].text;
      var assigns=loadAssignments(); if(!assigns[rid]) assigns[rid]={}; assigns[rid].responderName=name; saveAssignments(assigns);
      rr.updatedBy=name; rr.updatedAt=new Date().toLocaleString();
      renderReportsTable();
      return;
    }
    var sev=e.target.closest('.severity-select');
    if (sev){
      var sid=sev.getAttribute('data-id'); var sr=reports.find(function(x){return x.id===sid;}); if(!sr) return; var sevVal=sev.value || sev.options[sev.selectedIndex].text;
      var assignsS=loadAssignments(); if(!assignsS[sid]) assignsS[sid]={}; assignsS[sid].severity=sevVal; saveAssignments(assignsS);
      sr.updatedBy='Severity: '+sevVal; sr.updatedAt=new Date().toLocaleString();
      return;
    }
    var sel=e.target.closest('.ambulance-select'); if(!sel) return; if(!sel.value) return; var id=sel.getAttribute('data-id'); var r=reports.find(function(x){return x.id===id;}); if(!r) return; var ambName=sel.value || sel.options[sel.selectedIndex].text;
    try {
      var store=JSON.parse(localStorage.getItem('iSagip_ambulances')) || [ { id:1, name:'Ambulance 1', status:'AVAILABLE', location:'' }, { id:2, name:'Ambulance 2', status:'AVAILABLE', location:'' }, { id:3, name:'Ambulance 3', status:'AVAILABLE', location:'' } ];
      var idx=store.findIndex(function(a){ return (a.name||('Ambulance '+a.id))===ambName; });
      if (idx!==-1){ store[idx].status='IN-USE'; store[idx].location=r.street; store[idx].assignmentId=r.id; localStorage.setItem('iSagip_ambulances', JSON.stringify(store)); }
    } catch(err){}
  });

  var historyModal=document.getElementById('modal-history');
  var historyRows=document.getElementById('history-rows');
  document.addEventListener('click', function(e){
    if (e.target.classList && e.target.classList.contains('history')){
      e.preventDefault(); var id=e.target.getAttribute('data-id'); var r=reports.find(function(x){return x.id===id;}); if(!r) return; if(historyRows){ historyRows.innerHTML=(r.history||[]).map(function(h){ return '<div class="t-row"><div>'+h.ts+'</div><div>'+h.user+'</div><div>'+h.action+'</div><div>'+h.details+'</div></div>'; }).join(''); }
      if(historyModal) historyModal.hidden=false;
    }
  });

  var exportReportsBtn=document.getElementById('reports-export-csv');
  if (exportReportsBtn){
    exportReportsBtn.addEventListener('click', function(){
      var headers=['Description','Status','Street','Landmark','Photo','Actions','Timestamp','Response Time','Reported By','Closed By','Last Updated By','Last Updated At','Notes'];
      var body=reports.map(function(r){ var row=[r.description,r.status,r.street,r.landmark,r.photo?'Yes':'No','Ambulance/Responded/View/View History',r.timestamp,r.responseTime,r.reportedBy,r.closedBy,r.updatedBy,r.updatedAt,r.notes]; return row.map(function(v){ var s=String(v||''); if (s.search(/[",\n]/)>=0) s='"'+s.replace(/"/g,'""')+'"'; return s; }).join(','); }).join('\n');
      var csv=headers.join(',')+'\n'+body; var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download='received-reports.csv'; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(url); a.remove();},0);
    });
  }
})();


