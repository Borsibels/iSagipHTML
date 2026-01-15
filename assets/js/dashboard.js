/**
 * Dashboard Module
 * Handles dashboard reports summary, realtime updates, statistics, and notifications
 */

(function() {
  'use strict';

  // ========================================
  // DASHBOARD - REPORTS SUMMARY (Realtime)
  // ========================================
  (function initializeDashboardFromReports(){
    var totalEl = document.getElementById('stat-total-value');
    var badgesEl = document.getElementById('emergency-types-badges');
    var avgEl = document.getElementById('avg-response');
    var exportBtn = document.getElementById('export-csv');
    var testNotifBtn = document.getElementById('test-notification-btn');
    var notifContainer = document.getElementById('notification-container');
    var filterPeriodEl = document.getElementById('filter-period');
    var filterMonthEl = document.getElementById('filter-month');
    var filterYearEl = document.getElementById('filter-year');
    var ongoing = {
      wrap: document.getElementById('ongoing-emergency'),
      type: document.getElementById('ongoing-type'),
      location: document.getElementById('ongoing-location'),
      description: document.getElementById('ongoing-description'),
      status: document.getElementById('ongoing-status'),
      reportedAt: document.getElementById('reported-at'),
      eta: document.getElementById('ongoing-eta')
    };
    if (!totalEl && !badgesEl && !avgEl && !ongoing.wrap) return;

    var REALTIME_DB_URL = 'https://isagip-752d1-default-rtdb.asia-southeast1.firebasedatabase.app';
    var databaseModule = null;
    var realtimeDb = null;
    var reports = [];
    var rawReports = {};
    var yearsAvailable = [];
    var previousReportIds = new Set(); // Track previous reports to detect new ones

    function showToast(message){
      if (!notifContainer) { alert(message); return; }
      var el = document.createElement('div');
      el.className = 'notification';
      el.textContent = message;
      notifContainer.appendChild(el);
      setTimeout(function(){ el.classList.add('show'); }, 10);
      setTimeout(function(){ el.classList.remove('show'); }, 2500);
      setTimeout(function(){ el.remove(); }, 3000);
    }

    /**
     * Play notification sound when a new report is received
     * Uses Web Audio API to generate an emergency notification tone
     */
    function playNotificationSound() {
      try {
        // Create audio context
        var audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create oscillator for notification sound
        var oscillator = audioContext.createOscillator();
        var gainNode = audioContext.createGain();
        
        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Configure sound (emergency notification tone - alert pattern)
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.3);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.4);
        
        // Configure volume (fade in/out for smoother sound)
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.39);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        
        // Play sound
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        // Show sound indicator if available
        var soundIndicator = document.getElementById('sound-indicator');
        if (soundIndicator) {
          soundIndicator.classList.add('show');
          setTimeout(function() {
            soundIndicator.classList.remove('show');
          }, 2000);
        }
      } catch (error) {
        console.log('Could not play notification sound:', error);
      }
    }

    /**
     * Check for new reports and trigger notifications
     * @param {Array} currentReports - Current list of reports
     */
    function checkForNewReports(currentReports) {
      if (!currentReports || currentReports.length === 0) return;
      
      var currentReportIds = new Set();
      var newReports = [];
      
      // Collect current report IDs and find new ones
      currentReports.forEach(function(report) {
        if (report.id) {
          currentReportIds.add(report.id);
          // If this report wasn't in previous set, it's new
          if (!previousReportIds.has(report.id)) {
            newReports.push(report);
          }
        }
      });
      
      // If there are new reports, play sound and show notification
      if (newReports.length > 0) {
        // Play notification sound
        playNotificationSound();
        
        // Show visual notification for the first new report
        if (newReports.length > 0 && notifContainer) {
          var newReport = newReports[0]; // Show notification for the most recent
          var reportType = newReport.type || 'Emergency';
          var reportDesc = newReport.description || newReport.landmark || 'No description';
          var reportLocation = newReport.street || 'Location not specified';
          
          var notification = document.createElement('div');
          notification.className = 'notification emergency';
          notification.innerHTML = 
            '<div class="notification-header">' +
              '<div class="notification-title">🚨 New Emergency Report</div>' +
              '<button class="notification-close">&times;</button>' +
            '</div>' +
            '<div class="notification-body">' +
              '<strong>Type:</strong> ' + reportType + '<br>' +
              '<strong>Description:</strong> ' + reportDesc.substring(0, 50) + (reportDesc.length > 50 ? '...' : '') + '<br>' +
              '<strong>Location:</strong> ' + reportLocation.substring(0, 40) + (reportLocation.length > 40 ? '...' : '') +
            '</div>' +
            '<div class="notification-time">' + new Date().toLocaleTimeString() + '</div>';
          
          notifContainer.appendChild(notification);
          
          // Animate notification in
          setTimeout(function() {
            notification.classList.add('show');
          }, 10);
          
          // Auto-remove after 5 seconds
          setTimeout(function() {
            notification.classList.remove('show');
            setTimeout(function() {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 300);
          }, 5000);
          
          // Handle close button
          notification.querySelector('.notification-close').addEventListener('click', function() {
            notification.classList.remove('show');
            setTimeout(function() {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 300);
          });
        }
      }
      
      // Update previous report IDs for next check
      previousReportIds = currentReportIds;
    }

    function normalizeType(value){
      var v = (value || '').toString().toLowerCase();
      if (v.includes('med')) return 'Medical';
      if (v.includes('fire')) return 'Fire';
      if (v.includes('police') || v.includes('crime')) return 'Police';
      if (v.includes('other')) return 'Others';
      return 'Others';
    }

    function parseTimestamp(ts){
      var n = Number(ts);
      if (!isNaN(n)) return n;
      var d = new Date(ts);
      return isNaN(d.getTime()) ? Date.now() : d.getTime();
    }

    function computeResponseMinutes(raw){
      if (typeof raw?.responseTimeMinutes === 'number') return raw.responseTimeMinutes;
      var start = parseTimestamp(raw?.timestamp);
      var end = raw?.closedAt ? parseTimestamp(raw.closedAt) : null;
      if (!end) return null;
      return Math.max(0, Math.round((end - start) / 60000));
    }

    function getYear(ts){ var d = new Date(ts); return d.getFullYear(); }
    function getMonth(ts){ var d = new Date(ts); return d.getMonth(); } // 0-11

    function ensureYearOptions(){
      var set = {};
      reports.forEach(function(r){ set[getYear(r.timestampMs)] = true; });
      yearsAvailable = Object.keys(set).map(function(k){ return parseInt(k,10); }).sort(function(a,b){ return a-b; });
      if (!filterYearEl) return;
      var needRebuild = true;
      if (filterYearEl.options && filterYearEl.options.length === yearsAvailable.length){
        needRebuild = yearsAvailable.some(function(y, idx){ return parseInt(filterYearEl.options[idx].value,10) !== y; });
      }
      if (needRebuild){
        filterYearEl.innerHTML = '';
        yearsAvailable.forEach(function(y){
          var opt = document.createElement('option');
          opt.value = String(y);
          opt.textContent = String(y);
          filterYearEl.appendChild(opt);
        });
      }
      var current = parseInt(filterYearEl.value || '0',10);
      if (!current || yearsAvailable.indexOf(current) === -1){
        var prefer = yearsAvailable.indexOf(new Date().getFullYear()) !== -1 ? new Date().getFullYear() : (yearsAvailable[yearsAvailable.length-1] || new Date().getFullYear());
        filterYearEl.value = String(prefer);
      }
    }

    function getFilteredReports(){
      var list = reports.slice();
      if (!list.length) return list;
      var period = (filterPeriodEl && filterPeriodEl.value) ? filterPeriodEl.value : 'month';
      if (period === 'all') return list;
      if (period === 'year'){
        var y = filterYearEl ? parseInt(filterYearEl.value || '0',10) : 0;
        if (y) list = list.filter(function(r){ return getYear(r.timestampMs) === y; });
        return list;
      }
      if (period === 'week'){
        var sevenDaysAgo = Date.now() - 7*24*60*60*1000;
        return list.filter(function(r){ return r.timestampMs >= sevenDaysAgo; });
      }
      var yearSel = filterYearEl ? parseInt(filterYearEl.value || '0',10) : 0;
      var monthSel = filterMonthEl ? parseInt(filterMonthEl.value || '-1',10) : -1;
      if (!yearSel){
        yearSel = yearsAvailable.length ? yearsAvailable[yearsAvailable.length-1] : new Date().getFullYear();
        if (filterYearEl) filterYearEl.value = String(yearSel);
      }
      if (monthSel < 0){
        var latestInYear = list
          .filter(function(r){ return getYear(r.timestampMs) === yearSel; })
          .sort(function(a,b){ return b.timestampMs - a.timestampMs; })[0];
        monthSel = latestInYear ? getMonth(latestInYear.timestampMs) : new Date().getMonth();
        if (filterMonthEl) filterMonthEl.value = String(monthSel);
      }
      return list.filter(function(r){ return getYear(r.timestampMs) === yearSel && getMonth(r.timestampMs) === monthSel; });
    }

    function formatStatusText(status){
      if (!status) return 'Received';
      return status.toString().replace(/[_-]/g, ' ').replace(/\b\w/g, function(ch){ return ch.toUpperCase(); });
    }

    function mapRawReport(id, raw){
      var ts = parseTimestamp(raw?.timestamp);
      return {
        id: id,
        type: normalizeType(raw?.emergencyType || raw?.type),
        description: raw?.description || raw?.desc || '',
        status: (raw?.status || 'Received').toString(),
        street: raw?.street || raw?.location || '',
        landmark: raw?.landmark || '',
        photo: raw?.photoUri || raw?.photoUrl || raw?.photo || '',
        reportedBy: raw?.userName || raw?.reportedByName || raw?.by || 'Unknown',
        closedBy: raw?.closedBy || raw?.closedByName || '',
        lastUpdatedBy: raw?.lastUpdatedBy || raw?.lastUpdatedByName || '',
        lastUpdatedAtLabel: raw?.lastUpdatedAt ? new Date(Number(raw.lastUpdatedAt)).toLocaleString() : '—',
        notes: raw?.residentNotes || raw?.notes || '',
        latitude: (function(){ var v = parseFloat(raw?.latitude ?? raw?.lat); return isFinite(v) ? v : null; })(),
        longitude: (function(){ var v = parseFloat(raw?.longitude ?? raw?.lng); return isFinite(v) ? v : null; })(),
        timestampMs: ts,
        timestampLabel: new Date(ts).toLocaleString(),
        responseMinutes: computeResponseMinutes(raw),
        responseTimeLabel: (function(){
          var m = computeResponseMinutes(raw);
          return typeof m === 'number' ? (m + ' min') : '—';
        })(),
        actionsLabel: 'View/Manage'
      };
    }

    function updateStats(){
      var source = getFilteredReports();
      if (!source.length) {
        if (totalEl) totalEl.textContent = '0';
        if (avgEl) avgEl.textContent = '0 min';
        if (badgesEl) {
          badgesEl.innerHTML = [
            '<span class="badge badge-blue">Medical: 0</span>',
            '<span class="badge badge-orange">Fire: 0</span>',
            '<span class="badge badge-green">Police: 0</span>',
            '<span class="badge badge-gray">Others: 0</span>'
          ].join(' ');
        }
        if (ongoing.wrap) {
          ongoing.type.textContent = '-';
          ongoing.location.textContent = '-';
          ongoing.description.textContent = '-';
          ongoing.status.textContent = '-';
          ongoing.reportedAt.textContent = '-';
          ongoing.eta.textContent = '-';
        }
        return;
      }

      if (totalEl) totalEl.textContent = String(source.length);

      var counts = { Medical:0, Fire:0, Police:0, Others:0 };
      source.forEach(function(r){
        if (counts[r.type] !== undefined) counts[r.type]++;
        else counts.Others++;
      });
      if (badgesEl) {
        badgesEl.innerHTML = [
          '<span class="badge badge-blue">Medical: '+counts.Medical+'</span>',
          '<span class="badge badge-orange">Fire: '+counts.Fire+'</span>',
          '<span class="badge badge-green">Police: '+counts.Police+'</span>',
          '<span class="badge badge-gray">Others: '+counts.Others+'</span>'
        ].join(' ');
      }

      var minutes = source.map(function(r){ return r.responseMinutes; }).filter(function(n){ return typeof n === 'number'; });
      var avg = minutes.length ? Math.round(minutes.reduce(function(a,b){return a+b;},0) / minutes.length) : 0;
      if (avgEl) avgEl.textContent = (minutes.length ? (avg+' min') : '0 min');

      if (ongoing.wrap) {
        var active = source
          .filter(function(r){ return (r.status || '').toString().toLowerCase() !== 'resolved'; })
          .sort(function(a,b){ return b.timestampMs - a.timestampMs; })[0];
        if (active) {
          ongoing.type.textContent = active.type || '-';
          ongoing.location.textContent = active.street || '-';
          ongoing.description.textContent = active.description || '-';
          ongoing.status.textContent = formatStatusText(active.status || '');
          ongoing.reportedAt.textContent = active.timestampLabel || '-';
          ongoing.eta.textContent = '-';
        } else {
          ongoing.type.textContent = '-';
          ongoing.location.textContent = '-';
          ongoing.description.textContent = '-';
          ongoing.status.textContent = '-';
          ongoing.reportedAt.textContent = '-';
          ongoing.eta.textContent = '-';
        }
      }
    }

    function exportReportsCsv(){
      var source = getFilteredReports();
      if (!source.length) { showToast('No data to export'); return; }
      var headers = [
        'ID',
        'Emergency Type',
        'Description',
        'Status',
        'Street',
        'Landmark',
        'Photo',
        'Actions',
        'Timestamp',
        'Response Time',
        'Reported By',
        'Closed By',
        'Last Updated By',
        'Last Updated At',
        'Notes'
      ];
      var rows = source.map(function(r){
        return [
          r.id,
          r.type,
          (r.description || '').replace(/\n/g,' ').replace(/"/g,'""'),
          formatStatusText(r.status),
          r.street,
          r.landmark,
          r.photo || '',
          r.actionsLabel || '',
          r.timestampLabel,
          r.responseTimeLabel,
          r.reportedBy || '',
          r.closedBy || '',
          r.lastUpdatedBy || '',
          r.lastUpdatedAtLabel || '',
          (r.notes || '').replace(/\n/g,' ').replace(/"/g,'""')
        ];
      });
      var csv = [headers].concat(rows).map(function(arr){
        return arr.map(function(cell){
          var val = cell === null || cell === undefined ? '' : String(cell);
          return /[",\n]/.test(val) ? '"' + val.replace(/"/g,'""') + '"' : val;
        }).join(',');
      }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'reports_dashboard_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    async function init(){
      try{
        if (!window.iSagipApp) {
          await new Promise(function(resolve){
            var attempts = 0, max = 50, t = setInterval(function(){
              if (window.iSagipApp) { clearInterval(t); resolve(); }
              else if (++attempts > max) { clearInterval(t); resolve(); }
            }, 200);
            window.addEventListener('firebaseReady', function(){ clearInterval(t); resolve(); }, { once: true });
          });
        }
        databaseModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
        realtimeDb = databaseModule.getDatabase(window.iSagipApp, REALTIME_DB_URL);
        var ref = databaseModule.ref;
        var onValue = databaseModule.onValue;
        var reportsRef = ref(realtimeDb, 'reports');
        onValue(
          reportsRef,
          function(snapshot){
            var value = snapshot.val() || {};
            rawReports = value;
            var previousReportsCount = reports.length;
            reports = Object.keys(value).map(function(key){ return mapRawReport(key, value[key] || {}); });
            
            // Check for new reports and play sound notification
            if (reports.length > previousReportsCount || previousReportsCount === 0) {
              // Only check for new reports if we had previous reports (skip initial load)
              if (previousReportsCount > 0) {
                checkForNewReports(reports);
              } else {
                // Initialize previous report IDs on first load
                reports.forEach(function(report) {
                  if (report.id) {
                    previousReportIds.add(report.id);
                  }
                });
              }
            }
            
            if (Array.isArray(reports)) {
              if (window.updateISagipMapMarkers) window.updateISagipMapMarkers(reports);
              else window.iSagipPendingMarkersData = reports;
            }
            ensureYearOptions();
            updateStats();
          },
          function(error){
            console.error('Dashboard reports error:', error);
          }
        );
      } catch(err){
        console.error('Failed to initialize dashboard reports feed:', err);
      }
    }

    if (exportBtn) exportBtn.addEventListener('click', exportReportsCsv);
    if (testNotifBtn) testNotifBtn.addEventListener('click', function(){ showToast('Test notification sent'); });
    if (filterPeriodEl) filterPeriodEl.addEventListener('change', function(){ updateStats(); });
    if (filterMonthEl) filterMonthEl.addEventListener('change', function(){ updateStats(); });
    if (filterYearEl) filterYearEl.addEventListener('change', function(){ updateStats(); });
    init();
  })();
})();
