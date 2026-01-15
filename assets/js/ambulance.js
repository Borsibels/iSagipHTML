/**
 * Ambulance Module
 * Handles ambulance status page functionality, realtime updates, and vehicle management
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

  function normalizeResponderEntries(value) {
    var entries = [];
    var addEntry = function(item) {
      if (!item) return;
      if (typeof item === 'object') {
        var name = item.name || item.displayName || item.responderName || '';
        var id = item.id || item.uid || item.responderId || name;
        if (name || id) entries.push({ id: String(id || name || '').trim(), name: String(name || id || '').trim() });
      } else {
        var str = String(item).trim();
        if (str) entries.push({ id: str, name: str });
      }
    };

    if (Array.isArray(value)) {
      value.forEach(addEntry);
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach(function(key){ addEntry(value[key]); });
    } else if (value) {
      String(value).trim().split(',').map(function(x){ return x.trim(); }).forEach(function(name){
        if (name) entries.push({ id: name, name: name });
      });
    }

    return entries;
  }

  // ========================================
  // AMBULANCE STATUS PAGE FUNCTIONALITY
  // ========================================

  /**
   * Ambulance status page logic
   * Handles ambulance status display and updates (UI only - data from backend)
   */
  (function setupAmbulance(){
    var grid = document.getElementById('ambulance-grid');
    if (!grid) return;

    var stats = {
      total: document.getElementById('amb-total'),
      available: document.getElementById('amb-available'),
      inUse: document.getElementById('amb-inuse'),
      maintenance: document.getElementById('amb-maintenance')
    };

    var REALTIME_DB_URL = 'https://isagip-752d1-default-rtdb.asia-southeast1.firebasedatabase.app';
    var databaseModule = null;
    var realtimeDb = null;
    var ambulances = [];
    var rawAmbulances = {};
    var responderLocations = {}; // keyed by responder uid -> {lat,lng,updatedAt,name}

    var ambulanceModal = document.getElementById('ambulance-modal');
    var ambulanceForm = document.getElementById('ambulance-form');
    var ambFormTitle = document.getElementById('amb-form-title');
    var ambLocationInput = document.getElementById('amb-location');
    var ambReportIdInput = document.getElementById('amb-report-id');
    var ambReportTypeInput = document.getElementById('amb-report-type');
    var ambReportAddressInput = document.getElementById('amb-report-address');
    var ambReportDestinationInput = document.getElementById('amb-report-destination');
    var ambMaintNoteInput = document.getElementById('amb-maint-note');
    var ambMaintEtaInput = document.getElementById('amb-maint-eta');
    var ambResponderDropdown = document.getElementById('amb-responders-dropdown');
    var ambResponderList = document.getElementById('amb-responders-list');

    function badge(status){
      var color = status === 'AVAILABLE' ? '#16a34a' : status === 'IN-USE' ? '#f59e0b' : '#ef4444';
      return '<span class="amb-badge" style="color:'+color+'">'+status+'</span>';
    }

    function statusClass(status) {
      if (status === 'AVAILABLE') return 'status-available';
      if (status === 'IN-USE') return 'status-in-use';
      return 'status-maintenance';
    }

    function formatTimestamp(ts) {
      if (!ts) return '—';
      try {
        return new Date(ts).toLocaleString();
      } catch (e) {
        return '—';
      }
    }

    function formatInputDateTime(ts) {
      if (!ts) return '';
      var date = new Date(ts);
      if (isNaN(date.getTime())) return '';
      var pad = function(num) {
        return String(num).padStart(2, '0');
      };
      return (
        date.getFullYear() +
        '-' +
        pad(date.getMonth() + 1) +
        '-' +
        pad(date.getDate()) +
        'T' +
        pad(date.getHours()) +
        ':' +
        pad(date.getMinutes())
      );
    }

    function mapAmbulance(id, raw) {
      if (!raw || typeof raw !== 'object') raw = {};
      var assignment = raw.assignment || null;
      var status = (raw.status || 'AVAILABLE').toUpperCase();
      var reportId = assignment?.id || raw.assignmentId || null;
      
      // Find responders assigned to this ambulance's report
      var assignedResponders = [];
      var responderLocation = null;
      if (reportId && responderLocations) {
        Object.keys(responderLocations).forEach(function(responderId) {
          var responder = responderLocations[responderId];
          if (responder) {
            // Match by reportId (handle different formats - normalize both for comparison)
            var responderReportId = (responder.reportId || '').toString().trim();
            var normalizedReportId = (reportId || '').toString().trim();
            var matches = responderReportId === normalizedReportId || 
                         (responderReportId && normalizedReportId && (
                           responderReportId.includes(normalizedReportId) || 
                           normalizedReportId.includes(responderReportId)
                         ));
            
            if (matches) {
              assignedResponders.push({
                id: responderId,
                responderId: responder.responderId || responderId,
                name: responder.name || responderId,
                lat: responder.lat,
                lng: responder.lng,
                status: responder.status,
                updatedAt: responder.updatedAt
              });
              
              // Use first responder's location for ambulance location
              if (!responderLocation && responder.lat && responder.lng) {
                responderLocation = responder.lat + ', ' + responder.lng;
              }
            }
          }
        });
      }
      
      // Update location from responder if available
      var finalLocation = raw.location || 'Central Station Garage';
      if (responderLocation) {
        finalLocation = responderLocation;
      } else if (assignment && assignment.address) {
        finalLocation = assignment.address;
      }
      
      // Use assigned responders if found, otherwise fall back to existing logic
      var responderEntries = assignedResponders.length > 0 
        ? assignedResponders 
        : normalizeResponderEntries(assignment?.responders || raw.responders);
      var responderList = responderEntries.length 
        ? responderEntries.map(function(r){ return r.name || r.id; }) 
        : collectResponders({ assignment: assignment, responders: raw.responders, secondaryResponder: raw.secondaryResponder });

      return {
        id: id,
        name: raw.name || ('Ambulance ' + id),
        callsign: raw.callsign || '',
        status: status,
        location: finalLocation,
        crewLead: '', // deprecated; using responders instead
        secondaryResponder: raw.secondaryResponder || raw.otherResponder || '',
        assignment: assignment,
        assignmentId: raw.assignmentId || (assignment && assignment.id) || null,
        maintenanceNote: raw.maintenanceNote || '',
        maintenanceEta: raw.maintenanceEta || null,
        responders: responderList,
        responderEntries: responderEntries,
        lastUpdated: raw.lastUpdated || raw.updatedAt || null
      };
    }

    function renderAssignment(amb) {
      var assignment = amb.assignment || null;
      var reportId = assignment?.id || amb.assignmentId;
      if (!assignment && !amb.assignmentId) return '';
      var typeLabel = assignment?.type || 'Emergency Dispatch';
      var address = assignment?.address || '';
      var responderEntries = Array.isArray(amb.responderEntries) && amb.responderEntries.length
        ? amb.responderEntries
        : (Array.isArray(amb.responders) ? amb.responders.map(function(name){ return { id: name, name: name }; }) : []);
      var responders = responderEntries.map(function(r){ return r.name || r.id; });
      var primaryResponder = responderEntries[0];
      var primaryLoc = null;
      if (primaryResponder && primaryResponder.id && responderLocations[primaryResponder.id]) {
        primaryLoc = responderLocations[primaryResponder.id];
      } else if (primaryResponder && responderLocations[primaryResponder.responderId]) {
        primaryLoc = responderLocations[primaryResponder.responderId];
      }

      return (
        '<div class="amb-assignment">'+
          '<div class="amb-assignment-header">'+
            '<span>Assigned to Report</span>'+
            '<span class="amb-pill">'+typeLabel+'</span>'+
          '</div>'+
          '<p><strong>Report ID:</strong> '+(reportId || 'Pending')+'</p>'+
          (address ? '<p><strong>Location:</strong> '+address+'</p>' : '')+
          '<details class="amb-responders">'+
            '<summary>Responders'+(responders.length ? ' ('+responders.length+')' : '')+'</summary>'+
            '<ul>'+
              (
                responders.length
                  ? responderEntries.map(function(r){ 
                      var responder = responderLocations[r.id] || responderLocations[r.responderId];
                      var statusBadge = responder && responder.status ? '<span style="font-size:11px;color:#64748b;"> ('+responder.status+')</span>' : '';
                      return '<li>'+(r.name || r.id)+statusBadge+'</li>'; 
                    }).join('')
                  : '<li class="muted">No responders recorded</li>'
              )+
            '</ul>'+
          '</details>'+
          (assignment?.responder ? '<p><strong>Second Responder:</strong> '+assignment.responder+'</p>' : '')+
        '</div>'
      );
    }

    function renderMaintenance(amb) {
      if (amb.status !== 'MAINTENANCE') return '';
      var note = amb.maintenanceNote || 'Routine inspection';
      var eta = amb.maintenanceEta ? formatTimestamp(amb.maintenanceEta) : 'TBD';
      return (
        '<div class="amb-maintenance">'+
          '<strong>Maintenance in progress</strong>'+
          '<div>'+note+'</div>'+
          '<div><strong>Estimated back:</strong> '+eta+'</div>'+
        '</div>'
      );
    }

    function updateSummary() {
      var total = ambulances.length;
      var available = ambulances.filter(function(a){ return a.status === 'AVAILABLE'; }).length;
      var inUse = ambulances.filter(function(a){ return a.status === 'IN-USE'; }).length;
      var maintenance = ambulances.filter(function(a){ return a.status === 'MAINTENANCE'; }).length;

      if (stats.total) stats.total.textContent = total;
      if (stats.available) stats.available.textContent = available;
      if (stats.inUse) stats.inUse.textContent = inUse;
      if (stats.maintenance) stats.maintenance.textContent = maintenance;
    }

    function render(){
      updateSummary();
      if (ambulances.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:2rem;color:#64748b;">No ambulances available. Data will be loaded from database.</div>';
        return;
      }
      
      grid.innerHTML = ambulances.map(function(a){
        return (
          '<div class="ambulance-card '+statusClass(a.status)+'" data-id="'+a.id+'">'+
            '<div>'+
              '<div class="amb-title">'+a.name+(a.callsign ? ' <span class="amb-subtitle">'+a.callsign+'</span>' : '')+'</div>'+
              '<div class="amb-status">Status: '+badge(a.status)+'</div>'+
            '</div>'+
            (a.location?'<div class="amb-meta"><span>Location:</span> '+a.location+(a.assignmentId? ' <small>(Report '+a.assignmentId+')</small>':'' )+'</div>':'')+
            (a.crewLead?'<div class="amb-meta"><span>Crew Lead:</span> '+a.crewLead+'</div>':'')+
            (a.secondaryResponder?'<div class="amb-meta"><span>Second Responder:</span> '+a.secondaryResponder+'</div>':'')+
            '<div class="amb-meta"><span>Last Update:</span> '+formatTimestamp(a.lastUpdated)+'</div>'+
            renderAssignment(a)+
            renderMaintenance(a)+
            '<div class="amb-actions">'+
              '<button class="amb-btn amb-manage">VIEW / UPDATE DETAILS</button>'+
              '<button class="amb-btn set-available">MARK AVAILABLE</button>'+
              '<button class="amb-btn set-maint">MARK MAINTENANCE</button>'+
            '</div>'+
          '</div>'
        );
      }).join('');
    }
    
    render();

    // Handle status change buttons
    grid.addEventListener('click', async function(e){
      var card = e.target.closest('.ambulance-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      var amb = ambulances.find(function(x){return String(x.id)===String(id);});
      if (!amb) return;
      
      if (e.target.classList.contains('amb-manage')) {
        openAmbulanceModal(amb);
        return;
      }
      var newStatus = null;
      
      if (e.target.classList.contains('set-available')) {
        newStatus = 'AVAILABLE';
      } else if (e.target.classList.contains('set-maint')) {
        newStatus = 'MAINTENANCE';
      }
      if (!newStatus || amb.status === newStatus) return;

      try {
        await persistAmbulanceStatus(amb.id, newStatus);
      } catch (error) {
        console.error('Failed to update ambulance status:', error);
        alert('Unable to update ambulance status. Please try again.');
      }
    });
    
    async function persistAmbulanceStatus(id, status) {
      if (!databaseModule || !realtimeDb) {
        throw new Error('Realtime database not ready');
      }
      var actor = localStorage.getItem('iSagip_userUID') || 'staff';
      var updates = {
        status: status,
        lastUpdated: Date.now(),
        lastUpdatedBy: actor
      };
      if (status !== 'IN-USE') {
        updates.assignment = null;
        updates.assignmentId = null;
      }
      return updateAmbulanceRecord(id, updates);
    }

    async function persistAmbulanceDetails(id, formValues) {
      if (!databaseModule || !realtimeDb) {
        throw new Error('Realtime database not ready');
      }
      var actor = localStorage.getItem('iSagip_userUID') || 'staff';
      var updates = Object.assign({}, formValues, {
        lastUpdated: Date.now(),
        lastUpdatedBy: actor
      });
      return updateAmbulanceRecord(id, updates);
    }

    function updateAmbulanceRecord(id, updates) {
      var ref = databaseModule.ref;
      var update = databaseModule.update;
      return update(ref(realtimeDb, 'ambulances/' + id), updates);
    }

    function waitForFirebaseApp() {
      if (window.iSagipApp) return Promise.resolve();
      return new Promise(function(resolve) {
        var attempts = 0;
        var maxAttempts = 50;
        var interval = setInterval(function() {
          if (window.iSagipApp) {
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
          function handleReady() {
            clearInterval(interval);
            window.removeEventListener('firebaseReady', handleReady);
            resolve();
          },
          { once: true }
        );
      });
    }

    async function initializeAmbulanceRealtime() {
      try {
        await waitForFirebaseApp();
        databaseModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
        var getDatabase = databaseModule.getDatabase;
        var ref = databaseModule.ref;
        var onValue = databaseModule.onValue;
        realtimeDb = getDatabase(window.iSagipApp, REALTIME_DB_URL);
        var ambulancesRef = ref(realtimeDb, 'ambulances');
        onValue(
          ambulancesRef,
          function(snapshot) {
            var value = snapshot.val() || {};
            rawAmbulances = value;
            ambulances = Object.keys(value).map(function(key) {
              return mapAmbulance(key, value[key]);
            });
            render();
          },
          function(error) {
            console.error('Ambulance realtime error:', error);
          }
        );

        // Subscribe to responder data (responders/{responderId} structure)
        var respondersRef = ref(realtimeDb, 'responders');
        onValue(
          respondersRef,
          function(snapshot) {
            var value = snapshot.val() || {};
            // Transform responders data structure: responders/{responderId} -> {responderId: {lat, lng, name, reportId, status, ...}}
            responderLocations = {};
            if (value) {
              Object.keys(value).forEach(function(responderId) {
                var responder = value[responderId];
                if (responder) {
                  responderLocations[responderId] = {
                    lat: responder.lat,
                    lng: responder.lng,
                    name: responder.name || '',
                    reportId: responder.reportId || '',
                    responderId: responder.responderId || responderId,
                    status: responder.status || '',
                    updatedAt: responder.updatedAt || null
                  };
                }
              });
            }
            // Re-map ambulances so responder matches/locations are included in the cards
            ambulances = Object.keys(rawAmbulances).map(function(key) {
              return mapAmbulance(key, rawAmbulances[key] || {});
            });
            render();
          },
          function(error) {
            console.error('Responders realtime error:', error);
          }
        );
      } catch (error) {
        console.error('Failed to initialize ambulance realtime data:', error);
      }
    }

    initializeAmbulanceRealtime();

    function openAmbulanceModal(amb) {
      if (!ambulanceModal || !ambulanceForm) return;
      ambulanceModal.dataset.ambId = amb.id;
      if (ambFormTitle) ambFormTitle.textContent = amb.name + ' Details';
      var assignment = amb.assignment || {};
      // Update location from responder if available
      var displayLocation = amb.location || '';
      var reportId = assignment.id || amb.assignmentId || null;
      if (reportId && responderLocations) {
        var normalizedReportId = (reportId || '').toString().trim();
        // Find responder for this report
        Object.keys(responderLocations).forEach(function(responderId) {
          var responder = responderLocations[responderId];
          if (responder) {
            var responderReportId = (responder.reportId || '').toString().trim();
            var matches = responderReportId === normalizedReportId || 
                         (responderReportId && normalizedReportId && (
                           responderReportId.includes(normalizedReportId) || 
                           normalizedReportId.includes(responderReportId)
                         ));
            if (matches && responder.lat && responder.lng) {
              displayLocation = responder.lat + ', ' + responder.lng;
            }
          }
        });
      }
      if (ambLocationInput) ambLocationInput.value = displayLocation;
      if (ambReportIdInput) ambReportIdInput.value = (assignment.id || amb.assignmentId || '') || '';
      if (ambReportTypeInput) ambReportTypeInput.value = assignment.type || '';
      if (ambReportAddressInput) ambReportAddressInput.value = assignment.address || '';
      if (ambMaintNoteInput) ambMaintNoteInput.value = amb.maintenanceNote || '';
      if (ambMaintEtaInput) ambMaintEtaInput.value = formatInputDateTime(amb.maintenanceEta);
      if (ambResponderList) {
        // Get reportId to find matching responders
        var reportId = assignment.id || amb.assignmentId || null;
        var matchedResponders = [];
        
        // Find responders by reportId
        if (reportId && responderLocations) {
          var normalizedReportId = (reportId || '').toString().trim();
          Object.keys(responderLocations).forEach(function(responderId) {
            var responder = responderLocations[responderId];
            if (responder) {
              var responderReportId = (responder.reportId || '').toString().trim();
              var matches = responderReportId === normalizedReportId || 
                           (responderReportId && normalizedReportId && (
                             responderReportId.includes(normalizedReportId) || 
                             normalizedReportId.includes(responderReportId)
                           ));
              if (matches) {
                matchedResponders.push({
                  id: responderId,
                  responderId: responder.responderId || responderId,
                  name: responder.name || responderId,
                  lat: responder.lat,
                  lng: responder.lng,
                  status: responder.status,
                  updatedAt: responder.updatedAt
                });
              }
            }
          });
        }
        
        // Fall back to existing responderEntries if no matches found
        var responderEntries = matchedResponders.length > 0
          ? matchedResponders
          : (Array.isArray(amb.responderEntries) && amb.responderEntries.length
              ? amb.responderEntries
              : (Array.isArray(assignment.responders) ? normalizeResponderEntries(assignment.responders) : []));
        
        var responderList = responderEntries.map(function(r){ return r.name || r.id; });
        var primaryResponder = responderEntries[0];
        var primaryLoc = null;
        if (primaryResponder) {
          primaryLoc = responderLocations[primaryResponder.id] || 
                      responderLocations[primaryResponder.responderId] ||
                      (primaryResponder.lat && primaryResponder.lng ? primaryResponder : null);
        }
        ambResponderList.innerHTML = responderList.length
          ? responderEntries.map(function(r){ 
              var responder = responderLocations[r.id] || 
                             responderLocations[r.responderId] || 
                             (r.lat && r.lng ? r : null);
              var statusInfo = responder && responder.status ? ' <span style="color:#64748b;font-size:11px;">('+responder.status+')</span>' : '';
              return '<li>'+(r.name || r.id || 'Unknown')+statusInfo+'</li>'; 
            }).join('')
          : '<li class="muted">No responders recorded</li>';
      }
      if (ambResponderDropdown) {
        ambResponderDropdown.open = false;
      }
      ambulanceModal.hidden = false;
    }

    function closeAmbulanceModal() {
      if (ambulanceModal) {
        ambulanceModal.hidden = true;
        delete ambulanceModal.dataset.ambId;
      }
      if (ambulanceForm) {
        ambulanceForm.reset();
      }
    }

    if (ambulanceModal) {
      ambulanceModal.addEventListener('click', function(e) {
        if (e.target === ambulanceModal || e.target.hasAttribute('data-close')) {
          closeAmbulanceModal();
        }
      });
    }

    ambulanceForm?.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!ambulanceModal?.dataset.ambId) return;
      var id = ambulanceModal.dataset.ambId;
      var current = ambulances.find(function(a){ return String(a.id) === String(id); }) || {};
      var maintenanceEtaValue = ambMaintEtaInput?.value ? Date.parse(ambMaintEtaInput.value) : null;
      var updates = {
        maintenanceNote: ambMaintNoteInput?.value.trim() || '',
        maintenanceEta: maintenanceEtaValue || null
      };

      try {
        await persistAmbulanceDetails(id, updates);
        closeAmbulanceModal();
      } catch (error) {
        console.error('Failed to save ambulance details:', error);
        alert('Unable to save ambulance details. Please try again.');
      }
    });

    // Add Vehicle functionality
    var addVehicleBtn = document.getElementById('add-vehicle-btn');
    var addVehicleModal = document.getElementById('add-vehicle-modal');
    var addVehicleForm = document.getElementById('add-vehicle-form');
    var addVehicleNameInput = document.getElementById('add-vehicle-name');
    var addVehicleCallsignInput = document.getElementById('add-vehicle-callsign');
    var addVehicleLocationInput = document.getElementById('add-vehicle-location');
    var addVehicleStatusInput = document.getElementById('add-vehicle-status');

    function openAddVehicleModal() {
      if (addVehicleModal) {
        addVehicleModal.hidden = false;
        if (addVehicleForm) addVehicleForm.reset();
        if (addVehicleLocationInput) addVehicleLocationInput.value = 'Central Station Garage';
        if (addVehicleStatusInput) addVehicleStatusInput.value = 'AVAILABLE';
        if (addVehicleNameInput) addVehicleNameInput.focus();
      }
    }

    function closeAddVehicleModal() {
      if (addVehicleModal) {
        addVehicleModal.hidden = true;
      }
      if (addVehicleForm) {
        addVehicleForm.reset();
      }
    }

    if (addVehicleBtn) {
      addVehicleBtn.addEventListener('click', function() {
        openAddVehicleModal();
      });
    }

    if (addVehicleModal) {
      addVehicleModal.addEventListener('click', function(e) {
        if (e.target === addVehicleModal || e.target.hasAttribute('data-close')) {
          closeAddVehicleModal();
        }
      });
    }

    if (addVehicleForm) {
      addVehicleForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        var vehicleName = addVehicleNameInput?.value.trim();
        if (!vehicleName) {
          alert('Please enter a vehicle name.');
          return;
        }

        var vehicleCallsign = addVehicleCallsignInput?.value.trim() || '';
        var vehicleLocation = addVehicleLocationInput?.value.trim() || 'Central Station Garage';
        var vehicleStatus = addVehicleStatusInput?.value || 'AVAILABLE';

        try {
          await createNewVehicle({
            name: vehicleName,
            callsign: vehicleCallsign,
            location: vehicleLocation,
            status: vehicleStatus
          });
          closeAddVehicleModal();
          alert('Vehicle added successfully!');
        } catch (error) {
          console.error('Failed to add vehicle:', error);
          alert('Unable to add vehicle. Please try again.');
        }
      });
    }

    async function createNewVehicle(vehicleData) {
      if (!databaseModule || !realtimeDb) {
        await waitForFirebaseApp();
        if (!databaseModule) {
          databaseModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
        }
        if (!realtimeDb) {
          var getDatabase = databaseModule.getDatabase;
          realtimeDb = getDatabase(window.iSagipApp, REALTIME_DB_URL);
        }
      }

      var ref = databaseModule.ref;
      var set = databaseModule.set;
      var actor = localStorage.getItem('iSagip_userUID') || 'staff';
      
      // Generate a unique ID for the vehicle (using timestamp + random)
      var vehicleId = 'AMB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
      
      var newVehicle = {
        name: vehicleData.name,
        callsign: vehicleData.callsign || '',
        location: vehicleData.location || 'Central Station Garage',
        status: vehicleData.status || 'AVAILABLE',
        assignment: null,
        assignmentId: null,
        maintenanceNote: '',
        maintenanceEta: null,
        lastUpdated: Date.now(),
        lastUpdatedBy: actor,
        createdAt: Date.now()
      };

      var vehicleRef = ref(realtimeDb, 'ambulances/' + vehicleId);
      return set(vehicleRef, newVehicle);
    }
  })();
})();
