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
    let filtered = resolvedReports.filter(report => {
      if (!searchTerm) return true;
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

    // Apply date range filter
    const dateFrom = document.getElementById('resolved-date-from')?.value;
    const dateTo = document.getElementById('resolved-date-to')?.value;
    if (dateFrom || dateTo) {
      filtered = filtered.filter(report => {
        const reportDate = new Date(report.rawTimestamp);
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (reportDate < fromDate) return false;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (reportDate > toDate) return false;
        }
        return true;
      });
    }

    // Apply sorting
    const sortBy = document.getElementById('resolved-sort')?.value || 'newest';
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return (a.rawTimestamp || 0) - (b.rawTimestamp || 0);
        case 'response-time':
          return (a.responseMinutes || Infinity) - (b.responseMinutes || Infinity);
        case 'response-time-slow':
          return (b.responseMinutes || -Infinity) - (a.responseMinutes || -Infinity);
        case 'newest':
        default:
          return (b.rawTimestamp || 0) - (a.rawTimestamp || 0);
      }
    });

    if (filtered.length === 0) {
      resolvedRows.innerHTML = '';
      if (resolvedEmpty) resolvedEmpty.style.display = 'block';
      return;
    }

    if (resolvedEmpty) resolvedEmpty.style.display = 'none';

    resolvedRows.innerHTML = filtered.map(report => {
      const closedAt = rawReports[report.id]?.closedAt 
        ? new Date(Number(rawReports[report.id].closedAt)).toLocaleString()
        : report.lastUpdatedAt || '—';

      return `
        <div class="t-row" data-report-id="${report.id}">
          <div title="${report.id}">${report.id}</div>
          <div>${escapeHtml(report.type)}</div>
          <div>${escapeHtml(report.description)}</div>
          <div>${escapeHtml(report.street)}</div>
          <div>${escapeHtml(report.reportedBy)}</div>
          <div>${escapeHtml(report.closedBy || '—')}</div>
          <div>${report.responseTime || '—'}</div>
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
   * Setup event listeners for filters and search
   */
  function setupFilters() {
    // Search input
    document.getElementById('resolved-search')?.addEventListener('input', function() {
      renderResolvedReports();
    });

    // Sort dropdown
    document.getElementById('resolved-sort')?.addEventListener('change', function() {
      renderResolvedReports();
    });

    // Date filters
    document.getElementById('resolved-date-from')?.addEventListener('change', function() {
      renderResolvedReports();
    });

    document.getElementById('resolved-date-to')?.addEventListener('change', function() {
      renderResolvedReports();
    });

    // Clear filters button
    document.getElementById('resolved-clear-filters')?.addEventListener('click', function() {
      const searchInput = document.getElementById('resolved-search');
      const sortSelect = document.getElementById('resolved-sort');
      const dateFrom = document.getElementById('resolved-date-from');
      const dateTo = document.getElementById('resolved-date-to');

      if (searchInput) searchInput.value = '';
      if (sortSelect) sortSelect.value = 'newest';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';

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
    
    if (reportedByEl) reportedByEl.value = escapeHtml(report.reportedBy) || 'N/A';
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

    const responseMinutes =
      typeof raw.responseTimeMinutes === 'number'
        ? raw.responseTimeMinutes
        : closedAt
        ? Math.round((closedAt - timestamp) / 60000)
        : null;

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
      closedBy: raw.closedBy || raw.closedByName || '',
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

        // Fallback to email
        return uidOrEmail;
      }

      // UID lookup
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
    } catch (error){
      console.error('Failed to resolve user name for history report', uidOrEmail, error);
    }
    return uidOrEmail;
  }

  /**
   * Resolve reportedBy names for history reports that have UIDs/emails but no names
   */
  async function resolveReportedByNames(historyReports) {
    const reportsToResolve = historyReports.filter(r => 
      (!r.reportedBy || r.reportedBy === 'Unknown' || r.reportedBy === 'Loading...') && 
      r.reportedByUid
    );

    if (reportsToResolve.length === 0) {
      return;
    }

    // Resolve names for all reports that need it
    const resolutionPromises = reportsToResolve.map(async (report) => {
      try {
        const name = await resolveUserDisplayName(report.reportedByUid);
        if (name && name !== 'Unknown') {
          report.reportedBy = name;
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
