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
    var avgUnitSelect = document.getElementById('avg-response-unit');
    var testNotifBtn = document.getElementById('test-notification-btn');
    var notifContainer = document.getElementById('notification-container');
    var filterPeriodEl = document.getElementById('filter-period');
    var filterMonthEl = document.getElementById('filter-month');
    var filterYearEl = document.getElementById('filter-year');
    var activeReportsListEl = document.getElementById('active-reports-list');
    if (!totalEl && !badgesEl && !avgEl && !activeReportsListEl) return;

    var AVG_UNIT_STORAGE_KEY = 'iSagip_avgResponseUnit';

    function getAvgUnit() {
      var v = (localStorage.getItem(AVG_UNIT_STORAGE_KEY) || '').toLowerCase();
      return v === 'hours' ? 'hours' : 'minutes';
    }

    function formatAvgResponse(minutes, unit) {
      var safeMinutes = (typeof minutes === 'number' && isFinite(minutes) && minutes >= 0) ? minutes : 0;
      if (unit === 'hours') {
        var hrs = safeMinutes / 60;
        var txt = safeMinutes === 0 ? '0 hr' : (hrs.toFixed(1) + ' hr');
        return { text: txt, title: safeMinutes + ' min' };
      }
      return { text: safeMinutes + ' min', title: (safeMinutes / 60).toFixed(1) + ' hr' };
    }

    function applyAvgUnitFromStorage() {
      if (!avgUnitSelect) return;
      avgUnitSelect.value = getAvgUnit();
    }

    var REALTIME_DB_URL = 'https://isagip-752d1-default-rtdb.asia-southeast1.firebasedatabase.app';
    var databaseModule = null;
    var realtimeDb = null;
    var reports = [];
    var rawReports = {};
    var yearsAvailable = [];
    var previousReportIds = new Set(); // Track previous reports to detect new ones

    applyAvgUnitFromStorage();
    if (avgUnitSelect) {
      avgUnitSelect.addEventListener('change', function(){
        var next = (avgUnitSelect.value || '').toLowerCase() === 'hours' ? 'hours' : 'minutes';
        localStorage.setItem(AVG_UNIT_STORAGE_KEY, next);
        updateStats();
      });
    }

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
          // Show "Urgent Report" if no description
          var reportDesc = newReport.description || newReport.landmark || '';
          if (!reportDesc || reportDesc.trim() === '') {
            reportDesc = 'Urgent Report';
          }
          // Show street if available, otherwise show lat/lng
          var reportLocation = '';
          if (newReport.street && newReport.street.trim() !== '' && newReport.street !== 'N/A') {
            reportLocation = newReport.street;
          } else if (newReport.address && newReport.address.trim() !== '' && newReport.address !== 'N/A') {
            reportLocation = newReport.address;
          } else if (newReport.latitude != null && newReport.longitude != null) {
            reportLocation = newReport.latitude.toFixed(6) + ', ' + newReport.longitude.toFixed(6);
          } else {
            reportLocation = 'Location not specified';
          }
          
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
      if (v.includes('urgent') || v.includes('emergency')) return 'Urgent';
      if (v.includes('medical') || v.includes('med') || v.includes('injur')) return 'Medical';
      if (v.includes('fire')) return 'Fire';
      if (v.includes('police') || v.includes('criminal') || v.includes('hostile') || v.includes('crime')) return 'Police';
      if (v.includes('barangay') && v.includes('assist')) return 'Barangay Assistance';
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
      
      // Resolve reportedBy - check multiple possible field names (similar to reports.js)
      var reportedBy = null;
      var reportedByUid = null;
      
      // Check all possible name field variations
      var nameFields = ['userName', 'reportedByName', 'by', 'reporterName', 'reportedBy', 
                        'reporter', 'user', 'reportedByUser', 'reporterUser', 'name',
                        'user_name', 'reported_by_name', 'reporter_name'];
      
      for (var i = 0; i < nameFields.length; i++) {
        var field = nameFields[i];
        if (raw && raw[field] && raw[field] !== 'Unknown' && String(raw[field]).trim() !== '') {
          reportedBy = raw[field];
          break;
        }
      }
      
      // Check all possible UID field variations
      var uidFields = ['userId', 'userUid', 'reportedByUid', 'reporterUid', 'reportedByUserId',
                        'userID', 'user_id', 'reported_by_uid', 'reporter_uid', 'uid',
                        'reporterId', 'reportedById'];
      
      for (var j = 0; j < uidFields.length; j++) {
        var uidField = uidFields[j];
        if (raw && raw[uidField] && String(raw[uidField]).trim() !== '') {
          reportedByUid = raw[uidField];
          break;
        }
      }
      
      // If we have userEmail but no name/UID, use email for async resolution
      var userEmail = raw?.userEmail || raw?.email || raw?.user_email || null;
      if (!reportedBy && !reportedByUid && userEmail) {
        reportedByUid = userEmail;
      }
      
      return {
        id: id,
        type: normalizeType(raw?.emergencyType || raw?.type),
        description: raw?.description || raw?.desc || '',
        status: (raw?.status || 'Received').toString(),
        street: raw?.street || raw?.location || '',
        landmark: raw?.landmark || '',
        photo: raw?.photoUri || raw?.photoUrl || raw?.photo || '',
        reportedBy: reportedBy || (reportedByUid ? 'Loading...' : 'Unknown'),
        reportedByUid: reportedByUid,
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
        if (avgEl) {
          var formatted0 = formatAvgResponse(0, getAvgUnit());
          avgEl.textContent = formatted0.text;
          avgEl.title = formatted0.title;
        }
        if (badgesEl) {
          badgesEl.innerHTML = [
            '<span class="badge badge-blue">Medical: 0</span>',
            '<span class="badge badge-orange">Fire: 0</span>',
            '<span class="badge badge-green">Police: 0</span>',
            '<span class="badge badge-gray">Others: 0</span>'
          ].join(' ');
        }
        if (activeReportsListEl) {
          activeReportsListEl.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: var(--muted);"><p style="margin: 0;">No active reports at the moment</p></div>';
        }
        return;
      }

      if (totalEl) totalEl.textContent = String(source.length);

      var counts = { Medical:0, Fire:0, Police:0, Urgent:0, 'Barangay Assistance':0, Others:0 };
      source.forEach(function(r){
        if (counts[r.type] !== undefined) counts[r.type]++;
        else counts.Others++;
      });
      if (badgesEl) {
        badgesEl.innerHTML = [
          '<span class="badge badge-blue">Medical: '+counts.Medical+'</span>',
          '<span class="badge badge-orange">Fire: '+counts.Fire+'</span>',
          '<span class="badge badge-green">Police: '+counts.Police+'</span>',
          '<span class="badge" style="background: #ffa500; color: white;">Urgent: '+counts.Urgent+'</span>',
          '<span class="badge" style="background: #ffd700; color: #333;">Barangay Assistance: '+counts['Barangay Assistance']+'</span>',
          '<span class="badge badge-gray">Others: '+counts.Others+'</span>'
        ].join(' ');
      }

      var minutes = source.map(function(r){ return r.responseMinutes; }).filter(function(n){ return typeof n === 'number'; });
      var avg = minutes.length ? Math.round(minutes.reduce(function(a,b){return a+b;},0) / minutes.length) : 0;
      if (avgEl) {
        var formatted = formatAvgResponse(minutes.length ? avg : 0, getAvgUnit());
        avgEl.textContent = formatted.text;
        avgEl.title = formatted.title;
      }

      // Update Active Reports List
      if (activeReportsListEl) {
        var activeReports = source
          .filter(function(r){ 
            var status = (r.status || '').toString().toLowerCase();
            return status !== 'resolved' && status !== 'relayed';
          })
          .sort(function(a,b){ return b.timestampMs - a.timestampMs; })
          .slice(0, 10); // Show top 10 most recent active reports

        if (activeReports.length === 0) {
          activeReportsListEl.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: var(--muted);"><p style="margin: 0;">No active reports at the moment</p></div>';
        } else {
          var html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
          activeReports.forEach(function(report) {
            var statusColor = '#64748b';
            var status = (report.status || '').toString().toLowerCase();
            if (status === 'urgent' || status === 'responding') statusColor = '#ef4444';
            else if (status === 'assigned' || status === 'accepted') statusColor = '#f59e0b';
            else if (status === 'en_route' || status === 'arrived') statusColor = '#10b981';
            
            html += '<div style="padding: 16px; border: 1px solid var(--outline); border-radius: 8px; background: var(--surface); transition: all 0.2s; word-wrap: break-word; overflow-wrap: break-word;">';
            html += '<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px; gap: 12px;">';
            html += '<div style="flex: 1; min-width: 0;">';
            // Add Report ID
            html += '<div style="margin-bottom: 6px;">';
            html += '<span style="color: var(--muted); font-size: 11px; font-family: monospace; word-break: break-all;">ID: ' + (report.id || 'N/A') + '</span>';
            html += '</div>';
            html += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">';
            html += '<strong style="color: var(--text); font-size: 15px; word-break: break-word;">' + (report.type || 'Emergency') + '</strong>';
            html += '<span style="padding: 2px 8px; background: ' + statusColor + '; color: white; border-radius: 4px; font-size: 11px; font-weight: 500; text-transform: uppercase; white-space: nowrap; flex-shrink: 0;">' + formatStatusText(report.status || '') + '</span>';
            html += '</div>';
            // Show "Urgent Report" if no description
            var description = report.description || report.landmark || '';
            if (!description || description.trim() === '') {
              description = 'Urgent Report';
            }
            html += '<p style="margin: 0; color: var(--muted); font-size: 13px; line-height: 1.4; word-break: break-word;">' + description + '</p>';
            html += '</div>';
            html += '</div>';
            html += '<div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: var(--muted); flex-wrap: wrap;">';
            // Show street if available, otherwise show lat/lng
            var locationDisplay = '';
            if (report.street && report.street.trim() !== '' && report.street !== 'N/A') {
              locationDisplay = report.street;
            } else if (report.address && report.address.trim() !== '' && report.address !== 'N/A') {
              locationDisplay = report.address;
            } else if (report.latitude != null && report.longitude != null) {
              locationDisplay = report.latitude.toFixed(6) + ', ' + report.longitude.toFixed(6);
            } else {
              locationDisplay = 'Location not specified';
            }
            html += '<span style="word-break: break-word;">📍 ' + locationDisplay + '</span>';
            html += '<span style="white-space: nowrap;">🕐 ' + (report.timestampLabel || 'Time unknown') + '</span>';
            html += '</div>';
            html += '</div>';
          });
          html += '</div>';
          activeReportsListEl.innerHTML = html;
        }
      }
    }

    /**
     * Resolve user display name from UID or email
     */
    async function resolveUserDisplayName(uidOrEmail){
      if (!uidOrEmail) return 'Unknown';

      var isEmail = String(uidOrEmail).includes('@');

      try{
        var firestore = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
        var doc = firestore.doc;
        var getDoc = firestore.getDoc;
        var collection = firestore.collection;
        var query = firestore.query;
        var where = firestore.where;
        var getDocs = firestore.getDocs;
        var db = window.iSagipDb;
        if (!db) return uidOrEmail;

        if (isEmail) {
          // Search residents by email
          var residentsQuery = query(collection(db, 'residents'), where('email', '==', uidOrEmail));
          var residentsSnapshot = await getDocs(residentsQuery);
          if (!residentsSnapshot.empty) {
            var data = residentsSnapshot.docs[0].data();
            var name = (data.firstName || '') + ' ' + (data.lastName || '');
            name = name.trim() || data.lastName || data.firstName;
            if (name) return name;
          }

          // Search staff by email
          var staffQuery = query(collection(db, 'staff'), where('email', '==', uidOrEmail));
          var staffSnapshot = await getDocs(staffQuery);
          if (!staffSnapshot.empty) {
            var data = staffSnapshot.docs[0].data();
            var name = (data.firstName || '') + ' ' + (data.lastName || '');
            name = name.trim() || data.lastName || data.firstName;
            if (name) return name;
          }

          // Search admin by email
          var adminQuery = query(collection(db, 'admin'), where('email', '==', uidOrEmail));
          var adminSnapshot = await getDocs(adminQuery);
          if (!adminSnapshot.empty) {
            var data = adminSnapshot.docs[0].data();
            var name = (data.firstName || '') + ' ' + (data.lastName || '');
            name = name.trim() || data.lastName || data.firstName;
            if (name) return name;
          }

          // Search responder by email
          var responderQuery = query(collection(db, 'responder'), where('email', '==', uidOrEmail));
          var responderSnapshot = await getDocs(responderQuery);
          if (!responderSnapshot.empty) {
            var data = responderSnapshot.docs[0].data();
            var name = (data.firstName || '') + ' ' + (data.lastName || '');
            name = name.trim() || data.lastName || data.firstName || data.fullName;
            if (name) return name;
          }

          // Fallback to email
          return uidOrEmail;
        }

        // UID lookup - check all collections
        var adminDoc = await getDoc(doc(db, 'admin', uidOrEmail));
        if (adminDoc.exists()) {
          var data = adminDoc.data();
          var name = (data.firstName || '') + ' ' + (data.lastName || '');
          name = name.trim() || data.lastName || data.firstName || uidOrEmail;
          return name;
        }
        var staffDoc = await getDoc(doc(db, 'staff', uidOrEmail));
        if (staffDoc.exists()) {
          var data = staffDoc.data();
          var name = (data.firstName || '') + ' ' + (data.lastName || '');
          name = name.trim() || data.lastName || data.firstName || uidOrEmail;
          return name;
        }
        var residentDoc = await getDoc(doc(db, 'residents', uidOrEmail));
        if (residentDoc.exists()) {
          var data = residentDoc.data();
          var name = (data.firstName || '') + ' ' + (data.lastName || '');
          name = name.trim() || data.lastName || data.firstName || uidOrEmail;
          return name;
        }
        // Check responder collection
        var responderDoc = await getDoc(doc(db, 'responder', uidOrEmail));
        if (responderDoc.exists()) {
          var data = responderDoc.data();
          var name = (data.firstName || '') + ' ' + (data.lastName || '');
          name = name.trim() || data.lastName || data.firstName || data.fullName || uidOrEmail;
          return name;
        }
      } catch (error){
        console.error('Failed to resolve user name for dashboard report', uidOrEmail, error);
      }
      return uidOrEmail;
    }

    /**
     * Resolve reportedBy names for reports that have UIDs but no names
     */
    async function resolveReportedByNames(reports) {
      var reportsToResolve = reports.filter(function(r) {
        return (!r.reportedBy || r.reportedBy === 'Unknown' || r.reportedBy === 'Loading...') && r.reportedByUid;
      });

      if (reportsToResolve.length === 0) return;

      var promises = reportsToResolve.map(function(report) {
        return resolveUserDisplayName(report.reportedByUid).then(function(name) {
          if (name && name !== report.reportedByUid) {
            report.reportedBy = name;
            // Update map markers if they exist
            if (window.updateISagipMapMarkers && Array.isArray(reports)) {
              window.updateISagipMapMarkers(reports);
            }
            // Update active reports list if it exists
            updateStats();
          }
        });
      });

      await Promise.all(promises);
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
            
            // Resolve reportedBy names for reports that have UIDs but no names
            resolveReportedByNames(reports).then(function() {
              // Update map markers after name resolution
              if (Array.isArray(reports)) {
                if (window.updateISagipMapMarkers) window.updateISagipMapMarkers(reports);
                else window.iSagipPendingMarkersData = reports;
              }
            });
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

    if (testNotifBtn) testNotifBtn.addEventListener('click', function(){ showToast('Test notification sent'); });
    if (filterPeriodEl) filterPeriodEl.addEventListener('change', function(){ updateStats(); });
    if (filterMonthEl) filterMonthEl.addEventListener('change', function(){ updateStats(); });
    if (filterYearEl) filterYearEl.addEventListener('change', function(){ updateStats(); });
    init();
  })();
})();
