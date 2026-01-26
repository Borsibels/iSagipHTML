/**
 * Reports Module
 * Handles reports page functionality, realtime database feed, report management
 */

(function() {
  'use strict';

  /**
   * Collect responder names from various possible fields on a raw object.
   * Shared helper function for building consistent responder lists.
   * @param {Object} raw
   * @returns {string[]} Unique, trimmed responder names
   */
  function collectResponders(raw) {
    raw = raw || {};
    var responders = [];
    function add(value) {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(add);
        return;
      }
      if (typeof value === 'object') {
        // If it's a plain object (not an array), skip to avoid "[object Object]" strings
        // Responder objects should be normalized elsewhere.
        return;
      }
      var str = String(value).trim();
      if (!str) return;
      var parts = str.split(',').map(function(name){ return name.trim(); });
      parts.forEach(function(name){
        if (name && !responders.includes(name)) {
          responders.push(name);
        }
      });
    }

    var assignment = raw.assignment || {};
    add(assignment.responders);
    add(assignment.responder);
    add(assignment.secondaryResponder);
    add(raw.responders);
    add(raw.responder);
    add(raw.responderName);
    add(raw.assignedResponderName);
    add(raw.assignedResponder);
    add(raw.assignedResponders);
    add(raw.responderList);
    add(raw.secondaryResponder);
    add(raw.otherResponder);
    add(raw.crewMembers);
    return responders;
  }

  // ========================================
  // REPORTS PAGE - REALTIME DATABASE FEED
  // ========================================
  (function initializeRealtimeReportsPage() {
    const reportsTable = document.getElementById('reports-rows');
    if (!reportsTable) return;

    const stats = {
      total: document.getElementById('r-total'),
      resolved: document.getElementById('r-resolved'),
      active: document.getElementById('r-active'),
      average: document.getElementById('r-avg'),
    };

    const detailsModal = document.getElementById('modal-details');
    const detailsContent = document.getElementById('details-content');
    const manageModal = document.getElementById('modal-manage-report');
    const manageForm = document.getElementById('manage-report-form');
    const manageReportIdInput = document.getElementById('manage-report-id');
    const manageStatusSelect = document.getElementById('manage-status');
    const manageResponderSelect = document.getElementById('manage-responder');
    const responderCheckboxesContainer = document.getElementById('responder-checkboxes');
    const noRespondersMessage = document.getElementById('no-responders-message');
    const manageVehicleInput = document.getElementById('manage-vehicle');
    const manageVehicleSelect = document.getElementById('manage-vehicle');
    let ambulancesMap = {};
    let respondersMap = {}; // Firestore responder data (name, email, status)
    let onlineRespondersMap = {}; // Realtime DB responder data (who has app open)

    const REALTIME_DB_URL = 'https://isagip-752d1-default-rtdb.asia-southeast1.firebasedatabase.app';
    let realtimeDb = null;
    let databaseModule = null;
    let reports = [];
    let rawReports = {};
    let previousReportIds = new Set(); // Track previous reports to detect new ones
    let groupedReports = []; // Store grouped reports for duplicate handling

    init();

    async function init() {
      try {
        await ensureFirebaseReady();
        databaseModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
        realtimeDb = databaseModule.getDatabase(window.iSagipApp, REALTIME_DB_URL);

        const { ref, onValue } = databaseModule;
        const reportsRef = ref(realtimeDb, 'reports');
        const ambulancesRef = ref(realtimeDb, 'ambulances');
        const respondersRef = ref(realtimeDb, 'responders');

        // Listen to online responders (those who have their responder app open)
        onValue(
          respondersRef,
          (snapshot) => {
            const value = snapshot.val() || {};
            onlineRespondersMap = {};
            const now = Date.now();
            const STALE_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds
            
            // Track which responders are currently online (have app open)
            Object.keys(value).forEach(function(responderId) {
              const responder = value[responderId];
              if (responder) {
                const updatedAt = responder.updatedAt || responder.lastUpdated || null;
                
                // Only consider responder online if they've updated recently (within 5 minutes)
                // This filters out stale entries from responders who closed their app
                if (updatedAt) {
                  const timeSinceUpdate = now - updatedAt;
                  if (timeSinceUpdate > STALE_THRESHOLD) {
                    // Responder data is stale, skip them
                    return;
                  }
                } else {
                  // No timestamp, consider it stale and skip
                  return;
                }
                
                // Store that this responder is online and recently active
                onlineRespondersMap[responderId] = {
                  responderId: responder.responderId || responderId,
                  name: responder.name || '',
                  lat: responder.lat,
                  lng: responder.lng,
                  status: responder.status || '',
                  updatedAt: updatedAt
                };
              }
            });
            mergeOnlineRespondersIntoMap();
            // Refresh responder options if modal is open
            if (manageModal && !manageModal.hidden) {
              updateResponderOptions();
            }
          },
          (error) => {
            console.error('Failed to load online responders:', error);
          }
        );

        onValue(
          ambulancesRef,
          (snapshot) => {
            ambulancesMap = snapshot.val() || {};
            updateVehicleOptions();
          },
          (error) => {
            console.error('Failed to load ambulances:', error);
          }
        );
        onValue(
          reportsRef,
          async (snapshot) => {
            const value = snapshot.val() || {};
            rawReports = value;
            const previousReportsCount = reports.length;
            reports = Object.entries(value)
              .map(([id, data]) => mapReport(id, data))
              .sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

            // Resolve reportedBy names for reports that have UIDs but no names
            await resolveReportedByNames(reports);

            // Check for new reports and play sound notification
            if (reports.length > previousReportsCount || previousReportsCount === 0) {
              // Only check for new reports if we had previous reports (skip initial load)
              if (previousReportsCount > 0) {
                checkForNewReportsInReportsPage(reports);
              } else {
                // Initialize previous report IDs on first load
                reports.forEach(function(report) {
                  if (report.id) {
                    previousReportIds.add(report.id);
                  }
                });
              }
            }

            renderReports();
            updateStats();
          },
          (error) => {
            console.error('Realtime reports error:', error);
            reportsTable.innerHTML = `
              <div class="t-row">
                <div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:#ef4444;">
                  Unable to load reports. Please refresh the page.
                </div>
              </div>`;
          }
        );
      } catch (error) {
        console.error('Failed to initialize reports page:', error);
      }
    }

    /**
     * Play notification sound when a new report is received (for reports page)
     */
    function playNotificationSoundReportsPage() {
      try {
        var audioContext = new (window.AudioContext || window.webkitAudioContext)();
        var oscillator = audioContext.createOscillator();
        var gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Configure sound (emergency notification tone)
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.3);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.4);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.39);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (error) {
        console.log('Could not play notification sound:', error);
      }
    }

    /**
     * Check for new reports and trigger notifications (for reports page)
     * @param {Array} currentReports - Current list of reports
     */
    function checkForNewReportsInReportsPage(currentReports) {
      if (!currentReports || currentReports.length === 0) return;
      
      var currentReportIds = new Set();
      var newReports = [];
      
      currentReports.forEach(function(report) {
        if (report.id) {
          currentReportIds.add(report.id);
          if (!previousReportIds.has(report.id)) {
            newReports.push(report);
          }
        }
      });
      
      // If there are new reports, play sound
      if (newReports.length > 0) {
        playNotificationSoundReportsPage();
      }
      
      // Update previous report IDs for next check
      previousReportIds = currentReportIds;
    }

    /**
     * Calculate distance between two GPS coordinates (Haversine formula)
     * Returns distance in meters
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371000; // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    function levenshteinDistance(str1, str2) {
      const matrix = [];
      for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[str2.length][str1.length];
    }

    /**
     * Calculate string similarity (simple Levenshtein-based)
     * Returns value between 0 and 1
     */
    function calculateStringSimilarity(str1, str2) {
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;
      if (longer.length === 0) return 1.0;
      
      const distance = levenshteinDistance(longer, shorter);
      return (longer.length - distance) / longer.length;
    }

    /**
     * Check if two reports are duplicates
     */
    function areReportsDuplicate(report1, report2) {
      // Must be same type
      if (report1.type !== report2.type) return false;
      
      // Check time window (within 10 minutes)
      const timeDiff = Math.abs((report1.rawTimestamp || 0) - (report2.rawTimestamp || 0));
      const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
      if (timeDiff > tenMinutes) return false;
      
      // Check location proximity (within 100 meters)
      if (report1.latitude && report1.longitude && report2.latitude && report2.longitude) {
        const distance = calculateDistance(
          report1.latitude, report1.longitude,
          report2.latitude, report2.longitude
        );
        if (distance > 100) return false; // More than 100 meters apart
      } else {
        // If no GPS, compare street address (fuzzy match)
        const street1 = (report1.street || '').toLowerCase().trim();
        const street2 = (report2.street || '').toLowerCase().trim();
        if (street1 && street2 && street1 !== street2) {
          // Simple similarity check
          const similarity = calculateStringSimilarity(street1, street2);
          if (similarity < 0.7) return false; // Less than 70% similar
        }
      }
      
      return true;
    }

    /**
     * Group duplicate reports together
     * Reports are considered duplicates if they:
     * - Have the same type
     * - Are within 100 meters of each other
     * - Were created within 10 minutes of each other
     */
    function groupDuplicateReports(reports) {
      const grouped = [];
      const processed = new Set();
      
      reports.forEach((report, index) => {
        if (processed.has(index)) return;
        
        const group = {
          primary: report,
          duplicates: [],
          count: 1,
          reporters: [report.reportedBy || 'Unknown']
        };
        
        // Find similar reports
        reports.forEach((otherReport, otherIndex) => {
          if (index === otherIndex || processed.has(otherIndex)) return;
          
          if (areReportsDuplicate(report, otherReport)) {
            group.duplicates.push(otherReport);
            group.count++;
            if (otherReport.reportedBy && !group.reporters.includes(otherReport.reportedBy)) {
              group.reporters.push(otherReport.reportedBy);
            }
            processed.add(otherIndex);
          }
        });
        
        processed.add(index);
        grouped.push(group);
      });
      
      return grouped;
    }

    function renderReports() {
      // Always exclude resolved and relayed reports from main reports view
      // They should only appear in the History page
      let reportsToRender = reports.filter(r => {
        const status = (r.status || '').toLowerCase();
        return status !== 'resolved' && status !== 'relayed';
      });

      if (!reportsToRender.length) {
        reportsTable.innerHTML = `
          <div class="t-row">
            <div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:var(--muted);">
              No active reports. Resolved and relayed reports are shown in History.
            </div>
          </div>`;
        groupedReports = [];
        return;
      }

      // Group duplicate reports
      groupedReports = groupDuplicateReports(reportsToRender);

      const currentUserRole = localStorage.getItem('iSagip_userRole') || '';
      const canManage = ['admin', 'system_admin', 'barangay_staff', 'responder'].includes(currentUserRole);
      const canDelete = ['admin', 'system_admin', 'barangay_staff'].includes(currentUserRole);

      reportsTable.innerHTML = groupedReports
        .map((group, groupIndex) => {
          const report = group.primary; // Use primary report for display
          const isDuplicate = group.count > 1;
          
          const photoCell = report.photo && report.photo.trim() !== ''
            ? `<a href="${escapeHtml(report.photo)}" target="_blank" rel="noopener" title="Click to view full size" style="display:inline-block;width:80px;height:60px;border-radius:6px;overflow:hidden;border:1px solid var(--outline);background:#f3f6fb;cursor:pointer;transition:transform 0.2s;">
                <img src="${escapeHtml(report.photo)}" alt="Report photo" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);\'>Failed</div>'"/>
              </a>`
            : '<span style="color:var(--muted);font-size:12px;">N/A</span>';
          
          // Add duplicate badge if there are duplicates
          const duplicateBadge = isDuplicate 
            ? `<span class="badge badge-orange" style="margin-left:8px;background:#f97316;color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;" title="${group.count} people reported this incident">${group.count}x</span>`
            : '';
          
          const reportersList = isDuplicate && group.reporters.length > 1
            ? `<div style="font-size:11px;color:var(--muted);margin-top:4px;">Reported by: ${group.reporters.join(', ')}</div>`
            : '';
          
          const actionButtons = `
            <div class="reports-actions">
              <button class="btn btn-small btn-outline" data-action="view-report" data-id="${report.id}">
                View
              </button>
              ${
                canManage
                  ? `<button class="btn btn-small btn-primary" data-action="manage-report" data-id="${report.id}">
                      Manage
                    </button>`
                  : '<div></div>'
              }
              ${
                canDelete
                  ? `<button class="btn btn-small btn-danger" data-action="delete-report" data-id="${report.id}">
                      Delete
                    </button>`
                  : (isDuplicate ? '<div></div>' : '')
              }
              ${isDuplicate ? `<button class="btn btn-small btn-secondary" data-action="view-duplicates" data-group-index="${groupIndex}" title="View all ${group.count} reports" style="font-size:11px;padding:4px 8px;">View All (${group.count})</button>` : ''}
            </div>
          `;

          return `
            <div class="t-row" data-report-id="${report.id}" ${isDuplicate ? 'data-has-duplicates="true"' : ''}>
              <div title="${report.id}"><span class="report-id-text">${report.id}</span>${duplicateBadge}</div>
              <div>${escapeHtml(report.type)}</div>
              <div>${escapeHtml(report.description)}${reportersList}</div>
              <div>${formatStatusBadge(report.status)}</div>
              <div>${actionButtons}</div>
              <div>${escapeHtml(report.street)}</div>
              <div>${escapeHtml(report.landmark)}</div>
              <div>${report.latitude != null ? report.latitude.toFixed(6) : '—'}</div>
              <div>${report.longitude != null ? report.longitude.toFixed(6) : '—'}</div>
              <div>${photoCell}</div>
              <div>${report.timestamp}</div>
              <div>${report.responseTime || '—'}</div>
              <div>${escapeHtml(report.reportedBy)}</div>
              <div>${escapeHtml(report.closedBy || '—')}</div>
              <div>${escapeHtml(report.lastUpdatedBy || '—')}</div>
              <div>${report.lastUpdatedAt || '—'}</div>
            </div>
          `;
        })
        .join('');
    }

    function updateStats() {
      // Calculate stats from all reports (including resolved/relayed)
      // But display only active reports in the table
      const allGroupedReports = groupDuplicateReports(reports);
      const total = allGroupedReports.length > 0 ? allGroupedReports.length : reports.length;
      // Count resolved/relayed from grouped reports to match total counting method
      const resolved = allGroupedReports.filter((group) => {
        const status = (group.primary.status || '').toLowerCase();
        return status === 'resolved' || status === 'relayed';
      }).length;
      const active = total - resolved;

      // Only calculate average from resolved/relayed reports that have valid response times
      const resolvedReports = reports.filter((r) => {
        const status = (r.status || '').toLowerCase();
        return status === 'resolved' || status === 'relayed';
      });

      const responseValues = resolvedReports
        .map((r) => {
          // If responseMinutes is already calculated, use it
          if (typeof r.responseMinutes === 'number' && r.responseMinutes >= 0) {
            return r.responseMinutes;
          }
          // Otherwise, try to calculate from raw data
          const raw = rawReports[r.id] || {};
          const timestamp = Number(raw.timestamp) || r.rawTimestamp;
          const closedAt = Number(raw.closedAt) || null;
          const lastUpdatedAt = Number(raw.lastUpdatedAt) || null;
          
          // Use closedAt if available, otherwise use lastUpdatedAt for resolved/relayed reports
          const endTime = closedAt || (lastUpdatedAt && (raw.status || '').toLowerCase() === 'resolved' || (raw.status || '').toLowerCase() === 'relayed' ? lastUpdatedAt : null);
          
          if (endTime && timestamp) {
            const minutes = Math.round((endTime - timestamp) / 60000);
            return minutes >= 0 ? minutes : null;
          }
          return null;
        })
        .filter((value) => typeof value === 'number' && value >= 0);

      const average =
        responseValues.length > 0
          ? Math.round(responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length)
          : 0;

      if (stats.total) stats.total.textContent = total;
      if (stats.resolved) stats.resolved.textContent = resolved;
      if (stats.active) stats.active.textContent = active;
      if (stats.average) stats.average.textContent = responseValues.length > 0 ? `${average} min` : '0 min';
    }


    // Details photo fullscreen viewer
    document.getElementById('view-details-photo-fullscreen')?.addEventListener('click', function() {
      const fullscreenModal = document.getElementById('details-photo-fullscreen-modal');
      if (fullscreenModal) fullscreenModal.hidden = false;
    });

    document.getElementById('details-photo-fullscreen-modal')?.addEventListener('click', function(event){
      if (event.target.matches('[data-close]') || event.target === this) {
        this.hidden = true;
      }
    });

    reportsTable.addEventListener('click', function (event) {
      const viewButton = event.target.closest('[data-action="view-report"]');
      const manageButton = event.target.closest('[data-action="manage-report"]');
      const deleteButton = event.target.closest('[data-action="delete-report"]');
      const viewDuplicatesButton = event.target.closest('[data-action="view-duplicates"]');

      if (viewButton) {
        const reportId = viewButton.getAttribute('data-id');
        const report = reports.find((item) => item.id === reportId);
        if (report) {
          showReportDetails(report);
        }
        return;
      }

      if (viewDuplicatesButton) {
        const groupIndex = parseInt(viewDuplicatesButton.getAttribute('data-group-index'));
        if (groupedReports[groupIndex]) {
          showDuplicatesModal(groupedReports[groupIndex]);
        }
        return;
      }

      if (manageButton) {
        const reportId = manageButton.getAttribute('data-id');
        const raw = rawReports[reportId];
        if (raw) {
          openManageModal(reportId, raw);
        }
        return;
      }

      if (deleteButton) {
        const reportId = deleteButton.getAttribute('data-id');
        if (!reportId) return;
        const confirmMsg = 'Delete this report permanently? This cannot be undone.';
        if (!confirm(confirmMsg)) return;
        if (!databaseModule || !realtimeDb) {
          alert('Database not ready. Please refresh and try again.');
          return;
        }
        (async function(){
          try {
            const { ref, remove } = databaseModule;
            await remove(ref(realtimeDb, `reports/${reportId}`));
            alert('Report deleted.');
          } catch (err) {
            console.error('Failed to delete report:', err);
            alert('Failed to delete report. Please try again.');
          }
        })();
      }
    });

    /**
     * Show modal with all duplicate reports
     * @param {Object} group - Group object containing primary and duplicate reports
     */
    function showDuplicatesModal(group) {
      // Create modal HTML
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
      modal.innerHTML = `
        <div class="modal-content" style="background:white;border-radius:8px;max-width:900px;max-height:80vh;overflow-y:auto;width:90%;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <div class="modal-header" style="padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
            <h2 style="margin:0;font-size:20px;font-weight:600;">Duplicate Reports (${group.count} total)</h2>
            <button class="modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#6b7280;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">&times;</button>
          </div>
          <div class="modal-body" style="padding:20px;">
            <p style="margin-bottom:16px;color:#6b7280;font-size:14px;">
              Multiple users reported the same incident. All reports are listed below:
            </p>
            <div class="table" style="width:100%;">
              <div class="t-head t-row" style="display:grid;grid-template-columns:150px 1fr 150px 120px 200px;gap:12px;padding:12px;background:#f9fafb;border-bottom:2px solid #e5e7eb;font-weight:600;font-size:13px;">
                <div>Report ID</div>
                <div>Reported By</div>
                <div>Time</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              <div class="t-body">
                ${[group.primary, ...group.duplicates].map(report => `
                  <div class="t-row" style="display:grid;grid-template-columns:150px 1fr 150px 120px 200px;gap:12px;padding:12px;border-bottom:1px solid #e5e7eb;align-items:center;">
                    <div style="font-family:monospace;font-size:12px;">${escapeHtml(report.id)}</div>
                    <div>${escapeHtml(report.reportedBy || 'Unknown')}</div>
                    <div style="font-size:12px;color:#6b7280;">${escapeHtml(report.timestamp)}</div>
                    <div>${formatStatusBadge(report.status)}</div>
                    <div style="display:flex;gap:8px;">
                      <button class="btn btn-small btn-outline" data-action="view-report-from-modal" data-id="${report.id}" style="font-size:11px;padding:4px 8px;">View</button>
                      <button class="btn btn-small btn-primary" data-action="manage-report-from-modal" data-id="${report.id}" style="font-size:11px;padding:4px 8px;">Manage</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Close modal handlers
      modal.querySelector('.modal-close').addEventListener('click', () => {
        document.body.removeChild(modal);
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
        }
      });

      // Handle actions from modal
      modal.addEventListener('click', function(e) {
        const viewBtn = e.target.closest('[data-action="view-report-from-modal"]');
        const manageBtn = e.target.closest('[data-action="manage-report-from-modal"]');
        
        if (viewBtn) {
          const reportId = viewBtn.getAttribute('data-id');
          const report = reports.find((item) => item.id === reportId);
          if (report) {
            document.body.removeChild(modal);
            showReportDetails(report);
          }
        } else if (manageBtn) {
          const reportId = manageBtn.getAttribute('data-id');
          const raw = rawReports[reportId];
          if (raw) {
            document.body.removeChild(modal);
            openManageModal(reportId, raw);
          }
        }
      });
    }

    function showReportDetails(report) {
      if (!detailsModal || !detailsContent) return;

      // Populate report information fields
      const reportIdEl = document.getElementById('details-report-id');
      const statusEl = document.getElementById('details-status');
      const assignedResponderEl = document.getElementById('details-assigned-responder');
      const assignedVehicleEl = document.getElementById('details-assigned-vehicle');
      const typeEl = document.getElementById('details-type');
      const descriptionEl = document.getElementById('details-description');
      const streetEl = document.getElementById('details-street');
      const landmarkEl = document.getElementById('details-landmark');
      const locationEl = document.getElementById('details-location');
      const reportedByEl = document.getElementById('details-reported-by');
      const timestampEl = document.getElementById('details-timestamp');
      const responseTimeEl = document.getElementById('details-response-time');
      const closedByEl = document.getElementById('details-closed-by');
      const updatedByEl = document.getElementById('details-updated-by');
      const updatedAtEl = document.getElementById('details-updated-at');

      if (reportIdEl) reportIdEl.value = report.id || 'N/A';
      if (statusEl) statusEl.value = formatStatusLabel(report.status) || 'N/A';
      if (assignedResponderEl) assignedResponderEl.value = escapeHtml(report.assignedResponder || '—');
      if (assignedVehicleEl) assignedVehicleEl.value = escapeHtml(report.assignedVehicle || '—');
      if (typeEl) typeEl.value = escapeHtml(report.type) || 'N/A';
      if (descriptionEl) descriptionEl.value = escapeHtml(report.description) || 'N/A';
      if (streetEl) streetEl.value = escapeHtml(report.street) || 'N/A';
      if (landmarkEl) landmarkEl.value = escapeHtml(report.landmark) || 'N/A';
      
      const locationStr = (report.latitude != null && report.longitude != null)
        ? `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`
        : 'N/A';
      if (locationEl) locationEl.value = locationStr;
      
      if (reportedByEl) reportedByEl.value = escapeHtml(report.reportedBy) || 'N/A';
      if (timestampEl) timestampEl.value = report.timestamp || 'N/A';
      if (responseTimeEl) responseTimeEl.value = report.responseTime || '—';
      if (closedByEl) closedByEl.value = escapeHtml(report.closedBy || '—');
      if (updatedByEl) updatedByEl.value = escapeHtml(report.lastUpdatedBy || '—');
      if (updatedAtEl) updatedAtEl.value = report.lastUpdatedAt || '—';

      // Load and display report photo
      const photoUrl = report.photo || '';
      const photoPreview = document.getElementById('details-photo-preview');
      const photoPlaceholder = document.getElementById('details-photo-placeholder');
      const photoFullscreenImg = document.getElementById('details-photo-fullscreen-img');
      const downloadPhotoLink = document.getElementById('download-details-photo');
      const viewFullscreenBtn = document.getElementById('view-details-photo-fullscreen');

      if (photoUrl && photoUrl.trim() !== '') {
        if (photoPreview) {
          photoPreview.src = photoUrl;
          photoPreview.style.display = 'block';
          photoPreview.onerror = function() {
            this.style.display = 'none';
            if (photoPlaceholder) photoPlaceholder.style.display = 'block';
            if (viewFullscreenBtn) viewFullscreenBtn.style.display = 'none';
            if (downloadPhotoLink) downloadPhotoLink.style.display = 'none';
          };
        }
        if (photoPlaceholder) photoPlaceholder.style.display = 'none';
        if (photoFullscreenImg) photoFullscreenImg.src = photoUrl;
        if (viewFullscreenBtn) viewFullscreenBtn.style.display = 'flex';
        if (downloadPhotoLink) {
          downloadPhotoLink.href = photoUrl;
          // Extract filename from URL or use default
          const urlParts = photoUrl.split('/');
          const filename = urlParts[urlParts.length - 1].split('?')[0] || 'report-photo.jpg';
          downloadPhotoLink.download = filename;
          downloadPhotoLink.style.display = 'flex';
        }
      } else {
        if (photoPreview) photoPreview.style.display = 'none';
        if (photoPlaceholder) photoPlaceholder.style.display = 'block';
        if (photoFullscreenImg) photoFullscreenImg.src = '';
        if (viewFullscreenBtn) viewFullscreenBtn.style.display = 'none';
        if (downloadPhotoLink) {
          downloadPhotoLink.style.display = 'none';
          downloadPhotoLink.href = '#';
        }
      }

      detailsModal.hidden = false;
    }

    function toggleVehicleDropdown() {
      if (!manageVehicleSelect || !manageStatusSelect) return;
      const currentStatus = (manageStatusSelect.value || '').toLowerCase();
      const isRelayed = currentStatus === 'relayed';
      const isResolved = currentStatus === 'resolved';
      const shouldDisable = isRelayed || isResolved;
      
      manageVehicleSelect.disabled = shouldDisable;
      if (shouldDisable) {
        manageVehicleSelect.value = '';
        manageVehicleSelect.style.opacity = '0.6';
        manageVehicleSelect.style.cursor = 'not-allowed';
      } else {
        manageVehicleSelect.style.opacity = '1';
        manageVehicleSelect.style.cursor = 'pointer';
      }
    }

    function toggleResponderDropdown() {
      if (!responderCheckboxesContainer || !manageStatusSelect) return;
      const currentStatus = (manageStatusSelect.value || '').toLowerCase();
      const isRelayed = currentStatus === 'relayed';
      const isResolved = currentStatus === 'resolved';
      const shouldDisable = isRelayed || isResolved;
      
      // Disable/enable all checkboxes
      const checkboxes = responderCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.disabled = shouldDisable;
        if (shouldDisable) {
          checkbox.checked = false;
        }
      });
      
      // Update container styling
      const container = document.getElementById('responder-selection-container');
      if (container) {
        if (shouldDisable) {
          container.style.opacity = '0.6';
          container.style.cursor = 'not-allowed';
          container.style.pointerEvents = 'none';
        } else {
          container.style.opacity = '1';
          container.style.cursor = 'default';
          container.style.pointerEvents = 'auto';
        }
      }
    }

    function mergeOnlineRespondersIntoMap() {
      Object.keys(onlineRespondersMap || {}).forEach(function(onlineId) {
        const online = onlineRespondersMap[onlineId] || {};
        const uid = online.responderId || onlineId;
        if (!uid) return;
        if (!respondersMap[uid]) {
          respondersMap[uid] = {
            uid: uid,
            name: online.name || uid,
            email: '',
            status: 'active',
            responderType: online.responderType || online.type || ''
          };
        }
      });
    }

    async function loadResponders() {
      if (!responderCheckboxesContainer) return;
      try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
        const db = window.iSagipDb;
        if (!db) return;
        
        const respondersSnapshot = await getDocs(collection(db, 'responder'));
        respondersMap = {};
        respondersSnapshot.forEach((doc) => {
          const data = doc.data() || {};
          const resolvedUid = data.uid || data.userId || data.authUid || doc.id;
          if (!resolvedUid) {
            return;
          }
          respondersMap[resolvedUid] = {
            uid: resolvedUid,
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.fullName || 'Unknown',
            email: data.email || '',
            status: data.status || 'active',
            responderType: data.responderType || data.specialty || data.type || ''
          };
        });
        mergeOnlineRespondersIntoMap();
        updateResponderOptions();
      } catch (error) {
        console.error('Failed to load responders:', error);
      }
    }

    function updateResponderOptions(selectedValues) {
      if (!responderCheckboxesContainer || !noRespondersMessage) return;
      
      // Handle both single value (string) and array of values
      const selectedArray = Array.isArray(selectedValues) 
        ? selectedValues 
        : (selectedValues ? [selectedValues] : []);
      
      // Get currently selected values from checkboxes if no explicit selection provided
      let currentSelected = selectedArray;
      if (currentSelected.length === 0) {
        const checkboxes = responderCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
        currentSelected = Array.from(checkboxes).map(cb => cb.value);
      }
      
      // Clear container
      responderCheckboxesContainer.innerHTML = '';
      
      // Filter responders: must be both ONLINE (app open) and ACTIVE (status in Firestore)
      const now = Date.now();
      const STALE_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds
      
      const availableResponders = Object.keys(respondersMap).filter(uid => {
        const responder = respondersMap[uid] || {};
        const isActive = !responder.status || responder.status === 'active';
        
        // Check if responder is online (has their responder app open)
        // Match by responderId or uid
        let onlineData = onlineRespondersMap[uid];
        if (!onlineData) {
          // Try to find by responderId
          const found = Object.keys(onlineRespondersMap).find(onlineId => {
            const onlineResponder = onlineRespondersMap[onlineId];
            return onlineResponder && (
              onlineResponder.responderId === uid || 
              onlineId === uid
            );
          });
          if (found) {
            onlineData = onlineRespondersMap[found];
          }
        }
        
        // Must be active AND online AND recently updated (within 5 minutes)
        if (!isActive || !onlineData) {
          return false;
        }
        
        // Double-check timestamp to ensure responder is still active
        const updatedAt = onlineData.updatedAt;
        if (!updatedAt) {
          return false; // No timestamp, consider stale
        }
        
        const timeSinceUpdate = now - updatedAt;
        if (timeSinceUpdate > STALE_THRESHOLD) {
          return false; // Data is stale (older than 5 minutes)
        }
        
        return true;
      });
      
      if (availableResponders.length === 0) {
        const totalActive = Object.keys(respondersMap).filter(uid => {
          const responder = respondersMap[uid] || {};
          return responder.status === 'active';
        }).length;
        const totalOnline = Object.keys(onlineRespondersMap).length;
        
        let message = 'No available responders. ';
        if (totalActive === 0) {
          message += 'No active responders in the system.';
        } else if (totalOnline === 0) {
          message += 'No responders currently have their app open. Responders must have their app open and be active within the last minute.';
        } else {
          message += 'Responders must have their app open and be active within the last minute to be assigned.';
        }
        
        noRespondersMessage.textContent = message;
        noRespondersMessage.style.display = 'block';
        responderCheckboxesContainer.style.display = 'none';
        return;
      }
      
      noRespondersMessage.style.display = 'none';
      responderCheckboxesContainer.style.display = 'grid';
      
      // Check which responders are already assigned to active reports
      const occupiedResponderUids = new Set();
      if (databaseModule && realtimeDb && rawReports) {
        const activeStatuses = ['received', 'assigned', 'accepted', 'responding', 'en_route', 'arrived'];
        const currentReportId = manageReportIdInput?.value;
        
        Object.keys(rawReports).forEach(reportKey => {
          // Skip the current report being edited
          if (reportKey === currentReportId) return;
          
          const report = rawReports[reportKey];
          const reportStatus = (report.status || '').toLowerCase();
          
          // Only check active reports
          if (activeStatuses.includes(reportStatus)) {
            const assignedUids = report.assignedResponderUids || 
                               (report.assignedResponderUid ? [report.assignedResponderUid] : []);
            assignedUids.forEach(uid => occupiedResponderUids.add(uid));
          }
        });
      }
      
      // Create checkbox for each available responder
      availableResponders.forEach(function(uid) {
        const responder = respondersMap[uid] || {};
        const onlineData = onlineRespondersMap[uid] || 
          Object.values(onlineRespondersMap).find(r => r.responderId === uid);
        const isOccupied = occupiedResponderUids.has(uid);
        
        const checkboxWrapper = document.createElement('label');
        checkboxWrapper.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: background-color 0.2s;';
        if (isOccupied) {
          checkboxWrapper.style.opacity = '0.6';
          checkboxWrapper.style.cursor = 'not-allowed';
          checkboxWrapper.title = 'This responder is already assigned to an active report';
        } else {
          checkboxWrapper.style.cursor = 'pointer';
          checkboxWrapper.onmouseover = function() { this.style.backgroundColor = '#f3f6fb'; };
          checkboxWrapper.onmouseout = function() { this.style.backgroundColor = 'transparent'; };
        }
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = uid;
        checkbox.checked = currentSelected.includes(uid) && !isOccupied;
        checkbox.disabled = isOccupied;
        checkbox.style.cssText = 'width: 18px; height: 18px; cursor: ' + (isOccupied ? 'not-allowed' : 'pointer') + '; accent-color: var(--primary);';
        
        const label = document.createElement('span');
        const responderName = responder.name || onlineData?.name || uid;
        const responderType = responder.responderType || onlineData?.responderType || '';
        const displayText = responderType 
          ? `${responderName} (${responderType})` 
          : responderName;
        label.textContent = displayText + (isOccupied ? ' - Occupied' : '');
        label.style.cssText = 'font-size: 14px; color: var(--text); flex: 1;';
        
        // Add online indicator badge
        const onlineBadge = document.createElement('span');
        onlineBadge.textContent = '●';
        onlineBadge.style.cssText = 'color: ' + (isOccupied ? '#ef4444' : '#10b981') + '; font-size: 12px; margin-left: 4px;';
        onlineBadge.title = isOccupied ? 'Occupied - Already assigned to an active report' : 'Online - Responder app is open';
        
        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(label);
        checkboxWrapper.appendChild(onlineBadge);
        responderCheckboxesContainer.appendChild(checkboxWrapper);
      });
    }

    async function openManageModal(reportId, raw) {
      if (!manageModal || !manageForm) return;
      manageReportIdInput.value = reportId;
      manageStatusSelect.value = (raw.status || 'received').toLowerCase();
      await loadResponders(); // Load responders when opening modal
      
      // Handle multiple assigned responders (array or single value)
      const assignedResponderUids = raw.assignedResponderUids || 
        (raw.assignedResponderUid ? [raw.assignedResponderUid] : []);
      updateResponderOptions(assignedResponderUids);
      
      updateVehicleOptions(raw.assignedVehicle || '');
      toggleVehicleDropdown(); // Disable vehicle dropdown if status is "received"
      toggleResponderDropdown(); // Disable responder dropdown if status is "received"
      manageModal.hidden = false;
    }

    function updateVehicleOptions(selectedValue) {
      if (!manageVehicleSelect) return;
      const hasExplicitSelection = arguments.length > 0;
      const currentValue = hasExplicitSelection ? (selectedValue || '') : (manageVehicleSelect.value || '');
      manageVehicleSelect.innerHTML = '<option value="">Select an ambulance</option>';
      Object.keys(ambulancesMap).forEach(function(key) {
        const ambulance = ambulancesMap[key] || {};
        const option = document.createElement('option');
        option.value = key;
        const statusLabel = ambulance.status ? ` - ${formatStatusLabel(ambulance.status)}` : '';
        option.textContent = ambulance.name ? `${ambulance.name} (${key})${statusLabel}` : `${key}${statusLabel}`;
        // Prevent selecting ambulances that are not available
        const isAvailable = (ambulance.status || '').toUpperCase() === 'AVAILABLE';
        if (!isAvailable) {
          option.disabled = true;
          option.title = 'Ambulance is not available';
        }
        if (currentValue && currentValue === key) {
          option.selected = true;
        }
        manageVehicleSelect.appendChild(option);
      });
    }

    function sanitizeAmbulanceKey(value) {
      if (value === null || value === undefined) return '';
      return value.toString().trim();
    }

    function buildAmbulanceAssignmentPayload(reportId, raw, status) {
      raw = raw || {};
      // Handle multiple assigned responders (array) or single responder (backward compatibility)
      const assignedResponders = raw.assignedResponders || 
        (raw.assignedResponder ? [raw.assignedResponder] : 
        (raw.assignedResponderName ? [raw.assignedResponderName] : []));
      const assignedResponderUids = raw.assignedResponderUids || 
        (raw.assignedResponderUid ? [raw.assignedResponderUid] : []);
      const primaryResponder = assignedResponders.length > 0 ? assignedResponders[0] : '';
      
      const street = raw.street || raw.location || '';
      const landmark = raw.landmark || '';
      const barangay = raw.barangay || '';
      const defaultBarangay = 'Barangay 167 Caloocan city';
      const cleanStreet = String(street || '').trim();
      const cleanLandmark = String(landmark || '').trim();
      const cleanBarangay = String(barangay || '').trim();
      const isDefaultBarangay = cleanBarangay.toLowerCase() === defaultBarangay.toLowerCase();
      const addressParts = [cleanStreet, cleanLandmark].filter(function(part){ return part; });
      if (cleanBarangay && (!isDefaultBarangay || addressParts.length)) {
        addressParts.push(cleanBarangay);
      }
      const fullAddress = addressParts.length ? addressParts.join(', ') : 'N/A';

      // Get latitude and longitude
      const latitude = (function(){ const v = parseFloat(raw.latitude ?? raw.lat); return isFinite(v) ? v : null; })();
      const longitude = (function(){ const v = parseFloat(raw.longitude ?? raw.lng); return isFinite(v) ? v : null; })();

      return {
        id: reportId,
        type: raw.emergencyType || raw.type || 'General',
        description: raw.description || raw.desc || 'No description provided',
        address: fullAddress,
        street: cleanStreet, // Include street separately for location display
        landmark: raw.landmark || '',
        latitude: latitude,
        longitude: longitude,
        reporter: raw.userName || raw.reportedByName || raw.by || '',
        responder: primaryResponder,
        responderUid: assignedResponderUids.length > 0 ? assignedResponderUids[0] : null,
        responders: assignedResponders.length > 0 ? assignedResponders : collectResponders(raw),
        responderUids: assignedResponderUids.length > 0 ? assignedResponderUids : null,
        status: formatStatusLabel(status),
        timestamp: new Date().toISOString()
      };
    }

    async function updateAmbulanceRecordForReport(ambulanceId, updates) {
      const key = sanitizeAmbulanceKey(ambulanceId);
      if (!key || !databaseModule || !realtimeDb) return;
      const { ref, update } = databaseModule;
      await update(ref(realtimeDb, `ambulances/${key}`), updates);
    }

    async function assignAmbulanceToReport(ambulanceId, payload) {
      if (!ambulanceId || !payload) return;
      const actor = localStorage.getItem('iSagip_userUID') || 'staff';
      await updateAmbulanceRecordForReport(ambulanceId, {
        status: 'IN-USE',
        assignment: payload,
        assignmentId: payload.id || null,
        secondaryResponder: payload.responder || null,
        lastUpdated: Date.now(),
        lastUpdatedBy: actor
      });
    }

    async function releaseAmbulanceFromReport(ambulanceId) {
      if (!ambulanceId) return;
      const actor = localStorage.getItem('iSagip_userUID') || 'staff';
      await updateAmbulanceRecordForReport(ambulanceId, {
        status: 'AVAILABLE',
        assignment: null,
        assignmentId: null,
        secondaryResponder: null,
        lastUpdated: Date.now(),
        lastUpdatedBy: actor
      });
    }

    async function syncAmbulancesForReport(options) {
      if (!options) return;
      const previousVehicle = sanitizeAmbulanceKey(options.previousVehicle);
      const nextVehicle = sanitizeAmbulanceKey(options.nextVehicle);
      const status = (options.status || '').toLowerCase();
      const resolved = status === 'resolved';
      const relayed = status === 'relayed';
      const tasks = [];

      if (previousVehicle && (resolved || relayed || !nextVehicle || previousVehicle !== nextVehicle)) {
        tasks.push(releaseAmbulanceFromReport(previousVehicle));
      }

      if (!resolved && !relayed && nextVehicle) {
        const assignmentPayload = buildAmbulanceAssignmentPayload(
          options.reportId,
          options.reportData,
          options.status
        );
        tasks.push(assignAmbulanceToReport(nextVehicle, assignmentPayload));
      } else if ((resolved || relayed) && nextVehicle && !previousVehicle) {
        tasks.push(releaseAmbulanceFromReport(nextVehicle));
      }

      if (tasks.length) {
        try {
          await Promise.all(tasks);
        } catch (error) {
          console.error('Failed to synchronize ambulance assignment:', error);
        }
      }
    }

    /**
     * Notify responders that they have been dispatched to an emergency
     * Creates assignment entries in realtime database that mobile app can listen to
     */
    async function notifyRespondersOfDispatch(options) {
      if (!options || !options.responderUids || !databaseModule || !realtimeDb) {
        console.warn('notifyRespondersOfDispatch: Missing required parameters', { options, hasModule: !!databaseModule, hasDb: !!realtimeDb });
        return;
      }
      
      const { ref, set } = databaseModule;
      const { responderUids, reportId, reportData, assignedVehicle, note, dispatchedBy, dispatchedAt } = options;
      
      if (!responderUids || responderUids.length === 0) {
        console.warn('notifyRespondersOfDispatch: No responder UIDs provided');
        return;
      }
      
      console.log('Creating dispatch assignments:', {
        responderUids,
        reportId,
        assignedVehicle,
        dispatchedAt
      });
      
      try {
        // Create assignment notification for each responder
        const assignmentPromises = responderUids.map(async (responderUid) => {
          if (!responderUid || responderUid.trim() === '') {
            console.warn('Skipping invalid responder UID:', responderUid);
            return;
          }
          
          const assignmentId = `${reportId}_${responderUid}_${dispatchedAt}`;
          const assignmentPath = `assignments/${responderUid}/${assignmentId}`;
          
          const assignmentData = {
            assignmentId: assignmentId,
            reportId: reportId,
            responderUid: responderUid,
            status: 'pending', // pending, accepted, en_route, arrived, completed
            type: reportData.emergencyType || reportData.type || 'General',
            description: reportData.description || reportData.desc || 'No description provided',
            address: reportData.street || reportData.location || 'N/A',
            landmark: reportData.landmark || '',
            latitude: reportData.latitude || reportData.lat || null,
            longitude: reportData.longitude || reportData.lng || null,
            assignedVehicle: assignedVehicle || null,
            note: note || '',
            dispatchedBy: dispatchedBy || 'Staff',
            dispatchedAt: dispatchedAt,
            createdAt: dispatchedAt,
            updatedAt: dispatchedAt
          };
          
          console.log(`Creating assignment at path: ${assignmentPath}`, assignmentData);
          await set(ref(realtimeDb, assignmentPath), assignmentData);
          console.log(`Successfully created assignment for responder ${responderUid}`);
        });
        
        await Promise.all(assignmentPromises);
        console.log(`✅ Successfully dispatched ${responderUids.length} responder(s) to report ${reportId}`);
      } catch (error) {
        console.error('❌ Failed to notify responders of dispatch:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          responderUids,
          reportId
        });
      }
    }

    // Add event listener to status dropdown to toggle vehicle and responder dropdowns
    manageStatusSelect?.addEventListener('change', function() {
      toggleVehicleDropdown();
      toggleResponderDropdown();
    });

    manageModal?.addEventListener('click', function(event){
      if (event.target.matches('[data-close]')) {
        manageModal.hidden = true;
      }
    });

    manageForm?.addEventListener('submit', async function(event){
      event.preventDefault();
      if (!databaseModule || !realtimeDb) return;

      const reportId = manageReportIdInput.value;
      const raw = rawReports[reportId];
      if (!reportId || !raw) return;

      const { ref, update, push, set } = databaseModule;
      const now = Date.now();
      const actor = localStorage.getItem('iSagip_userUID') || 'staff';
      const newStatus = manageStatusSelect.value;
      // Prevent assignment if status is "relayed" or "resolved"
      const normalizedStatus = newStatus.toLowerCase();
      const assignmentBlocked = normalizedStatus === 'relayed' || normalizedStatus === 'resolved';
      const assignedVehicle = assignmentBlocked ? '' : manageVehicleInput.value.trim();
      
      // Get all selected responders from checkboxes
      let selectedResponderUids = assignmentBlocked
        ? []
        : Array.from(responderCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value)
            .filter(uid => uid && uid.trim() !== '');

      // Check if any selected responders are already assigned to active reports
      if (!assignmentBlocked && selectedResponderUids.length > 0) {
        const { get, ref: dbRef } = databaseModule;
        const reportsRef = dbRef(realtimeDb, 'reports');
        
        try {
          const reportsSnapshot = await get(reportsRef);
          const occupiedResponders = [];
          
          if (reportsSnapshot.exists()) {
            const reports = reportsSnapshot.val();
            const activeStatuses = ['received', 'assigned', 'accepted', 'responding', 'en_route', 'arrived'];
            
            // Check each report
            Object.keys(reports).forEach(reportKey => {
              // Skip the current report being edited
              if (reportKey === reportId) return;
              
              const report = reports[reportKey];
              const reportStatus = (report.status || '').toLowerCase();
              
              // Only check active reports (not resolved or relayed)
              if (activeStatuses.includes(reportStatus)) {
                const assignedUids = report.assignedResponderUids || 
                                   (report.assignedResponderUid ? [report.assignedResponderUid] : []);
                
                // Check if any selected responder is already assigned to this active report
                selectedResponderUids.forEach(selectedUid => {
                  if (assignedUids.includes(selectedUid)) {
                    const responderName = respondersMap[selectedUid]?.name || selectedUid;
                    const existingReportId = report.reportId || reportKey;
                    if (!occupiedResponders.find(r => r.uid === selectedUid)) {
                      occupiedResponders.push({
                        uid: selectedUid,
                        name: responderName,
                        reportId: existingReportId
                      });
                    }
                  }
                });
              }
            });
          }
          
          // Filter out occupied responders
          if (occupiedResponders.length > 0) {
            const occupiedNames = occupiedResponders.map(r => r.name).join(', ');
            const occupiedUids = occupiedResponders.map(r => r.uid);
            
            // Remove occupied responders from selection
            selectedResponderUids = selectedResponderUids.filter(uid => !occupiedUids.includes(uid));
            
            // Uncheck occupied responders in the UI
            occupiedUids.forEach(uid => {
              const checkbox = responderCheckboxesContainer.querySelector(`input[type="checkbox"][value="${uid}"]`);
              if (checkbox) {
                checkbox.checked = false;
              }
            });
            
            // Show warning message
            alert(`The following responder(s) are already assigned to an active report and cannot be assigned:\n\n${occupiedNames}\n\nThey have been removed from the selection.`);
            
            // If all responders were occupied, prevent submission
            if (selectedResponderUids.length === 0) {
              alert('No available responders selected. Please select responders who are not currently assigned to another active report.');
              return;
            }
          }
        } catch (error) {
          console.error('Error checking responder availability:', error);
          // Continue with assignment if check fails (don't block assignment due to check error)
        }
      }

      // Auto-set status to "assigned" when responders are selected while status is "received"
      let effectiveStatus = normalizedStatus;
      if (selectedResponderUids.length > 0 && normalizedStatus === 'received') {
        effectiveStatus = 'assigned';
      }
      
      const assignedResponderNames = selectedResponderUids
        .map(uid => {
          const responder = respondersMap[uid];
          if (!responder || !responder.name) return null;
          const responderType = responder.responderType || '';
          return responderType ? `${responder.name} (${responderType})` : responder.name;
        })
        .filter(name => name);

      const actorName = await resolveUserDisplayName(actor);

      const updates = {
        status: effectiveStatus,
        assignedVehicle: assignedVehicle || null,
        assignedResponders: assignedResponderNames.length > 0 ? assignedResponderNames : null,
        assignedResponderUids: selectedResponderUids.length > 0 ? selectedResponderUids : null,
        // Keep backward compatibility with single responder fields
        assignedResponder: assignedResponderNames.length > 0 ? assignedResponderNames[0] : null,
        assignedResponderUid: selectedResponderUids.length > 0 ? selectedResponderUids[0] : null,
        lastUpdatedAt: now,
        lastUpdatedBy: actorName,
        lastUpdatedByUid: actor
      };

      // Add dispatchedAt timestamp when responders are first assigned
      const wasAssigned = (raw.assignedResponderUids && raw.assignedResponderUids.length > 0) || raw.assignedResponderUid;
      const isNowAssigned = selectedResponderUids.length > 0 && (effectiveStatus === 'assigned' || effectiveStatus === 'accepted' || effectiveStatus === 'responding');
      if (isNowAssigned && !wasAssigned) {
        updates.dispatchedAt = now;
      }

      const wasResolved = (raw.status || '').toLowerCase() === 'resolved';
      const nowResolved = effectiveStatus === 'resolved';

      if (nowResolved && !wasResolved) {
        updates.closedBy = actorName;
        updates.closedByUid = actor;
        updates.closedAt = now;
      } else if (!nowResolved && wasResolved) {
        updates.closedBy = null;
        updates.closedByUid = null;
        updates.closedAt = null;
      }

      try {
        await update(ref(realtimeDb, `reports/${reportId}`), updates);

        const historyRef = push(ref(realtimeDb, `reports/${reportId}/history`));
        const changeDetails = [];
        if ((raw.status || 'received').toLowerCase() !== effectiveStatus) {
          changeDetails.push(`Status: ${formatStatusLabel(raw.status)} → ${formatStatusLabel(effectiveStatus)}`);
        }
        
        // Compare responder arrays
        const previousResponderUids = raw.assignedResponderUids || (raw.assignedResponderUid ? [raw.assignedResponderUid] : []);
        const previousResponderNames = raw.assignedResponders || (raw.assignedResponder ? [raw.assignedResponder] : []);
        const responderUidsChanged = JSON.stringify(previousResponderUids.sort()) !== JSON.stringify(selectedResponderUids.sort());
        
        if (responderUidsChanged) {
          const previousNamesStr = previousResponderNames.length > 0 ? previousResponderNames.join(', ') : 'None';
          const newNamesStr = assignedResponderNames.length > 0 ? assignedResponderNames.join(', ') : 'None';
          changeDetails.push(`Responders: "${previousNamesStr}" → "${newNamesStr}"`);
        }
        
        if ((raw.assignedVehicle || '') !== assignedVehicle) {
          changeDetails.push(`Vehicle: "${raw.assignedVehicle || 'None'}" → "${assignedVehicle || 'None'}"`);
        }

        await set(historyRef, {
          timestamp: now,
          actorUid: actor,
          actorName,
          action: 'update',
          details: changeDetails.join(' | ') || 'Report updated'
        });

        await syncAmbulancesForReport({
          previousVehicle: raw.assignedVehicle,
          nextVehicle: assignedVehicle,
          status: effectiveStatus,
          reportId,
          reportData: { ...raw, ...updates }
        });

        // Notify assigned responders about the dispatch
        // Create assignments when responders are assigned (not resolved/relayed)
        const shouldCreateAssignments = selectedResponderUids.length > 0 && 
                                       effectiveStatus !== 'resolved' && 
                                       effectiveStatus !== 'relayed' &&
                                       effectiveStatus !== 'received';
        
        // Check if responders were newly assigned (not just updated)
        // Reuse previousResponderUids from above (line 1291)
        const respondersChanged = JSON.stringify(previousResponderUids.sort()) !== JSON.stringify(selectedResponderUids.sort());
        
        // Create assignments for newly assigned responders
        if (shouldCreateAssignments && respondersChanged) {
          // Get newly assigned responders (ones that weren't in previous list)
          const newlyAssignedUids = selectedResponderUids.filter(uid => !previousResponderUids.includes(uid));
          
          if (newlyAssignedUids.length > 0) {
            console.log('Creating assignments for newly assigned responders:', newlyAssignedUids);
            await notifyRespondersOfDispatch({
              responderUids: newlyAssignedUids,
              reportId: reportId,
              reportData: { ...raw, ...updates },
              assignedVehicle: assignedVehicle,
              dispatchedBy: actorName,
              dispatchedAt: now
            });
          }
        }

        manageModal.hidden = true;
      } catch (error) {
        console.error('Error updating report:', error);
        alert('Failed to update report. Please try again.');
      }
    });

    function mapReport(id, raw) {
      const timestamp = Number(raw.timestamp) || Date.now();
      const closedAt = Number(raw.closedAt) || null;
      const lastUpdatedAt = Number(raw.lastUpdatedAt) || null;
      const status = (raw.status || '').toLowerCase();

      // Calculate response minutes
      let responseMinutes = null;
      if (typeof raw.responseTimeMinutes === 'number') {
        responseMinutes = raw.responseTimeMinutes;
      } else if (closedAt) {
        // Use closedAt if available
        responseMinutes = Math.round((closedAt - timestamp) / 60000);
      } else if ((status === 'resolved' || status === 'relayed') && lastUpdatedAt) {
        // For resolved/relayed reports without closedAt, use lastUpdatedAt as fallback
        responseMinutes = Math.round((lastUpdatedAt - timestamp) / 60000);
      }
      
      // Ensure responseMinutes is valid (not negative)
      if (responseMinutes !== null && responseMinutes < 0) {
        responseMinutes = null;
      }

      // Handle multiple responders (array) or single responder (backward compatibility)
      const assignedResponders = raw.assignedResponders || 
        (raw.assignedResponder ? [raw.assignedResponder] : []);
      const assignedResponderStr = assignedResponders.length > 0 
        ? assignedResponders.join(', ') 
        : '';

      // Resolve reportedBy - check multiple possible field names (case-insensitive check)
      let reportedBy = null;
      let reportedByUid = null;
      
      // Check all possible name field variations
      const nameFields = ['userName', 'reportedByName', 'by', 'reporterName', 'reportedBy', 
                          'reporter', 'user', 'reportedByUser', 'reporterUser', 'name',
                          'user_name', 'reported_by_name', 'reporter_name'];
      
      for (const field of nameFields) {
        if (raw[field] && raw[field] !== 'Unknown' && raw[field].trim() !== '') {
          reportedBy = raw[field];
          break;
        }
      }
      
      // Check all possible UID field variations
      const uidFields = ['userId', 'userUid', 'reportedByUid', 'reporterUid', 'reportedByUserId',
                        'userID', 'user_id', 'reported_by_uid', 'reporter_uid', 'uid',
                        'reporterId', 'reportedById'];
      
      for (const field of uidFields) {
        if (raw[field] && raw[field].trim() !== '') {
          reportedByUid = raw[field];
          break;
        }
      }
      
      // If we have userEmail but no name/UID, try to resolve from email
      const userEmail = raw.userEmail || raw.email || raw.user_email || null;
      if (!reportedBy && !reportedByUid && userEmail) {
        // Store email for async resolution
        reportedByUid = userEmail; // We'll use email to look up the user
      }
      
      // Debug: Always log reporter info for troubleshooting
      if (id && (!reportedBy || reportedBy === 'Unknown')) {
        console.log(`Report ${id} - Reporter Info:`, {
          reportedBy: reportedBy || 'NOT FOUND',
          reportedByUid: reportedByUid || 'NOT FOUND',
          availableFields: Object.keys(raw).filter(k => 
            k.toLowerCase().includes('user') || 
            k.toLowerCase().includes('report') || 
            k.toLowerCase().includes('by') ||
            k.toLowerCase().includes('name') ||
            k.toLowerCase().includes('uid') ||
            k.toLowerCase().includes('id')
          ),
          allFields: Object.keys(raw)
        });
      }

      return {
        id,
        type: raw.emergencyType || raw.type || 'General',
        description: raw.description || raw.desc || 'No description provided',
        status: raw.status || 'Received',
        assignedResponder: assignedResponderStr,
        assignedResponders: assignedResponders,
        assignedVehicle: raw.assignedVehicle || '',
        street: raw.street || 'N/A',
        landmark: raw.landmark || 'N/A',
        latitude: (function(){ const v = parseFloat(raw.latitude ?? raw.lat); return isFinite(v) ? v : null; })(),
        longitude: (function(){ const v = parseFloat(raw.longitude ?? raw.lng); return isFinite(v) ? v : null; })(),
        photo: raw.photoUri || raw.photoUrl || raw.photo || '',
        reportedBy: reportedBy || (reportedByUid ? 'Loading...' : 'Unknown'),
        reportedByUid: reportedByUid,
        closedBy: raw.closedBy || raw.closedByName || '',
        lastUpdatedBy: raw.lastUpdatedBy || raw.lastUpdatedByName || '',
        timestamp: new Date(timestamp).toLocaleString(),
        lastUpdatedAt: raw.lastUpdatedAt ? new Date(Number(raw.lastUpdatedAt)).toLocaleString() : '—',
        responseTime: typeof responseMinutes === 'number' ? `${responseMinutes} min` : '—',
        responseMinutes,
        rawTimestamp: timestamp,
      };
    }

    function formatStatusBadge(status) {
      const normalized = (status || '').toLowerCase();
      let color = '#3b82f6';
      if (normalized === 'resolved') color = '#10b981';
      else if (normalized === 'accepted' || normalized === 'responding' || normalized === 'relayed') color = '#f97316';
      else if (normalized === 'arrived' || normalized === 'assigned') color = '#3b82f6';
      else if (normalized === 'emergency') color = '#ef4444';
      return `<span class="status-badge" style="background: ${color}1a; color: ${color}; font-weight:600;">${formatStatusLabel(
        status
      )}</span>`;
    }

    async function resolveUserDisplayName(uidOrEmail){
      if (!uidOrEmail) return 'Unknown';
      
      // Check if it's an email address
      const isEmail = uidOrEmail.includes('@');
      
      try{
        const { doc, getDoc, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
        const db = window.iSagipDb;
        if (!db) return uidOrEmail;
        
        // If it's an email, search by email first
        if (isEmail) {
          // Search in residents collection
          const residentsQuery = query(collection(db, 'residents'), where('email', '==', uidOrEmail));
          const residentsSnapshot = await getDocs(residentsQuery);
          if (!residentsSnapshot.empty) {
            const data = residentsSnapshot.docs[0].data();
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName;
            if (name) return name;
          }
          
          // Search in staff collection
          const staffQuery = query(collection(db, 'staff'), where('email', '==', uidOrEmail));
          const staffSnapshot = await getDocs(staffQuery);
          if (!staffSnapshot.empty) {
            const data = staffSnapshot.docs[0].data();
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName;
            if (name) return name;
          }
          
          // Search in admin collection
          const adminQuery = query(collection(db, 'admin'), where('email', '==', uidOrEmail));
          const adminSnapshot = await getDocs(adminQuery);
          if (!adminSnapshot.empty) {
            const data = adminSnapshot.docs[0].data();
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName;
            if (name) return name;
          }
          
          // Search in responder collection (responders might close reports)
          const responderQuery = query(collection(db, 'responder'), where('email', '==', uidOrEmail));
          const responderSnapshot = await getDocs(responderQuery);
          if (!responderSnapshot.empty) {
            const data = responderSnapshot.docs[0].data();
            const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName || data.fullName;
            if (name) return name;
          }
          
          // If no name found, return email as fallback
          return uidOrEmail;
        }
        
        // If it's a UID, try direct lookup - check all collections
        const adminDoc = await getDoc(doc(db, 'admin', uidOrEmail));
        if (adminDoc.exists()) {
          const data = adminDoc.data();
          return `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName || uidOrEmail;
        }
        const staffDoc = await getDoc(doc(db, 'staff', uidOrEmail));
        if (staffDoc.exists()) {
          const data = staffDoc.data();
          return `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName || uidOrEmail;
        }
        const residentDoc = await getDoc(doc(db, 'residents', uidOrEmail));
        if (residentDoc.exists()) {
          const data = residentDoc.data();
          return `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName || uidOrEmail;
        }
        // Check responder collection (responders might close reports)
        const responderDoc = await getDoc(doc(db, 'responder', uidOrEmail));
        if (responderDoc.exists()) {
          const data = responderDoc.data();
          return `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName || data.fullName || uidOrEmail;
        }
      } catch (error){
        console.error('Failed to resolve user name for', uidOrEmail, error);
      }
      return uidOrEmail;
    }

    /**
     * Resolve reportedBy names for reports that have UIDs but no names
     */
    async function resolveReportedByNames(reports) {
      const reportsToResolve = reports.filter(r => 
        (!r.reportedBy || r.reportedBy === 'Unknown' || r.reportedBy === 'Loading...') && 
        r.reportedByUid
      );
      
      if (reportsToResolve.length === 0) {
        console.log('No reports need name resolution');
        return;
      }
      
      console.log(`Resolving names for ${reportsToResolve.length} report(s)`);
      
      // Resolve names for all reports that need it
      const resolutionPromises = reportsToResolve.map(async (report) => {
        try {
          const name = await resolveUserDisplayName(report.reportedByUid);
          if (name && name !== 'Unknown') {
            // Only update if we got a meaningful name (not the same as the UID/email)
            if (name !== report.reportedByUid) {
              report.reportedBy = name;
              console.log(`✅ Resolved reporter name for report ${report.id}: ${name}`);
            } else {
              // If name is same as email/UID, use it anyway (better than Unknown)
              report.reportedBy = name;
              console.log(`⚠️ Using email/UID as name for report ${report.id}: ${name}`);
            }
          } else {
            console.warn(`Could not resolve name for ${report.reportedByUid} in report ${report.id}`);
          }
        } catch (error) {
          console.error(`Error resolving name for report ${report.id}:`, error);
        }
      });
      
      await Promise.all(resolutionPromises);
      
      // Re-render reports after resolving names
      renderReports();
    }

    function formatStatusLabel(status) {
      if (!status) return 'Received';
      return status.toString().replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function escapeHtml(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function ensureFirebaseReady() {
      if (window.iSagipApp && window.iSagipDb) return Promise.resolve();
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50;
        const interval = setInterval(() => {
          if (window.iSagipApp && window.iSagipDb) {
            clearInterval(interval);
            resolve();
          } else if (attempts > maxAttempts) {
            clearInterval(interval);
            resolve();
          }
          attempts += 1;
        }, 200);
        window.addEventListener(
          'firebaseReady',
          () => {
            clearInterval(interval);
            resolve();
          },
          { once: true }
        );
      });
    }
  })();
})();
