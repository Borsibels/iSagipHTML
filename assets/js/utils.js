/**
 * Utilities Module
 * Global utilities: modals, dark mode, navigation fade, Google Maps, helpers
 */

(function() {
  'use strict';

  // ========================================
  // GLOBAL MODAL CLOSE HANDLERS
  // ========================================
  
  /**
   * Global modal close functionality
   * Closes modals when clicking outside or on close buttons
   */
  document.addEventListener('click', function(e){
    // Close modals when clicking close button
    if (e.target.matches('[data-close]')) {
      var modal = e.target.closest('.modal');
      if (modal) {
        modal.hidden = true;
      }
    }
    // Close modals when clicking outside
    if (e.target.classList.contains('modal')) {
      e.target.hidden = true;
    }
  });

  // ========================================
  // GLOBAL NAVIGATION FADE HELPER
  // ========================================
  /**
   * Navigate to a URL with fade transition
   * @param {string} url - URL to navigate to
   */
  window.navigateWithFade = function(url){
    // Guard: if user prefers reduced motion, skip transition
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { 
      window.location.href = url; 
      return; 
    }

    document.body.classList.remove('page-enter');
    document.body.classList.add('page-leave');
    setTimeout(function(){ 
      window.location.href = url; 
    }, 180);
  };

  // ========================================
  // GLOBAL DARK MODE INITIALIZATION
  // ========================================
  
  /**
   * Update custom elements for theme changes
   * @param {string} theme - Current theme
   */
  function updateCustomElementsForTheme(theme) {
    // Update any elements that need special handling
    const elementsToUpdate = [
      '.table', '.stat', '.ambulance-card', '.notification',
      '.modal-dialog', '.settings-section', '.search-section'
    ];
    
    elementsToUpdate.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // Force style recalculation
        element.style.display = 'none';
        element.offsetHeight; // Trigger reflow
        element.style.display = '';
      });
    });
  }

  /**
   * Apply theme to the document
   * @param {string} theme - 'light' or 'dark'
   */
  window.applyTheme = function(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Force re-render of elements that might not update automatically
    setTimeout(() => {
      // Trigger a reflow to ensure all elements update
      document.body.offsetHeight;
      
      // Update any custom elements or components
      updateCustomElementsForTheme(theme);
    }, 100);
  };

  /**
   * Initialize dark mode for all pages
   * Applies saved theme preference on page load
   */
  (function initializeGlobalDarkMode() {
    const savedTheme = localStorage.getItem('iSagip_theme') || 'light';
    window.applyTheme(savedTheme);
    // Ensure page enters with fade
    document.addEventListener('DOMContentLoaded', function(){
      document.body.classList.add('page-enter');
    });
  })();

  // ========================================
  // GOOGLE MAPS INITIALIZATION
  // ========================================
  
  /**
   * Initialize Google Maps for dashboard
   * Sets up map with Barangay Hall marker
   */
  // Define initISagipMap on window first to ensure it's always available
  // Google Maps callback may call it before DOM is ready
  window.initISagipMap = function () {
    var mapEl = document.getElementById('map');
    if (!mapEl) {
      console.warn('Map element not found, retrying...');
      // Retry after a short delay if element not found
      setTimeout(function() {
        if (document.getElementById('map')) {
          window.initISagipMap();
        }
      }, 100);
      return;
    }
    
    var defaultCenter = { lat: 14.7332558, lng: 121.0158851 };
    var map = new google.maps.Map(mapEl, {
      center: defaultCenter,
      zoom: 13,
    });

    var selectedMarker = null;
    var infoWindow = new google.maps.InfoWindow();

    // Static Barangay Hall marker (blue-dot like in React)
    new google.maps.Marker({
      position: defaultCenter,
      map: map,
      title: 'Barangay 167 Hall (Silanganan Subdivision, S.M. Bernardo Ave.)',
      icon: {
        url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        scaledSize: new google.maps.Size(40, 40)
      }
    });

    var reportMarkers = [];
    var heatmaps = {
      fire: null,
      medical: null,
      police: null,
      urgent: null,
      barangay: null,
      general: null
    };
    var heatmapsVisible = true;
    
    function typeColor(type) {
      var t = (type || '').toString().toLowerCase();
      if (t.includes('urgent') || t.includes('emergency')) return 'orange'; // Orange for urgent (matches dashboard legend)
      if (t.includes('fire')) return 'red'; // Red for fire (matches dashboard legend)
      if (t.includes('medical') || t.includes('injur')) return 'blue'; // Blue for medical
      if (t.includes('police') || t.includes('criminal') || t.includes('hostile')) return 'purple'; // Purple for police
      if (t.includes('barangay') && t.includes('assist')) return 'yellow'; // Yellow for barangay assistance
      return 'green'; // Green for general/others
    }
    function markerIcon(color) {
      return {
        url: 'http://maps.google.com/mapfiles/ms/icons/' + color + '-dot.png',
        scaledSize: new google.maps.Size(32, 32)
      };
    }
    
    // Helper function to categorize report type
    function getReportCategory(type) {
      var t = (type || '').toString().toLowerCase();
      if (t.includes('fire')) return 'fire';
      if (t.includes('medical') || t.includes('injur')) return 'medical';
      if (t.includes('police') || t.includes('criminal') || t.includes('hostile')) return 'police';
      if (t.includes('urgent') || t.includes('emergency')) return 'urgent';
      if (t.includes('barangay') && t.includes('assist')) return 'barangay';
      return 'general';
    }
    
    // Create heatmap layers
    function createHeatmapLayer(data, gradient) {
      if (!google.maps.visualization || !google.maps.visualization.HeatmapLayer) {
        console.warn('Google Maps Visualization library not loaded');
        return null;
      }
      return new google.maps.visualization.HeatmapLayer({
        data: data,
        map: heatmapsVisible ? map : null,
        gradient: gradient,
        radius: 50,
        opacity: 0.6,
        maxIntensity: 10
      });
    }
    
    // Update heatmaps based on reports
    function updateHeatmaps(items) {
      if (!Array.isArray(items) || !google.maps.visualization) return;
      
      var dataByCategory = {
        fire: [],
        medical: [],
        police: [],
        urgent: [],
        barangay: [],
        general: []
      };
      
      items.forEach(function (r) {
        var lat = parseFloat(r.latitude ?? r.lat);
        var lng = parseFloat(r.longitude ?? r.lng);
        if (!isFinite(lat) || !isFinite(lng)) return;
        
        var category = getReportCategory(r.type);
        var point = new google.maps.LatLng(lat, lng);
        
        if (dataByCategory[category]) {
          dataByCategory[category].push(point);
        }
      });
      
      // Remove existing heatmaps
      Object.keys(heatmaps).forEach(function(key) {
        if (heatmaps[key]) {
          heatmaps[key].setMap(null);
          heatmaps[key] = null;
        }
      });
      
      // Create new heatmaps with color gradients
      // Fire - Red gradient
      if (dataByCategory.fire.length > 0) {
        heatmaps.fire = createHeatmapLayer(dataByCategory.fire, [
          'rgba(255, 0, 0, 0)',
          'rgba(255, 0, 0, 0.4)',
          'rgba(255, 100, 0, 0.6)',
          'rgba(255, 0, 0, 0.8)',
          'rgba(200, 0, 0, 1)'
        ]);
      }
      
      // Medical - Blue gradient
      if (dataByCategory.medical.length > 0) {
        heatmaps.medical = createHeatmapLayer(dataByCategory.medical, [
          'rgba(0, 0, 255, 0)',
          'rgba(0, 100, 255, 0.4)',
          'rgba(0, 150, 255, 0.6)',
          'rgba(0, 100, 255, 0.8)',
          'rgba(0, 50, 200, 1)'
        ]);
      }
      
      // Police - Purple gradient
      if (dataByCategory.police.length > 0) {
        heatmaps.police = createHeatmapLayer(dataByCategory.police, [
          'rgba(128, 0, 128, 0)',
          'rgba(150, 50, 200, 0.4)',
          'rgba(160, 80, 220, 0.6)',
          'rgba(140, 40, 180, 0.8)',
          'rgba(100, 0, 150, 1)'
        ]);
      }
      
      // Urgent/Emergency - Orange/Yellow gradient
      if (dataByCategory.urgent.length > 0) {
        heatmaps.urgent = createHeatmapLayer(dataByCategory.urgent, [
          'rgba(255, 165, 0, 0)',
          'rgba(255, 200, 0, 0.4)',
          'rgba(255, 220, 50, 0.6)',
          'rgba(255, 180, 0, 0.8)',
          'rgba(255, 140, 0, 1)'
        ]);
      }
      
      // Barangay Assistance - Yellow/Gold gradient
      if (dataByCategory.barangay.length > 0) {
        heatmaps.barangay = createHeatmapLayer(dataByCategory.barangay, [
          'rgba(255, 215, 0, 0)',
          'rgba(255, 230, 50, 0.4)',
          'rgba(255, 240, 100, 0.6)',
          'rgba(255, 220, 80, 0.8)',
          'rgba(255, 200, 0, 1)'
        ]);
      }
      
      // General/Other - Green gradient
      if (dataByCategory.general.length > 0) {
        heatmaps.general = createHeatmapLayer(dataByCategory.general, [
          'rgba(0, 128, 0, 0)',
          'rgba(50, 180, 50, 0.4)',
          'rgba(100, 200, 100, 0.6)',
          'rgba(50, 160, 50, 0.8)',
          'rgba(0, 120, 0, 1)'
        ]);
      }
    }
    
    // Toggle heatmaps visibility
    window.toggleISagipHeatmaps = function(visible) {
      heatmapsVisible = visible !== undefined ? visible : !heatmapsVisible;
      Object.keys(heatmaps).forEach(function(key) {
        if (heatmaps[key]) {
          heatmaps[key].setMap(heatmapsVisible ? map : null);
        }
      });
      return heatmapsVisible;
    };
    
    window.updateISagipMapMarkers = function (items) {
      if (!Array.isArray(items)) return;
      reportMarkers.forEach(function (m) { m.setMap(null); });
      reportMarkers = [];
      
      // Filter out resolved reports for markers (but keep them for heatmaps)
      var activeReports = items.filter(function (r) {
        var status = (r.status || '').toLowerCase();
        return status !== 'resolved' && status !== 'relayed';
      });
      
      // Create markers only for active (non-resolved) reports
      activeReports.forEach(function (r) {
        var lat = parseFloat(r.latitude ?? r.lat);
        var lng = parseFloat(r.longitude ?? r.lng);
        if (!isFinite(lat) || !isFinite(lng)) return;
        var marker = new google.maps.Marker({
          position: { lat: lat, lng: lng },
          map: map,
          title: (r.type || 'Emergency') + (r.street ? (' - ' + r.street) : ''),
          icon: markerIcon(typeColor(r.type))
        });
        marker.addListener('click', function () {
          if (selectedMarker === marker) {
            infoWindow.close();
            selectedMarker = null;
            return;
          }
          selectedMarker = marker;
          var time = r.timestampLabel || r.timestamp || '';
          var reportedBy = r.reportedBy || r.userName || r.reportedByName || r.by || 'Unknown';
          var html = '<div><strong>' + (r.type || 'Emergency') + '</strong>'
            + (r.status ? (' <span style="color:#64748b;">(' + r.status.toString().replace(/[_-]/g, ' ').replace(/\b\w/g, function(ch){ return ch.toUpperCase(); }) + ')</span>') : '')
            + '<br/>' + (r.description || r.landmark || 'No description')
            + '<br/><span style="font-size:12px;color:#666">Reported by: ' + reportedBy + '</span>'
            + (time ? '<br/><span style="font-size:12px;color:#666">Time: ' + time + '</span>' : '')
            + '</div>';
          infoWindow.setContent(html);
          infoWindow.open(map, marker);
        });
        reportMarkers.push(marker);
      });
      
      // Update heatmaps with ALL reports (including resolved) to keep hotspot colors
      updateHeatmaps(items);
    };
    if (Array.isArray(window.iSagipPendingMarkersData)) {
      window.updateISagipMapMarkers(window.iSagipPendingMarkersData);
      window.iSagipPendingMarkersData = null;
    }

    map.addListener('click', function () { 
      infoWindow.close(); 
      selectedMarker = null; 
    });
  };

  // ========================================
  // REGISTRATION PAGE TAB SWITCHING (UI ONLY)
  // ========================================
  // NOTE: Staff/Responder registration is now handled by mass-registration.js
  // This function is kept for backward compatibility with register.html if it still uses tabs
  // Staff registration should use mass-register-staff.html instead
  (function setupRegisterTabs(){
    var tabsContainer = document.querySelector('main .tabs');
    var residentForm = document.getElementById('resident-register-form');
    
    // Only handle resident form tab switching if tabs exist
    // Staff registration is now handled by mass-register-staff.html
    if (tabsContainer && residentForm) {
      tabsContainer.addEventListener('click', function(e){
        var btn = e.target.closest('.tab');
        if (!btn) return;
        tabsContainer.querySelectorAll('.tab').forEach(function(b){ 
          b.classList.remove('active'); 
        });
        btn.classList.add('active');
        var t = btn.getAttribute('data-tab');
        if (t === 'resident') { 
          residentForm.hidden = false; 
        }
      });
    }
  })();
})();
