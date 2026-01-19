/**
 * Resident Management Module
 * Handles resident registration review, approval, and management
 */

(function() {
  'use strict';

  // ========================================
  // EMAILJS CONFIGURATION
  // ========================================
  // EmailJS configuration for sending approval emails
  // You can use the same template as mass registration or create a new one
  const EMAILJS_PUBLIC_KEY = 'HdfCtAM1oRBEUuyy9'; // Same as mass registration
  const EMAILJS_SERVICE_ID = 'service_c04v2hd'; // Same as mass registration
  const EMAILJS_TEMPLATE_ID = 'template_gyywi28'; // You can create a separate template for resident approval or use the same one

  // Initialize EmailJS if available
  if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  // ========================================
  // RESIDENT MANAGEMENT - REGISTRATION REVIEW
  // ========================================
  
  /**
   * Initialize resident management page
   * Handles pending registration requests review and approved residents management
   */
  (function initializeResidentManagement() {
    // Check if we're on the resident management page
    if (!document.getElementById('pending-requests')) return;

    let pendingRequests = [];
    let approvedResidents = [];
    let currentReviewRequest = null;

    // Initialize Firebase imports
    let db, collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, 
        setDoc, serverTimestamp, orderBy, Timestamp, ref, getDownloadURL, storage;

    // Load Firebase functions - wait for Firebase to be ready
    async function loadFirebase() {
      // Wait for Firebase to initialize
      if (!window.iSagipDb) {
        // If Firebase isn't ready yet, wait for the event
        await new Promise((resolve) => {
          if (window.iSagipDb) {
            resolve();
            return;
          }
          window.addEventListener('firebaseReady', resolve, { once: true });
          // Fallback timeout after 5 seconds
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
      const storageModule = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js");
      
      db = window.iSagipDb;
      collection = firestore.collection;
      query = firestore.query;
      where = firestore.where;
      getDocs = firestore.getDocs;
      doc = firestore.doc;
      getDoc = firestore.getDoc;
      updateDoc = firestore.updateDoc;
      deleteDoc = firestore.deleteDoc;
      setDoc = firestore.setDoc;
      serverTimestamp = firestore.serverTimestamp;
      orderBy = firestore.orderBy;
      Timestamp = firestore.Timestamp;
      
      storage = storageModule.getStorage(window.iSagipApp);
      ref = storageModule.ref;
      getDownloadURL = storageModule.getDownloadURL;

      // Load data
      loadPendingRequests();
      loadApprovedResidents();
    }

    // Start loading when page is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadFirebase);
    } else {
      // If Firebase is already ready, load immediately
      if (window.iSagipDb) {
        loadFirebase();
      } else {
        // Otherwise wait for the firebaseReady event
        window.addEventListener('firebaseReady', loadFirebase, { once: true });
      }
    }

    /**
     * Load pending registration requests from Firestore
     */
    async function loadPendingRequests() {
      if (!db) {
        console.error('Database not available');
        return;
      }
      
      console.log('Loading pending requests...');
      
      try {
        const requestsRef = collection(db, 'resident_requests');
        console.log('Collection reference created');
        
        // Try with orderBy first
        let q;
        let snapshot;
        
        try {
          q = query(requestsRef, where('status', '==', 'pending'), orderBy('requestedAt', 'desc'));
          snapshot = await getDocs(q);
          console.log('Query with orderBy successful, found:', snapshot.size, 'documents');
        } catch (orderByError) {
          console.warn('OrderBy failed, trying without orderBy:', orderByError);
          // If orderBy fails (missing index), try without it
          q = query(requestsRef, where('status', '==', 'pending'));
          snapshot = await getDocs(q);
          console.log('Query without orderBy successful, found:', snapshot.size, 'documents');
        }
        
        pendingRequests = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          console.log('Document found:', docSnap.id, data);
          pendingRequests.push({
            id: docSnap.id,
            ...data
          });
        });
        
        console.log('Total pending requests loaded:', pendingRequests.length);
        
        // If we loaded without orderBy, sort manually
        if (pendingRequests.length > 0) {
          pendingRequests.sort((a, b) => {
            const dateA = a.requestedAt?.toDate?.() || new Date(0);
            const dateB = b.requestedAt?.toDate?.() || new Date(0);
            return dateB - dateA; // Descending
          });
        }
        
        renderPendingRequests();
      } catch (error) {
        console.error('Error loading pending requests:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Show error in UI
        const container = document.getElementById('pending-requests');
        const emptyState = document.getElementById('pending-empty');
        
        if (container) {
          container.innerHTML = `
            <div class="t-row" style="grid-column: 1/-1; padding: 2rem; text-align: center;">
              <div style="color: #ef4444;">
                <strong>Error loading requests</strong><br/>
                ${error.message || 'Unknown error'}<br/>
                <small style="color: var(--muted); margin-top: 8px; display: block;">
                  Check console (F12) for details
                </small>
              </div>
            </div>
          `;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        pendingRequests = [];
      }
    }

    /**
     * Render pending requests in the table
     */
    function renderPendingRequests() {
      const container = document.getElementById('pending-requests');
      const emptyState = document.getElementById('pending-empty');
      
      if (!container) {
        console.error('Container not found');
        return;
      }

      console.log('Rendering', pendingRequests.length, 'pending requests');

      // Apply search filter
      const searchTerm = document.getElementById('pending-search')?.value.toLowerCase() || '';
      const sortBy = document.getElementById('pending-sort')?.value || 'newest';
      
      let filtered = pendingRequests.filter(req => {
        const name = `${req.firstName || ''} ${req.lastName || ''}`.toLowerCase();
        const email = (req.email || '').toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm);
      });

      console.log('After filtering:', filtered.length, 'requests');

      // Apply sorting
      if (sortBy === 'oldest') {
        filtered.sort((a, b) => {
          const dateA = a.requestedAt?.toDate?.() || new Date(0);
          const dateB = b.requestedAt?.toDate?.() || new Date(0);
          return dateA - dateB;
        });
      } else if (sortBy === 'name') {
        filtered.sort((a, b) => {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
      }

      if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) {
          emptyState.style.display = 'block';
          console.log('No requests to display, showing empty state');
        }
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      console.log('Rendering', filtered.length, 'filtered requests to table');

      container.innerHTML = filtered.map(req => {
        const requestDate = req.requestedAt?.toDate?.() || new Date();
        const dateStr = requestDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        // Check for ID document
        const hasId = req.idPhotoUrl || req.idDocumentUrl || req.idDocumentPath;
        
        return `
          <div class="t-row" data-request-id="${req.id}">
            <div>${dateStr}</div>
            <div>${req.firstName || ''} ${req.middleName || ''} ${req.lastName || ''}</div>
            <div>${req.email || 'N/A'}</div>
            <div>${req.contact || 'N/A'}</div>
            <div>${hasId ? '<span style="color: #10b981;">✓ Yes</span>' : '<span style="color: #ef4444;">✗ No</span>'}</div>
            <div>
              <button class="btn btn-small btn-primary review-btn" data-request-id="${req.id}">Review</button>
            </div>
          </div>
        `;
      }).join('');

      // Attach event listeners
      container.querySelectorAll('.review-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const requestId = this.getAttribute('data-request-id');
          openReviewModal(requestId);
        });
      });
      
      console.log('Table rendered successfully');
    }

    /**
     * Load approved residents from Firestore
     */
    async function loadApprovedResidents() {
      if (!db) return;
      
      try {
        const residentsRef = collection(db, 'residents');
        const q = query(residentsRef, orderBy('approvedAt', 'desc'));
        const snapshot = await getDocs(q);
        
        approvedResidents = [];
        snapshot.forEach((docSnap) => {
          approvedResidents.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        renderApprovedResidents();
      } catch (error) {
        console.error('Error loading approved residents:', error);
        approvedResidents = [];
        renderApprovedResidents();
      }
    }

    /**
     * Render approved residents in the table
     */
    function renderApprovedResidents() {
      const container = document.getElementById('approved-residents');
      const emptyState = document.getElementById('approved-empty');
      
      if (!container) return;

      // Apply filters
      const searchTerm = document.getElementById('approved-search')?.value.toLowerCase() || '';
      const statusFilter = document.getElementById('approved-status')?.value || 'all';
      
      let filtered = approvedResidents.filter(res => {
        const name = `${res.firstName || ''} ${res.lastName || ''}`.toLowerCase();
        const email = (res.email || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
        return matchesSearch && matchesStatus;
      });

      if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      container.innerHTML = filtered.map(res => {
        const statusBadge = res.status === 'active' 
          ? '<span style="color: #10b981; font-weight: 600;">Active</span>'
          : '<span style="color: #ef4444; font-weight: 600;">Inactive</span>';
        
        return `
          <div class="t-row" data-resident-id="${res.id}">
            <div>${res.firstName || ''} ${res.middleName || ''} ${res.lastName || ''}</div>
            <div>${res.email || 'N/A'}</div>
            <div>${res.contact || 'N/A'}</div>
            <div>${statusBadge}</div>
            <div>
              <button class="btn btn-small btn-outline edit-resident-btn" data-resident-id="${res.id}">Edit</button>
              <button class="btn btn-small btn-outline reset-password-btn" data-resident-id="${res.id}">Reset Password</button>
            </div>
          </div>
        `;
      }).join('');

      // Attach event listeners
      container.querySelectorAll('.edit-resident-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const residentId = this.getAttribute('data-resident-id');
          openEditModal(residentId);
        });
      });

      container.querySelectorAll('.reset-password-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const residentId = this.getAttribute('data-resident-id');
          openResetPasswordModal(residentId);
        });
      });
    }

    /**
     * Resolve possible ID document url/path fields from a request
     */
    function resolveIdDocumentSources(request){
      request = request || {};
      const url =
        request.idDocumentUrl ||
        request.idUrl ||
        request.idImageUrl ||
        request.validIdUrl ||
        request.idDocument ||
        request.idPhotoUrl ||
        request.documentUrl;

      const path =
        request.idDocumentPath ||
        request.idPath ||
        request.idImagePath ||
        request.validIdPath ||
        request.idPhotoPath ||
        request.documentPath;

      return { url, path };
    }

    /**
     * Open review modal for a registration request
     */
    async function openReviewModal(requestId) {
      if (!db) return;
      
      const request = pendingRequests.find(r => r.id === requestId);
      if (!request) {
        alert('Request not found');
        return;
      }

      currentReviewRequest = request;
      const modal = document.getElementById('review-modal');
      if (!modal) return;

      // Populate form fields - Personal Information
      document.getElementById('review-email').value = request.email || 'N/A';
      document.getElementById('review-firstname').value = request.firstName || 'N/A';
      document.getElementById('review-middlename').value = request.middleName || 'N/A';
      document.getElementById('review-lastname').value = request.lastName || 'N/A';
      document.getElementById('review-gender').value = request.gender || 'N/A';
      document.getElementById('review-birthdate').value = request.birthDate || 'N/A';
      document.getElementById('review-status').value = request.status || 'N/A';
      
      // Contact Information
      document.getElementById('review-mobilenumber').value = request.mobileNumber || request.contact || 'N/A';
      document.getElementById('review-emergencycontact').value = request.emergencyContact || 'N/A';
      document.getElementById('review-emergencycontactnumber').value = request.emergencyContactNumber || 'N/A';
      
      // Address Information
      document.getElementById('review-homeaddress').value = request.homeAddress || request.address || 'N/A';
      document.getElementById('review-barangay').value = request.barangay || 'N/A';
      document.getElementById('review-city').value = request.city || 'N/A';
      document.getElementById('review-province').value = request.province || 'N/A';
      document.getElementById('review-zipcode').value = request.zipCode || 'N/A';
      
      // Family Information
      document.getElementById('review-fathername').value = request.fatherName || 'N/A';
      document.getElementById('review-mothername').value = request.motherName || 'N/A';
      
      // Request Information
      const requestDate = request.requestedAt?.toDate?.() || new Date();
      document.getElementById('review-requestedat').value = requestDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Load ID document
      const idPreview = document.getElementById('id-preview');
      const idPlaceholder = document.getElementById('id-placeholder');
      const idFullscreenImg = document.getElementById('id-fullscreen-img');
      const resolvedId = resolveIdDocumentSources(request);
      const urlCandidate = resolvedId.url;
      const pathCandidate = resolvedId.path;
      // Update request object so download handlers can use resolved values
      currentReviewRequest.idDocumentUrl = urlCandidate || currentReviewRequest.idDocumentUrl;
      currentReviewRequest.idDocumentPath = pathCandidate || currentReviewRequest.idDocumentPath;
      
      if (currentReviewRequest.idDocumentUrl) {
        idPreview.src = currentReviewRequest.idDocumentUrl;
        idPreview.style.display = 'block';
        if (idPlaceholder) idPlaceholder.style.display = 'none';
        if (idFullscreenImg) idFullscreenImg.src = currentReviewRequest.idDocumentUrl;
      } else if (currentReviewRequest.idDocumentPath && storage) {
        try {
          const storageRef = ref(storage, currentReviewRequest.idDocumentPath);
          const url = await getDownloadURL(storageRef);
          idPreview.src = url;
          idPreview.style.display = 'block';
          if (idPlaceholder) idPlaceholder.style.display = 'none';
          if (idFullscreenImg) idFullscreenImg.src = url;
        } catch (error) {
          console.error('Error loading ID document:', error);
          idPreview.style.display = 'none';
          if (idPlaceholder) idPlaceholder.style.display = 'block';
        }
      } else {
        idPreview.style.display = 'none';
        if (idPlaceholder) idPlaceholder.style.display = 'block';
      }

      modal.hidden = false;
    }

    /**
     * Approve a registration request
     * Creates Firebase Auth account only upon approval
     */
    async function approveRequest() {
      if (!currentReviewRequest || !db) return;

      if (!confirm('Are you sure you want to approve this registration request?')) {
        return;
      }

      try {
        const auth = window.iSagipAuth;

        if (!currentReviewRequest.password) {
          alert('Cannot approve: password is missing from the registration request.');
          return;
        }

        const { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");

        // Ensure no existing Auth account before creating
        const signInMethods = await fetchSignInMethodsForEmail(auth, currentReviewRequest.email);
        if (signInMethods.length > 0) {
          alert('Account already exists for this email. Ask the user to log in or reset password.');
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          currentReviewRequest.email,
          currentReviewRequest.password
        );
        const userUid = userCredential.user.uid;

        // Save to residents collection
        const residentData = {
          uid: userUid,
          email: currentReviewRequest.email || '',
          firstName: currentReviewRequest.firstName || '',
          middleName: currentReviewRequest.middleName || '',
          lastName: currentReviewRequest.lastName || '',
          gender: currentReviewRequest.gender || '',
          birthDate: currentReviewRequest.birthDate || '',
          mobileNumber: currentReviewRequest.mobileNumber || currentReviewRequest.contact || '',
          contact: currentReviewRequest.contact || currentReviewRequest.mobileNumber || '',
          homeAddress: currentReviewRequest.homeAddress || currentReviewRequest.address || '',
          address: currentReviewRequest.address || currentReviewRequest.homeAddress || '',
          barangay: currentReviewRequest.barangay || '',
          city: currentReviewRequest.city || '',
          province: currentReviewRequest.province || '',
          zipCode: currentReviewRequest.zipCode || '',
          emergencyContact: currentReviewRequest.emergencyContact || '',
          emergencyContactNumber: currentReviewRequest.emergencyContactNumber || '',
          fatherName: currentReviewRequest.fatherName || '',
          motherName: currentReviewRequest.motherName || '',
          idPhotoUrl: currentReviewRequest.idPhotoUrl || currentReviewRequest.idDocumentUrl || '',
          idDocumentUrl: currentReviewRequest.idDocumentUrl || currentReviewRequest.idPhotoUrl || '',
          idDocumentPath: currentReviewRequest.idDocumentPath || '',
          status: 'active',
          approvedAt: serverTimestamp(),
          approvedBy: localStorage.getItem('iSagip_userUID') || '',
          createdAt: serverTimestamp()
        };

        await setDoc(doc(db, 'residents', userUid), residentData);

        // Update request status
        await updateDoc(doc(db, 'resident_requests', currentReviewRequest.id), {
          status: 'approved',
          userId: userUid,
          approvedAt: serverTimestamp(),
          approvedBy: localStorage.getItem('iSagip_userUID') || ''
        });

        // Send approval email (they can now log in with the password they registered)
        try {
          const fullName = `${currentReviewRequest.firstName || ''} ${currentReviewRequest.middleName || ''} ${currentReviewRequest.lastName || ''}`.trim();
          await sendApprovalEmail(
            currentReviewRequest.email,
            fullName || currentReviewRequest.email
          );
        } catch (emailError) {
          console.warn('Failed to send approval email:', emailError);
          // Don't fail the approval if email fails
        }

        alert('Registration request approved successfully!');
        
        // Close modal and reload data
        document.getElementById('review-modal').hidden = true;
        currentReviewRequest = null;
        loadPendingRequests();
        loadApprovedResidents();
      } catch (error) {
        console.error('Error approving request:', error);
        alert('Error approving request: ' + (error.message || 'Unknown error'));
      }
    }

    /**
     * Send approval email via EmailJS
     * @param {string} email - Resident's email address
     * @param {string} fullName - Resident's full name
     */
    async function sendApprovalEmail(email, fullName) {
      // Check if EmailJS is configured
      if (typeof emailjs === 'undefined') {
        console.warn('EmailJS is not loaded. Email will not be sent.');
        console.log(`=== RESIDENT APPROVAL NOTIFICATION FOR ${email.toUpperCase()} ===`);
        console.log(`Name: ${fullName}`);
        console.log(`Email: ${email}`);
        console.log(`Status: Account Approved - You can now log in`);
        console.log(`=========================================`);
        return;
      }

      try {
        // Ensure all variables are strings and not undefined/null
        const templateParams = {
          to_email: String(email || ''),
          to_name: String(fullName || 'Resident'),
          status: 'approved',
          status_title: 'Account Approved ✓',
          status_color: '#10b981',
          status_bg: '#f0fdf4',
          status_border: '#10b981',
          message: 'Your account has been approved. You can now log in using your existing credentials.',
          show_button: 'true',
          button_text: 'Open iSagip App',
          login_url: String(window.location.origin + '/index.html')
        };

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        console.log('Approval email sent successfully to', email);
      } catch (error) {
        console.error('EmailJS error:', error);
        throw new Error('Failed to send approval email: ' + (error.text || error.message));
      }
    }

    /**
     * Send rejection email via EmailJS
     * @param {string} email - Resident's email address
     * @param {string} fullName - Resident's full name
     * @param {string} reason - Rejection reason (optional)
     */
    async function sendRejectionEmail(email, fullName, reason) {
      // Check if EmailJS is configured
      if (typeof emailjs === 'undefined') {
        console.warn('EmailJS is not loaded. Email will not be sent.');
        console.log(`=== RESIDENT REJECTION NOTIFICATION FOR ${email.toUpperCase()} ===`);
        console.log(`Name: ${fullName}`);
        console.log(`Email: ${email}`);
        console.log(`Status: Account Rejected`);
        if (reason) console.log(`Reason: ${reason}`);
        console.log(`=========================================`);
        return;
      }

      try {
        // Ensure all variables are strings and not undefined/null
        // Clean the reason to remove any special characters that might cause issues
        const cleanReason = reason ? String(reason).replace(/[{}]/g, '') : '';
        const rejectionMessage = cleanReason 
          ? `Your registration request has been rejected. Reason: ${cleanReason}` 
          : 'Your registration request has been rejected. Please contact support for more information.';
        
        const templateParams = {
          to_email: String(email || ''),
          to_name: String(fullName || 'Resident'),
          status: 'rejected',
          status_title: 'Registration Request Update',
          status_color: '#ef4444',
          status_bg: '#fef2f2',
          status_border: '#ef4444',
          message: String(rejectionMessage),
          show_button: 'false',
          button_text: '',
          login_url: ''
        };

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        console.log('Rejection email sent successfully to', email);
      } catch (error) {
        console.error('EmailJS error:', error);
        throw new Error('Failed to send rejection email: ' + (error.text || error.message));
      }
    }

    /**
     * Reject a registration request
     * Deletes the request so the user can register again
     */
    async function rejectRequest() {
      if (!currentReviewRequest || !db) return;

      const reason = prompt('Please provide a reason for rejection (optional):');
      if (reason === null) return; // User cancelled

      if (!confirm('Are you sure you want to reject this registration request? The request will be deleted.')) {
        return;
      }

      try {
        // Send rejection email
        try {
          const fullName = `${currentReviewRequest.firstName || ''} ${currentReviewRequest.middleName || ''} ${currentReviewRequest.lastName || ''}`.trim();
          await sendRejectionEmail(
            currentReviewRequest.email,
            fullName || currentReviewRequest.email,
            reason || ''
          );
        } catch (emailError) {
          console.warn('Failed to send rejection email:', emailError);
          // Don't fail the rejection if email fails
        }

        // Delete request so user can register again
        await deleteDoc(doc(db, 'resident_requests', currentReviewRequest.id));

        alert('Registration request rejected and deleted.');
        
        // Close modal and reload data
        document.getElementById('review-modal').hidden = true;
        currentReviewRequest = null;
        loadPendingRequests();
      } catch (error) {
        console.error('Error rejecting request:', error);
        alert('Error rejecting request: ' + (error.message || 'Unknown error'));
      }
    }

    /**
     * Open edit modal for approved resident
     */
    function openEditModal(residentId) {
      const resident = approvedResidents.find(r => r.id === residentId);
      if (!resident) {
        alert('Resident not found');
        return;
      }

      const modal = document.getElementById('res-edit-modal');
      if (!modal) return;

      // Personal Information
      document.getElementById('edit-email').value = resident.email || '';
      document.getElementById('edit-first').value = resident.firstName || '';
      document.getElementById('edit-middle').value = resident.middleName || '';
      document.getElementById('edit-last').value = resident.lastName || '';
      document.getElementById('edit-gender').value = resident.gender || '';
      document.getElementById('edit-birthdate').value = resident.birthDate || '';
      document.getElementById('edit-status').value = resident.status || 'active';
      
      // Contact Information
      document.getElementById('edit-mobilenumber').value = resident.mobileNumber || '';
      document.getElementById('edit-contact').value = resident.contact || '';
      document.getElementById('edit-emergencycontact').value = resident.emergencyContact || '';
      document.getElementById('edit-emergencycontactnumber').value = resident.emergencyContactNumber || '';
      
      // Address Information
      document.getElementById('edit-homeaddress').value = resident.homeAddress || resident.address || '';
      document.getElementById('edit-barangay').value = resident.barangay || '';
      document.getElementById('edit-city').value = resident.city || '';
      document.getElementById('edit-province').value = resident.province || '';
      document.getElementById('edit-zipcode').value = resident.zipCode || '';
      
      // Family Information
      document.getElementById('edit-fathername').value = resident.fatherName || '';
      document.getElementById('edit-mothername').value = resident.motherName || '';

      modal.hidden = false;
      modal.dataset.residentId = residentId;
    }

    /**
     * Open reset password modal
     */
    function openResetPasswordModal(residentId) {
      const modal = document.getElementById('res-reset-modal');
      if (!modal) return;

      modal.hidden = false;
      modal.dataset.residentId = residentId;
    }

    // Event listeners
    document.getElementById('approve-request')?.addEventListener('click', approveRequest);
    document.getElementById('reject-request')?.addEventListener('click', rejectRequest);
    
    document.getElementById('view-id-fullscreen')?.addEventListener('click', function() {
      const fullscreenModal = document.getElementById('id-fullscreen-modal');
      if (fullscreenModal) fullscreenModal.hidden = false;
    });

    document.getElementById('download-id')?.addEventListener('click', function() {
      if (currentReviewRequest?.idDocumentUrl) {
        const link = document.createElement('a');
        link.href = currentReviewRequest.idDocumentUrl;
        link.download = `id_${currentReviewRequest.email?.split('@')[0] || 'document'}.jpg`;
        link.click();
      } else {
        alert('ID document URL not available');
      }
    });

    // Search and filter listeners
    document.getElementById('pending-search')?.addEventListener('input', renderPendingRequests);
    document.getElementById('pending-sort')?.addEventListener('change', renderPendingRequests);
    document.getElementById('approved-search')?.addEventListener('input', renderApprovedResidents);
    document.getElementById('approved-status')?.addEventListener('change', renderApprovedResidents);

    // Save resident edit
    document.getElementById('res-save')?.addEventListener('click', async function() {
      const modal = document.getElementById('res-edit-modal');
      const residentId = modal?.dataset.residentId;
      if (!residentId || !db) return;

      try {
        const updates = {
          // Personal Information
          firstName: document.getElementById('edit-first').value,
          middleName: document.getElementById('edit-middle').value,
          lastName: document.getElementById('edit-last').value,
          email: document.getElementById('edit-email').value,
          gender: document.getElementById('edit-gender').value,
          birthDate: document.getElementById('edit-birthdate').value,
          status: document.getElementById('edit-status').value,
          
          // Contact Information
          mobileNumber: document.getElementById('edit-mobilenumber').value,
          contact: document.getElementById('edit-contact').value,
          emergencyContact: document.getElementById('edit-emergencycontact').value,
          emergencyContactNumber: document.getElementById('edit-emergencycontactnumber').value,
          
          // Address Information
          homeAddress: document.getElementById('edit-homeaddress').value,
          address: document.getElementById('edit-homeaddress').value, // Keep both for compatibility
          barangay: document.getElementById('edit-barangay').value,
          city: document.getElementById('edit-city').value,
          province: document.getElementById('edit-province').value,
          zipCode: document.getElementById('edit-zipcode').value,
          
          // Family Information
          fatherName: document.getElementById('edit-fathername').value,
          motherName: document.getElementById('edit-mothername').value,
          
          updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, 'residents', residentId), updates);
        alert('Resident updated successfully!');
        modal.hidden = true;
        loadApprovedResidents();
      } catch (error) {
        console.error('Error updating resident:', error);
        alert('Error updating resident: ' + (error.message || 'Unknown error'));
      }
    });

    // Reset password
    document.getElementById('res-reset')?.addEventListener('click', async function() {
      const modal = document.getElementById('res-reset-modal');
      const residentId = modal?.dataset.residentId;
      const newPassword = document.getElementById('reset-pass').value;

      if (!newPassword || newPassword.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
      }

      if (!residentId) {
        alert('Resident ID not found');
        return;
      }

      try {
        const resident = approvedResidents.find(r => r.id === residentId);
        if (!resident || !resident.uid) {
          alert('Resident UID not found');
          return;
        }

        // Note: In production, you would need to use Firebase Admin SDK or a Cloud Function
        // to reset passwords, as client SDK doesn't allow password changes for other users
        alert('Password reset functionality requires backend implementation. Please use Firebase Admin SDK or Cloud Functions.');
        
        modal.hidden = true;
        document.getElementById('reset-pass').value = '';
      } catch (error) {
        console.error('Error resetting password:', error);
        alert('Error resetting password: ' + (error.message || 'Unknown error'));
      }
    });
  })();
})();
