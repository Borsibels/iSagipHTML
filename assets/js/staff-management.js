/**
 * Staff Management Module
 * Handles responder and barangay staff management, editing, and status updates
 */

(function() {
  'use strict';

  /**
   * Initialize staff management page
   */
  (function initializeStaffManagement() {
    // Check if we're on the staff management page
    if (!document.getElementById('responders-list')) return;

    let responders = [];
    let staff = [];
    let currentEditItem = null;
    let currentEditType = null; // 'responder' or 'staff'

    // Initialize Firebase imports
    let db, collection, query, getDocs, doc, getDoc, updateDoc, orderBy;

    // Load Firebase functions - wait for Firebase to be ready
    async function loadFirebase() {
      // Wait for Firebase to initialize
      if (!window.iSagipDb) {
        await new Promise((resolve) => {
          if (window.iSagipDb) {
            resolve();
            return;
          }
          window.addEventListener('firebaseReady', resolve, { once: true });
          setTimeout(() => {
            if (!window.iSagipDb) {
              console.error('Firebase initialization timeout');
              resolve();
            }
          }, 5000);
        });
      }

      if (!window.iSagipDb) {
        console.error('Firebase not initialized');
        return;
      }

      const firestore = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
      
      db = window.iSagipDb;
      collection = firestore.collection;
      query = firestore.query;
      getDocs = firestore.getDocs;
      doc = firestore.doc;
      getDoc = firestore.getDoc;
      updateDoc = firestore.updateDoc;
      orderBy = firestore.orderBy;

      // Load data
      loadResponders();
      loadStaff();
    }

    // Start loading when page is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadFirebase);
    } else {
      if (window.iSagipDb) {
        loadFirebase();
      } else {
        window.addEventListener('firebaseReady', loadFirebase, { once: true });
      }
    }

    /**
     * Load responders from Firestore
     */
    async function loadResponders() {
      if (!db) return;
      
      try {
        const respondersRef = collection(db, 'responder');
        let q;
        let snapshot;
        
        try {
          q = query(respondersRef, orderBy('createdAt', 'desc'));
          snapshot = await getDocs(q);
        } catch (orderByError) {
          console.warn('OrderBy failed, loading without orderBy:', orderByError);
          q = query(respondersRef);
          snapshot = await getDocs(q);
        }
        
        responders = [];
        snapshot.forEach((docSnap) => {
          responders.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        // Sort manually if orderBy failed
        if (responders.length > 0 && !snapshot.query.orderBy) {
          responders.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
          });
        }
        
        renderResponders();
      } catch (error) {
        console.error('Error loading responders:', error);
        responders = [];
        renderResponders();
      }
    }

    /**
     * Load staff from Firestore
     */
    async function loadStaff() {
      if (!db) return;
      
      try {
        const staffRef = collection(db, 'staff');
        let q;
        let snapshot;
        
        try {
          q = query(staffRef, orderBy('createdAt', 'desc'));
          snapshot = await getDocs(q);
        } catch (orderByError) {
          console.warn('OrderBy failed, loading without orderBy:', orderByError);
          q = query(staffRef);
          snapshot = await getDocs(q);
        }
        
        staff = [];
        snapshot.forEach((docSnap) => {
          staff.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        // Sort manually if orderBy failed
        if (staff.length > 0 && !snapshot.query.orderBy) {
          staff.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
          });
        }
        
        renderStaff();
      } catch (error) {
        console.error('Error loading staff:', error);
        staff = [];
        renderStaff();
      }
    }

    /**
     * Get display name from staff/responder data
     * Handles both fullName and firstName/middleName/lastName formats
     */
    function getDisplayName(item) {
      if (item.fullName) {
        return item.fullName;
      }
      const parts = [
        item.firstName,
        item.middleName,
        item.lastName
      ].filter(Boolean);
      return parts.join(' ') || 'N/A';
    }

    /**
     * Render responders in the table
     */
    function renderResponders() {
      const container = document.getElementById('responders-list');
      const emptyState = document.getElementById('responders-empty');
      
      if (!container) return;

      // Apply filters
      const searchTerm = document.getElementById('responders-search')?.value.toLowerCase() || '';
      const statusFilter = document.getElementById('responders-status')?.value || 'all';
      
      let filtered = responders.filter(res => {
        const name = getDisplayName(res).toLowerCase();
        const email = (res.email || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || (res.status || 'active') === statusFilter;
        return matchesSearch && matchesStatus;
      });

      if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      container.innerHTML = filtered.map(res => {
        const statusBadge = (res.status || 'active') === 'active' 
          ? '<span style="color: #10b981; font-weight: 600;">Active</span>'
          : '<span style="color: #ef4444; font-weight: 600;">Inactive</span>';
        
        return `
          <div class="t-row" data-responder-id="${res.id}">
            <div>${escapeHtml(getDisplayName(res))}</div>
            <div>${escapeHtml(res.email || 'N/A')}</div>
            <div>${escapeHtml(res.responderType || 'N/A')}</div>
            <div>${res.age || 'N/A'}</div>
            <div>${statusBadge}</div>
            <div>
              <button class="btn btn-small btn-outline edit-responder-btn" data-responder-id="${res.id}">Edit</button>
            </div>
          </div>
        `;
      }).join('');

      // Attach event listeners
      container.querySelectorAll('.edit-responder-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const responderId = this.getAttribute('data-responder-id');
          openEditModal(responderId, 'responder');
        });
      });
    }

    /**
     * Render staff in the table
     */
    function renderStaff() {
      const container = document.getElementById('staff-list');
      const emptyState = document.getElementById('staff-empty');
      
      if (!container) return;

      // Apply filters
      const searchTerm = document.getElementById('staff-search')?.value.toLowerCase() || '';
      const statusFilter = document.getElementById('staff-status')?.value || 'all';
      
      let filtered = staff.filter(s => {
        const name = getDisplayName(s).toLowerCase();
        const email = (s.email || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || (s.status || 'active') === statusFilter;
        return matchesSearch && matchesStatus;
      });

      if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      container.innerHTML = filtered.map(s => {
        const statusBadge = (s.status || 'active') === 'active' 
          ? '<span style="color: #10b981; font-weight: 600;">Active</span>'
          : '<span style="color: #ef4444; font-weight: 600;">Inactive</span>';
        
        const roleDisplay = s.role || 'barangay_staff';
        const roleLabel = roleDisplay.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return `
          <div class="t-row" data-staff-id="${s.id}">
            <div>${escapeHtml(getDisplayName(s))}</div>
            <div>${escapeHtml(s.email || 'N/A')}</div>
            <div>${escapeHtml(roleLabel)}</div>
            <div>${s.age || 'N/A'}</div>
            <div>${statusBadge}</div>
            <div>
              <button class="btn btn-small btn-outline edit-staff-btn" data-staff-id="${s.id}">Edit</button>
            </div>
          </div>
        `;
      }).join('');

      // Attach event listeners
      container.querySelectorAll('.edit-staff-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const staffId = this.getAttribute('data-staff-id');
          openEditModal(staffId, 'staff');
        });
      });
    }

    /**
     * Open edit modal for responder or staff
     */
    function openEditModal(itemId, type) {
      const items = type === 'responder' ? responders : staff;
      const item = items.find(i => i.id === itemId);
      if (!item) {
        alert(`${type === 'responder' ? 'Responder' : 'Staff'} not found`);
        return;
      }

      currentEditItem = item;
      currentEditType = type;
      const modal = document.getElementById('edit-modal');
      if (!modal) return;

      // Set modal title
      const titleEl = document.getElementById('edit-modal-title');
      if (titleEl) {
        titleEl.textContent = `Edit ${type === 'responder' ? 'Responder' : 'Barangay Staff'}`;
      }

      // Show/hide appropriate fields
      const responderTypeLabel = document.getElementById('edit-responder-type-label');
      const roleLabel = document.getElementById('edit-role-label');
      if (responderTypeLabel) {
        responderTypeLabel.style.display = type === 'responder' ? 'block' : 'none';
      }
      if (roleLabel) {
        roleLabel.style.display = type === 'staff' ? 'block' : 'none';
      }

      // Parse name - handle both fullName and separate name fields
      let firstName = '';
      let middleName = '';
      let lastName = '';
      
      if (item.fullName) {
        // Try to parse fullName into parts
        const nameParts = item.fullName.trim().split(/\s+/);
        if (nameParts.length >= 3) {
          firstName = nameParts[0];
          middleName = nameParts.slice(1, -1).join(' ');
          lastName = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 2) {
          firstName = nameParts[0];
          lastName = nameParts[1];
        } else {
          firstName = nameParts[0] || '';
        }
      } else {
        firstName = item.firstName || '';
        middleName = item.middleName || '';
        lastName = item.lastName || '';
      }

      // Populate form fields
      document.getElementById('edit-email').value = item.email || '';
      document.getElementById('edit-firstname').value = firstName;
      document.getElementById('edit-middlename').value = middleName;
      document.getElementById('edit-lastname').value = lastName;
      document.getElementById('edit-age').value = item.age || '';
      document.getElementById('edit-status').value = item.status || 'active';
      
      if (type === 'responder') {
        document.getElementById('edit-responder-type').value = item.responderType || '';
      } else {
        document.getElementById('edit-role').value = item.role || 'barangay_staff';
      }

      modal.hidden = false;
      modal.dataset.itemId = itemId;
      modal.dataset.itemType = type;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Tab switching function
    function switchToResponders() {
      const respondersSection = document.getElementById('responders-section');
      const staffSection = document.getElementById('staff-section');
      if (respondersSection) {
        respondersSection.style.display = 'block';
        respondersSection.removeAttribute('hidden');
      }
      if (staffSection) {
        staffSection.style.display = 'none';
        staffSection.setAttribute('hidden', '');
      }
      // Update all responder tab buttons
      document.getElementById('tab-responders')?.classList.add('active');
      document.getElementById('tab-staff')?.classList.remove('active');
      document.getElementById('tab-staff-2')?.classList.add('active');
      document.getElementById('tab-staff-3')?.classList.remove('active');
    }

    function switchToStaff() {
      const respondersSection = document.getElementById('responders-section');
      const staffSection = document.getElementById('staff-section');
      if (respondersSection) {
        respondersSection.style.display = 'none';
        respondersSection.setAttribute('hidden', '');
      }
      if (staffSection) {
        staffSection.style.display = 'block';
        staffSection.removeAttribute('hidden');
      }
      // Update all staff tab buttons
      document.getElementById('tab-responders')?.classList.remove('active');
      document.getElementById('tab-staff')?.classList.add('active');
      document.getElementById('tab-staff-2')?.classList.remove('active');
      document.getElementById('tab-staff-3')?.classList.add('active');
    }

    // Tab switching event listeners
    document.getElementById('tab-responders')?.addEventListener('click', switchToResponders);
    document.getElementById('tab-staff')?.addEventListener('click', switchToStaff);
    document.getElementById('tab-staff-2')?.addEventListener('click', switchToResponders);
    document.getElementById('tab-staff-3')?.addEventListener('click', switchToStaff);

    // Search and filter listeners
    document.getElementById('responders-search')?.addEventListener('input', renderResponders);
    document.getElementById('responders-status')?.addEventListener('change', renderResponders);
    document.getElementById('staff-search')?.addEventListener('input', renderStaff);
    document.getElementById('staff-status')?.addEventListener('change', renderStaff);

    // Save staff/responder edit
    document.getElementById('save-staff')?.addEventListener('click', async function() {
      const modal = document.getElementById('edit-modal');
      const itemId = modal?.dataset.itemId;
      const itemType = modal?.dataset.itemType;
      if (!itemId || !itemType || !db) return;

      try {
        const firstName = document.getElementById('edit-firstname').value.trim();
        const middleName = document.getElementById('edit-middlename').value.trim();
        const lastName = document.getElementById('edit-lastname').value.trim();
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

        const updates = {
          email: document.getElementById('edit-email').value.trim(),
          firstName: firstName,
          middleName: middleName,
          lastName: lastName,
          fullName: fullName, // Keep both formats for compatibility
          age: parseInt(document.getElementById('edit-age').value) || null,
          status: document.getElementById('edit-status').value
        };

        if (itemType === 'responder') {
          updates.responderType = document.getElementById('edit-responder-type').value || null;
        } else {
          updates.role = document.getElementById('edit-role').value || 'barangay_staff';
        }

        const collectionName = itemType === 'responder' ? 'responder' : 'staff';
        await updateDoc(doc(db, collectionName, itemId), updates);
        
        alert(`${itemType === 'responder' ? 'Responder' : 'Staff'} updated successfully!`);
        modal.hidden = true;
        
        // Reload data
        if (itemType === 'responder') {
          await loadResponders();
        } else {
          await loadStaff();
        }
      } catch (error) {
        console.error(`Error updating ${itemType}:`, error);
        alert(`Error updating ${itemType}: ` + (error.message || 'Unknown error'));
      }
    });
  })();
})();
