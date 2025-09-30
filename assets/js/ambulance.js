(function(){
  var grid=document.getElementById('ambulance-grid');
  if (!grid) return;

  function loadAmb(){ try { return JSON.parse(localStorage.getItem('iSagip_ambulances')); } catch(e){ return null; } }
  function saveAmb(a){ try { localStorage.setItem('iSagip_ambulances', JSON.stringify(a)); } catch(e){} }

  var ambulances = loadAmb() || [
    { id:1, name:'Ambulance 1', status:'AVAILABLE', location:'' },
    { id:2, name:'Ambulance 2', status:'IN-USE', location:'Block 1, Lot 2' },
    { id:3, name:'Ambulance 3', status:'MAINTENANCE', location:'' }
  ];
  saveAmb(ambulances);

  function badge(status){ var color = status==='AVAILABLE' ? '#16a34a' : status==='IN-USE' ? '#f59e0b' : '#ef4444'; return '<span class="amb-badge" style="color:'+color+'">'+status+'</span>'; }

  function render(){
    grid.innerHTML = ambulances.map(function(a){
      return '<div class="ambulance-card" data-id="'+a.id+'">'+
        '<div class="amb-title">'+a.name+'</div>'+
        '<div class="amb-status">Status: '+badge(a.status)+'</div>'+
        (a.location?'<div class="amb-status">Location: '+a.location+(a.assignmentId? ' <span style="color:#64748b">(Report '+a.assignmentId+')</span>':'' )+'</div>':'')+
        '<div class="amb-actions">'+
          '<button class="amb-btn set-available">MARK AVAILABLE</button>'+
          '<button class="amb-btn set-inuse">MARK IN USE</button>'+
          '<button class="amb-btn set-maint">MARK MAINTENANCE</button>'+
        '</div>'+
      '</div>';
    }).join('');
  }
  render();

  grid.addEventListener('click', function(e){
    var card=e.target.closest('.ambulance-card'); if(!card) return; var id=parseInt(card.getAttribute('data-id'),10); var amb=ambulances.find(function(x){return x.id===id;}); if(!amb) return;
    if (e.target.classList.contains('set-available')) amb.status='AVAILABLE';
    else if (e.target.classList.contains('set-inuse')) amb.status='IN-USE';
    else if (e.target.classList.contains('set-maint')) amb.status='MAINTENANCE';
    if (amb.status!=='IN-USE'){ amb.location=''; amb.assignmentId=undefined; }
    saveAmb(ambulances); render();
  });
})();


