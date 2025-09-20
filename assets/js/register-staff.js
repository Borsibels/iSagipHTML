// Registration (staff/responder): show responder type only when needed
(function(){
  var roleSel=document.getElementById('reg-role');
  var typeWrap=document.getElementById('reg-responder-type-wrap');
  function toggleType(){ if (!roleSel||!typeWrap) return; typeWrap.style.display = (roleSel.value==='responder') ? '' : 'none'; }
  if (roleSel){ roleSel.addEventListener('change', toggleType); toggleType(); }
})();


