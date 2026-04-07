/**
 * Reports History Module
 * Handles resolved reports history page functionality
 */

(function() {
  'use strict';

  const detailsModal = document.getElementById('modal-details');
  const detailsContent = document.getElementById('details-content');
  const REALTIME_DB_URL = 'https://isagip-752d1-default-rtdb.asia-southeast1.firebasedatabase.app';
  let realtimeDb = null;
  let databaseModule = null;
  let reports = [];
  let rawReports = {};
  let resolvedReports = [];

  init();

  async function init() {
    try {
      await ensureFirebaseReady();
      databaseModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
      realtimeDb = databaseModule.getDatabase(window.iSagipApp, REALTIME_DB_URL);

      const { ref, onValue } = databaseModule;
      const reportsRef = ref(realtimeDb, 'reports');

      onValue(
        reportsRef,
        async (snapshot) => {
          const value = snapshot.val() || {};
          rawReports = value;
          reports = Object.entries(value)
            .map(([id, data]) => mapReport(id, data))
            .sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

          // Resolve reportedBy names for reports that have UIDs or emails but no names
          await resolveReportedByNames(reports);

          renderResolvedReports();
        },
        (error) => {
          console.error('Realtime reports error:', error);
          const resolvedRows = document.getElementById('resolved-reports-rows');
          if (resolvedRows) {
            resolvedRows.innerHTML = `
              <div class="t-row">
                <div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:#ef4444;">
                  Unable to load reports. Please refresh the page.
                </div>
              </div>`;
          }
          const resolvedEmpty = document.getElementById('resolved-empty');
          if (resolvedEmpty) resolvedEmpty.style.display = 'none';
        }
      );

      setupFilters();
    } catch (error) {
      console.error('Failed to initialize reports history page:', error);
    }
  }

  /**
   * Render resolved reports history
   */
  function renderResolvedReports() {
    const resolvedRows = document.getElementById('resolved-reports-rows');
    const resolvedEmpty = document.getElementById('resolved-empty');
    if (!resolvedRows) return;

    // Get all resolved and relayed reports (these are excluded from main reports view)
    resolvedReports = reports.filter(r => {
      const status = (r.status || '').toLowerCase();
      return status === 'resolved' || status === 'relayed';
    });

    // Apply search filter
    const searchTerm = (document.getElementById('resolved-search')?.value || '').toLowerCase();
    let filtered = resolvedReports;
    if (searchTerm) {
      filtered = resolvedReports.filter(report => {
        const searchable = [
          report.id,
          report.type,
          report.description,
          report.reportedBy,
          report.closedBy,
          report.street
        ].join(' ').toLowerCase();
        return searchable.includes(searchTerm);
      });
    }

    // Sort by newest first
    filtered.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

    if (filtered.length === 0) {
      resolvedRows.innerHTML = '';
      if (resolvedEmpty) resolvedEmpty.style.display = 'block';
      return;
    }

    if (resolvedEmpty) resolvedEmpty.style.display = 'none';

    resolvedRows.innerHTML = filtered.map(report => {
      // Get closedAt from raw report data
      const rawReport = rawReports[report.id] || {};
      const closedAtTimestamp = rawReport.closedAt ? Number(rawReport.closedAt) : null;
      const closedAt = closedAtTimestamp 
        ? new Date(closedAtTimestamp).toLocaleString()
        : report.lastUpdatedAt || '—';
      
      // Recalculate response time if we have the raw data
      let responseTime = report.responseTime || '—';
      if (responseTime === '—' && closedAtTimestamp && report.rawTimestamp) {
        const minutes = Math.round((closedAtTimestamp - report.rawTimestamp) / 60000);
        if (minutes >= 0) {
          responseTime = `${minutes} min`;
        }
      }

      return `
        <div class="t-row" data-report-id="${report.id}">
          <div title="${report.id}">${report.id}</div>
          <div>${escapeHtml(report.type)}</div>
          <div>${escapeHtml(report.description)}</div>
          <div>${escapeHtml(report.street)}</div>
          <div>${escapeHtml(report.reportedBy || '—')}</div>
          <div>${escapeHtml(report.closedBy || '—')}</div>
          <div>${responseTime}</div>
          <div>${closedAt}</div>
          <div>
            <button class="btn btn-small btn-outline" data-action="view-resolved-report" data-id="${report.id}">
              View Details
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners to view buttons
    resolvedRows.querySelectorAll('[data-action="view-resolved-report"]').forEach(btn => {
      btn.addEventListener('click', function() {
        const reportId = this.getAttribute('data-id');
        const report = reports.find(r => r.id === reportId);
        if (report) {
          showReportDetails(report);
        }
      });
    });
  }

  /**
   * Export resolved reports to CSV (respects search filter)
   */
  function exportResolvedReportsToCSV() {
    // Get all resolved and relayed reports
    const allResolved = reports.filter(r => {
      const status = (r.status || '').toLowerCase();
      return status === 'resolved' || status === 'relayed';
    });

    // Apply search filter if active
    const searchTerm = (document.getElementById('resolved-search')?.value || '').toLowerCase();
    let filtered = allResolved;
    if (searchTerm) {
      filtered = allResolved.filter(report => {
        const searchable = [
          report.id,
          report.type,
          report.description,
          report.reportedBy,
          report.closedBy,
          report.street
        ].join(' ').toLowerCase();
        return searchable.includes(searchTerm);
      });
    }

    if (!filtered.length) {
      alert('No reports to export.');
      return;
    }

    // Sort by newest first (same as display)
    const sortedReports = filtered.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

    // Get closedAt from raw report data for each report
    const exportData = sortedReports.map(report => {
      const rawReport = rawReports[report.id] || {};
      const closedAtTimestamp = rawReport.closedAt ? Number(rawReport.closedAt) : null;
      const closedAt = closedAtTimestamp 
        ? new Date(closedAtTimestamp).toLocaleString()
        : report.lastUpdatedAt || '—';
      
      // Recalculate response time if needed
      let responseTime = report.responseTime || '—';
      if (responseTime === '—' && closedAtTimestamp && report.rawTimestamp) {
        const minutes = Math.round((closedAtTimestamp - report.rawTimestamp) / 60000);
        if (minutes >= 0) {
          responseTime = `${minutes} min`;
        }
      }

      return {
        id: report.id,
        type: report.type,
        description: (report.description || '').replace(/\n/g, ' ').replace(/"/g, '""'),
        status: formatStatusLabel(report.status),
        street: report.street || '',
        landmark: report.landmark || '',
        latitude: report.latitude != null ? report.latitude.toFixed(6) : '',
        longitude: report.longitude != null ? report.longitude.toFixed(6) : '',
        reportedBy: report.reportedBy || '',
        closedBy: report.closedBy || '',
        responseTime: responseTime,
        resolvedAt: closedAt,
        timestamp: report.timestamp
      };
    });

    // Create CSV headers
    const headers = [
      'ID',
      'Type',
      'Description',
      'Status',
      'Street',
      'Landmark',
      'Latitude',
      'Longitude',
      'Reported By',
      'Closed By',
      'Response Time',
      'Resolved At',
      'Reported At'
    ];

    // Create CSV rows
    const rows = exportData.map(r => [
      r.id,
      r.type,
      r.description,
      r.status,
      r.street,
      r.landmark,
      r.latitude,
      r.longitude,
      r.reportedBy,
      r.closedBy,
      r.responseTime,
      r.resolvedAt,
      r.timestamp
    ]);

    // Generate CSV content
    const csv = [headers].concat(rows).map(function(arr) {
      return arr.map(function(cell, index) {
        const val = cell === null || cell === undefined ? '' : String(cell);
        // Format ID column to prevent Excel from removing leading zeros
        // Prefix with tab character to force Excel to treat as text
        if (index === 0 && val) {
          return '="' + val.replace(/"/g, '""') + '"';
        }
        return /[",\n]/.test(val) ? '"' + val.replace(/"/g, '""') + '"' : val;
      }).join(',');
    }).join('\n');

    // Add UTF-8 BOM to prevent Excel from auto-converting data
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csv;

    // Download CSV file
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resolved_reports_history_export_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Setup event listeners
   */
  function setupFilters() {
    // Export CSV button
    document.getElementById('history-export-csv')?.addEventListener('click', function() {
      exportResolvedReportsToCSV();
    });

    // Search input
    document.getElementById('resolved-search')?.addEventListener('input', function() {
      renderResolvedReports();
    });

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

    // Modal close handlers
    detailsModal?.addEventListener('click', function(event){
      if (event.target.matches('[data-close]') || event.target === this) {
        this.hidden = true;
      }
    });
  }

  function showReportDetails(report) {
    if (!detailsModal || !detailsContent) return;

    // Populate report information fields
    const reportIdEl = document.getElementById('details-report-id');
    const statusEl = document.getElementById('details-status');
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
    const notesEl = document.getElementById('details-notes');

    if (reportIdEl) reportIdEl.value = report.id || 'N/A';
    if (statusEl) statusEl.value = formatStatusLabel(report.status) || 'N/A';
    if (typeEl) typeEl.value = escapeHtml(report.type) || 'N/A';
    if (descriptionEl) descriptionEl.value = escapeHtml(report.description) || 'N/A';
    if (streetEl) streetEl.value = escapeHtml(report.street) || 'N/A';
    if (landmarkEl) landmarkEl.value = escapeHtml(report.landmark) || 'N/A';
    
    const locationStr = (report.latitude != null && report.longitude != null)
      ? `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`
      : 'N/A';
    if (locationEl) locationEl.value = locationStr;
    
    if (reportedByEl) reportedByEl.value = escapeHtml(report.reportedBy || '—') || 'N/A';
    if (timestampEl) timestampEl.value = report.timestamp || 'N/A';
    if (responseTimeEl) responseTimeEl.value = report.responseTime || '—';
    if (closedByEl) closedByEl.value = escapeHtml(report.closedBy || '—');
    if (updatedByEl) updatedByEl.value = escapeHtml(report.lastUpdatedBy || '—');
    if (updatedAtEl) updatedAtEl.value = report.lastUpdatedAt || '—';
    if (notesEl) notesEl.value = escapeHtml(report.notes || '—');

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

  function mapReport(id, raw) {
    const timestamp = Number(raw.timestamp) || Date.now();
    const closedAt = Number(raw.closedAt) || null;
    const lastUpdatedAt = Number(raw.lastUpdatedAt) || null;

    // Calculate response time - use closedAt if available, otherwise lastUpdatedAt for resolved/relayed reports
    let responseMinutes = null;
    if (typeof raw.responseTimeMinutes === 'number') {
      responseMinutes = raw.responseTimeMinutes;
    } else if (closedAt && timestamp) {
      responseMinutes = Math.round((closedAt - timestamp) / 60000);
    } else {
      // For resolved/relayed reports without closedAt, use lastUpdatedAt
      const status = (raw.status || '').toLowerCase();
      if ((status === 'resolved' || status === 'relayed') && lastUpdatedAt && timestamp) {
        responseMinutes = Math.round((lastUpdatedAt - timestamp) / 60000);
      }
    }
    
    // Ensure responseMinutes is valid (not negative)
    if (responseMinutes !== null && responseMinutes < 0) {
      responseMinutes = null;
    }

    // Resolve reportedBy - check multiple possible field names
    let reportedBy = null;
    let reportedByUid = null;

    // Check all possible name field variations
    const nameFields = ['userName', 'reportedByName', 'by', 'reporterName', 'reportedBy', 
                        'reporter', 'user', 'reportedByUser', 'reporterUser', 'name',
                        'user_name', 'reported_by_name', 'reporter_name'];

    nameFields.forEach(function(field) {
      if (!reportedBy && raw[field] && raw[field] !== 'Unknown' && String(raw[field]).trim() !== '') {
        reportedBy = raw[field];
      }
    });

    // Check all possible UID/email field variations
    const uidFields = ['userId', 'userUid', 'reportedByUid', 'reporterUid', 'reportedByUserId',
                      'userID', 'user_id', 'reported_by_uid', 'reporter_uid', 'uid',
                      'reporterId', 'reportedById'];

    uidFields.forEach(function(field) {
      if (!reportedByUid && raw[field] && String(raw[field]).trim() !== '') {
        reportedByUid = raw[field];
      }
    });

    // If we have userEmail but no name/UID, use email for async resolution
    const userEmail = raw.userEmail || raw.email || raw.user_email || null;
    if (!reportedBy && !reportedByUid && userEmail) {
      reportedByUid = userEmail;
    }

    // Debug: log if we can't find reporter info
    if (!reportedBy && !reportedByUid && id) {
      console.warn(`History Report ${id} has no reporter name or UID. Available fields:`, Object.keys(raw));
    }

    // Resolve closedBy - for resolved/relayed reports, fall back to lastUpdatedBy if closedBy is not set
    const status = (raw.status || '').toLowerCase();
    const isResolvedOrRelayed = status === 'resolved' || status === 'relayed';
    
    let closedBy = raw.closedBy || raw.closedByName || '';
    let closedByUid = raw.closedByUid || null;
    
    // If closedBy is not set but report is resolved/relayed, use lastUpdatedBy as fallback
    if ((!closedBy || closedBy === '') && isResolvedOrRelayed) {
      closedBy = raw.lastUpdatedBy || raw.lastUpdatedByName || '';
      closedByUid = raw.lastUpdatedByUid || null;
    }
    
    // If we have a UID but no name, mark it for async resolution
    if ((!closedBy || closedBy === '') && closedByUid) {
      closedBy = 'Loading...';
    }

    return {
      id,
      type: raw.emergencyType || raw.type || 'General',
      description: raw.description || raw.desc || 'No description provided',
      status: raw.status || 'Received',
      street: raw.street || 'N/A',
      landmark: raw.landmark || 'N/A',
      latitude: (function(){ const v = parseFloat(raw.latitude ?? raw.lat); return isFinite(v) ? v : null; })(),
      longitude: (function(){ const v = parseFloat(raw.longitude ?? raw.lng); return isFinite(v) ? v : null; })(),
      photo: raw.photoUri || raw.photoUrl || raw.photo || '',
      reportedBy: reportedBy || (reportedByUid ? 'Loading...' : 'Unknown'),
      reportedByUid: reportedByUid,
      notes: raw.residentNotes || raw.notes || '',
      closedBy: closedBy || '',
      closedByUid: closedByUid,
      lastUpdatedBy: raw.lastUpdatedBy || raw.lastUpdatedByName || '',
      timestamp: new Date(timestamp).toLocaleString(),
      lastUpdatedAt: raw.lastUpdatedAt ? new Date(Number(raw.lastUpdatedAt)).toLocaleString() : '—',
      responseTime: typeof responseMinutes === 'number' ? `${responseMinutes} min` : '—',
      responseMinutes,
      rawTimestamp: timestamp,
    };
  }

  /**
   * Resolve user display name from UID or email (shared logic with reports page)
   */
  async function resolveUserDisplayName(uidOrEmail){
    if (!uidOrEmail) return 'Unknown';

    const isEmail = String(uidOrEmail).includes('@');

    try{
      const { doc, getDoc, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
      const db = window.iSagipDb;
      if (!db) return uidOrEmail;

      if (isEmail) {
        // Search residents by email
        const residentsQuery = query(collection(db, 'residents'), where('email', '==', uidOrEmail));
        const residentsSnapshot = await getDocs(residentsQuery);
        if (!residentsSnapshot.empty) {
          const data = residentsSnapshot.docs[0].data();
          const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName;
          if (name) return name;
        }

        // Search staff by email
        const staffQuery = query(collection(db, 'staff'), where('email', '==', uidOrEmail));
        const staffSnapshot = await getDocs(staffQuery);
        if (!staffSnapshot.empty) {
          const data = staffSnapshot.docs[0].data();
          const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName;
          if (name) return name;
        }

        // Search admin by email
        const adminQuery = query(collection(db, 'admin'), where('email', '==', uidOrEmail));
        const adminSnapshot = await getDocs(adminQuery);
        if (!adminSnapshot.empty) {
          const data = adminSnapshot.docs[0].data();
          const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName;
          if (name) return name;
        }

        // Search responder by email (responders might close reports)
        const responderQuery = query(collection(db, 'responder'), where('email', '==', uidOrEmail));
        const responderSnapshot = await getDocs(responderQuery);
        if (!responderSnapshot.empty) {
          const data = responderSnapshot.docs[0].data();
          const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.lastName || data.firstName || data.fullName;
          if (name) return name;
        }

        // Fallback to email
        return uidOrEmail;
      }

      // UID lookup - check all collections
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
      console.error('Failed to resolve user name for history report', uidOrEmail, error);
    }
    return uidOrEmail;
  }

  /**
   * Resolve reportedBy and closedBy names for history reports that have UIDs/emails but no names
   */
  async function resolveReportedByNames(historyReports) {
    const reportsToResolve = historyReports.filter(r => 
      ((!r.reportedBy || r.reportedBy === 'Unknown' || r.reportedBy === 'Loading...') && r.reportedByUid) ||
      ((!r.closedBy || r.closedBy === 'Loading...' || r.closedBy === '') && r.closedByUid)
    );

    if (reportsToResolve.length === 0) {
      return;
    }

    console.log(`Resolving names for ${reportsToResolve.length} history report(s)`);

    // Resolve names for all reports that need it
    const resolutionPromises = reportsToResolve.map(async (report) => {
      try {
        // Resolve reportedBy
        if ((!report.reportedBy || report.reportedBy === 'Unknown' || report.reportedBy === 'Loading...') && report.reportedByUid) {
          const name = await resolveUserDisplayName(report.reportedByUid);
          if (name && name !== 'Unknown') {
            report.reportedBy = name;
            console.log(`✅ Resolved reportedBy for report ${report.id}: ${name}`);
          }
        }
        
        // Resolve closedBy
        if ((!report.closedBy || report.closedBy === 'Loading...' || report.closedBy === '') && report.closedByUid) {
          const name = await resolveUserDisplayName(report.closedByUid);
          if (name && name !== 'Unknown') {
            report.closedBy = name;
            console.log(`✅ Resolved closedBy for report ${report.id}: ${name}`);
          }
        }
      } catch (error) {
        console.error(`Error resolving name for history report ${report.id}:`, error);
      }
    });

    await Promise.all(resolutionPromises);

    // Re-render resolved reports after resolving names
    renderResolvedReports();
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
