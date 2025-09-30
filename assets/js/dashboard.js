(function(){
  var reported = document.getElementById('reported-at');
  if (reported){
    var now=new Date();
    var opts={ month:'numeric', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' };
    reported.textContent = now.toLocaleString(undefined, opts);
  }

  var mapEl=document.getElementById('map');
  if (mapEl){
    window.initISagipMap=function(){
      var defaultCenter={ lat:14.7332558, lng:121.0158851 };
      var map=new google.maps.Map(mapEl,{ center:defaultCenter, zoom:13 });
      var infoWindow=new google.maps.InfoWindow();
      var selectedMarker=null;
      new google.maps.Marker({ position:defaultCenter, map:map, title:'Barangay 167 Hall', icon:{ url:'http://maps.google.com/mapfiles/ms/icons/blue-dot.png', scaledSize:new google.maps.Size(40,40) } });
      var emergencies=[
        { id:'E1', location:{ lat:14.753, lng:121.013 }, type:'Medical', description:'Chest pain', timestamp:new Date().toLocaleString() },
        { id:'E2', location:{ lat:14.748, lng:121.02 }, type:'Fire', description:'Kitchen fire', timestamp:new Date().toLocaleString() },
        { id:'E3', location:{ lat:14.745, lng:121.01 }, type:'Police', description:'Disturbance', timestamp:new Date().toLocaleString() }
      ];
      emergencies.forEach(function(em){
        var marker=new google.maps.Marker({ position:em.location, map:map, title:em.type+': '+em.description });
        marker.addListener('click', function(){
          if (selectedMarker===marker){ infoWindow.close(); selectedMarker=null; return; }
          selectedMarker=marker;
          infoWindow.setContent('<div><strong>'+em.type+' Emergency</strong><br/>'+'<span>'+em.description+'</span><br/>'+'<span style="font-size:12px;color:#666">Time: '+em.timestamp+'</span></div>');
          infoWindow.open(map, marker);
        });
      });
      map.addListener('click', function(){ infoWindow.close(); selectedMarker=null; });
    };
  }

  var yearSel=document.getElementById('filter-year');
  if (yearSel){
    var currentYear=new Date().getFullYear();
    for (var y=currentYear; y>=currentYear-5; y--){
      var opt=document.createElement('option'); opt.value=String(y); opt.textContent=String(y); yearSel.appendChild(opt);
    }
  }

  var allReports=[
    { id:'REP-2024-002', type:'Fire', description:'Kitchen fire, smoke visible', status:'Relayed', street:'Block 3, Lot 5', landmark:'Beside Barangay Hall', location:'Block 3, Lot 5', reportedBy:'Alice', timestamp:'2024-03-20 10:15 AM' },
    { id:'REP-2024-003', type:'Police', description:'Suspicious activity reported', status:'Pending', street:'Block 2, Lot 1', landmark:'Near parking Lot', location:'Block 2, Lot 1', reportedBy:'Bob', timestamp:'2024-03-20 09:45 AM' },
    { id:'REP-2024-004', type:'Medical', description:'Child with high fever', status:'Pending', street:'Block 4, Lot 7', landmark:'Green Gate 2 floors house', location:'Block 4, Lot 7', reportedBy:'Carol', timestamp:'2024-03-21 08:10 AM' },
    { id:'REP-2025-001', type:'Medical', description:'Chest pain', status:'Ongoing', street:'Block 1, Lot 2', landmark:'Near alley', location:'Block 1, Lot 2', reportedBy:'Dan', timestamp:'2025-01-05 08:30 PM' }
  ];

  function parseTs(ts){ var d=new Date(ts); if (isNaN(d.getTime())) return new Date(Date.parse(ts)); return d; }
  function filterReports(period, monthIdx, year){
    return allReports.filter(function(r){
      var d=parseTs(r.timestamp);
      if (period==='year') return d.getFullYear()===year;
      if (period==='month') return d.getFullYear()===year && d.getMonth()===monthIdx;
      if (period==='week') return d.getFullYear()===year && d.getMonth()===monthIdx && Math.abs(d.getDate()-15)<=7;
      return true;
    });
  }
  function toCsv(rows){
    var headers=['Report ID','Type','Description','Status','Street','Landmark','Location','Reported By','Timestamp'];
    var body=rows.map(function(r){ return [r.id,r.type,r.description,r.status,r.street,r.landmark,r.location,r.reportedBy,r.timestamp].map(function(v){ var s=String(v==null?'':v); if (s.search(/[",\n]/)>=0) s='"'+s.replace(/"/g,'""')+'"'; return s; }).join(','); });
    return [headers.join(','), body.join('\n')].join('\n');
  }
  function download(filename, text){ var blob=new Blob([text],{type:'text/csv;charset=utf-8;'}); var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); },0); }

  var exportBtn=document.getElementById('export-csv');
  if (exportBtn){
    exportBtn.addEventListener('click', function(){
      var periodSel=document.getElementById('filter-period');
      var monthSel=document.getElementById('filter-month');
      var yearSel2=document.getElementById('filter-year');
      var period=periodSel?periodSel.value:'month';
      var monthIdx=monthSel?parseInt(monthSel.value,10):(new Date()).getMonth();
      var year=yearSel2?parseInt(yearSel2.value,10):(new Date()).getFullYear();
      var rows=filterReports(period, monthIdx, year);
      var csv=toCsv(rows);
      var label=period==='year'?year:(period==='month'?(year+'-'+String(monthIdx+1).padStart(2,'0')):(year+'-Wk'));
      download('iSagip-reports-'+label+'.csv', csv);
    });
  }
})();


