/**
 * Mass Registration System for Staff and Responders
 * Handles CSV upload, manual entry, and automated account creation with email notifications
 */

(function() {
  'use strict';

  var _ej = (window.__ISAGIP_CONFIG__ && window.__ISAGIP_CONFIG__.emailjs) || {};
  const EMAILJS_PUBLIC_KEY = _ej.publicKey || 'YOUR_EMAILJS_PUBLIC_KEY';
  const EMAILJS_SERVICE_ID = _ej.serviceId || '';
  const EMAILJS_TEMPLATE_ID = _ej.templateMassRegistration || '';

  if (EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY' && typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  let parsedData = [];
  let currentMode = 'manual';

  // ========================================
  // MODE SETUP (CSV / MANUAL TOGGLE)
  // ========================================
  (function setupMode() {
    const csvSection = document.getElementById('csv-section');
    const manualSection = document.getElementById('manual-section');
    const csvModeBtn = document.getElementById('csv-mode-btn');
    const manualModeBtn = document.getElementById('manual-mode-btn');

    if (!csvSection || !manualSection) return;

    // Set default mode to CSV
    currentMode = 'csv';
    csvSection.style.display = 'block';
    manualSection.style.display = 'none';
    if (csvModeBtn) csvModeBtn.classList.add('active');
    if (manualModeBtn) manualModeBtn.classList.remove('active');

    // CSV mode button
    if (csvModeBtn) {
      csvModeBtn.addEventListener('click', function() {
        currentMode = 'csv';
        csvSection.style.display = 'block';
        manualSection.style.display = 'none';
        csvModeBtn.classList.add('active');
        manualModeBtn.classList.remove('active');
      });
    }

    // Manual mode button
    if (manualModeBtn) {
      manualModeBtn.addEventListener('click', function() {
        currentMode = 'manual';
        csvSection.style.display = 'none';
        manualSection.style.display = 'block';
        csvModeBtn.classList.remove('active');
        manualModeBtn.classList.add('active');
      });
    }
  })();

  // ========================================
  // CSV UPLOAD HANDLING
  // ========================================
  (function setupCSVUpload() {
    const fileInput = document.getElementById('csv-file-input');
    const fileName = document.getElementById('csv-file-name');
    const preview = document.getElementById('csv-preview');
    const uploadSection = document.querySelector('.upload-section');

    if (!fileInput) return;

    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) {
        console.log('No file selected');
        return;
      }

      // Validate file type
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
        alert('Please select a CSV file.');
        fileInput.value = '';
        return;
      }

      fileName.textContent = 'Selected: ' + file.name;

      const reader = new FileReader();
      reader.onerror = function() {
        alert('Error reading file. Please try again.');
        fileName.textContent = '';
        preview.style.display = 'none';
        fileInput.value = '';
      };
      reader.onload = function(e) {
        try {
          const csv = e.target.result;
          if (!csv || csv.trim().length === 0) {
            throw new Error('CSV file is empty');
          }
          parsedData = parseCSV(csv);
          if (!parsedData || parsedData.length === 0) {
            throw new Error('No valid data found in CSV file');
          }
          displayCSVPreview(parsedData);
        } catch (error) {
          console.error('CSV parsing error:', error);
          alert('Error parsing CSV: ' + error.message);
          fileName.textContent = '';
          preview.style.display = 'none';
          fileInput.value = '';
        }
      };
      reader.readAsText(file, 'UTF-8');
    });

    // Drag and drop
    if (uploadSection) {
      uploadSection.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadSection.classList.add('dragover');
      });

      uploadSection.addEventListener('dragleave', function() {
        uploadSection.classList.remove('dragover');
      });

      uploadSection.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadSection.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event('change'));
        } else {
          alert('Please drop a CSV file.');
        }
      });
    }
  })();

  /**
   * Parse CSV content
   * Expected format: Email, Last Name, First Name, Middle Name, Age, Role, Responder Type (optional)
   */
  function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 5) continue; // Skip empty rows (need at least Email, Last Name, First Name, Age, Role)

      const email = values[0] || '';
      const lastName = values[1] || '';
      const firstName = values[2] || '';
      const middleName = values[3] || '';
      const age = parseInt(values[4]) || 0;
      const role = (values[5] || 'barangay_staff').toLowerCase();
      const responderType = values[6] || 'Fire';

      // Format fullName to match manual entry format: "Last Name, First Name Middle Name"
      const formattedFullName = lastName && firstName 
        ? `${lastName}, ${firstName}${middleName ? ' ' + middleName : ''}` 
        : `${lastName || ''}, ${firstName || ''}`.trim();

      const entry = {
        email: email.toLowerCase(),
        fullName: formattedFullName,
        lastName: lastName,
        firstName: firstName,
        middleName: middleName || '',
        age: age,
        role: role,
        responderType: role === 'responder' ? responderType : null
      };

      // Validate entry
      if (!entry.email || !entry.email.includes('@') || !entry.lastName || !entry.firstName || !entry.age || entry.age < 1) {
        console.warn('Skipping invalid row:', entry);
        continue;
      }

      data.push(entry);
    }

    return data;
  }

  /**
   * Display CSV preview
   */
  function displayCSVPreview(data) {
    const preview = document.getElementById('csv-preview');
    if (!preview || data.length === 0) return;

    let html = '<table><thead><tr>';
    html += '<th>Email</th><th>Full Name</th><th>Age</th><th>Role</th><th>Responder Type</th>';
    html += '</tr></thead><tbody>';

    data.forEach(entry => {
      html += '<tr>';
      html += '<td>' + escapeHtml(entry.email) + '</td>';
      html += '<td>' + escapeHtml(entry.fullName) + '</td>';
      html += '<td>' + entry.age + '</td>';
      html += '<td>' + escapeHtml(entry.role) + '</td>';
      html += '<td>' + escapeHtml(entry.responderType || '-') + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    preview.innerHTML = html;
    preview.style.display = 'block';
  }

  // ========================================
  // MANUAL ENTRY HANDLING
  // ========================================
  (function setupManualEntry() {
    const addBtn = document.getElementById('add-entry-btn');
    const entriesContainer = document.getElementById('manual-entries');

    if (!addBtn || !entriesContainer) return;

    // Toggle responder type field based on role
    function toggleResponderType(row) {
      const roleSelect = row.querySelector('.entry-role');
      const responderWrap = row.querySelector('.entry-responder-type-wrap');
      if (roleSelect && responderWrap) {
        responderWrap.style.display = roleSelect.value === 'responder' ? 'block' : 'none';
      }
    }

    // Add event listeners to existing rows
    entriesContainer.querySelectorAll('.entry-row').forEach(row => {
      const roleSelect = row.querySelector('.entry-role');
      if (roleSelect) {
        roleSelect.addEventListener('change', () => toggleResponderType(row));
        toggleResponderType(row);
      }

      const removeBtn = row.querySelector('.remove-row-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          if (entriesContainer.querySelectorAll('.entry-row').length > 1) {
            row.remove();
          }
        });
      }
    });

    addBtn.addEventListener('click', function() {
      const newRow = document.createElement('div');
      newRow.className = 'entry-row';
      newRow.innerHTML = `
        <label>
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Email *</span>
          <input type="email" class="input entry-email" placeholder="email@example.com" required />
        </label>
        <label>
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Last Name *</span>
          <input type="text" class="input entry-last-name" placeholder="Dela Cruz" required />
        </label>
        <label>
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">First Name *</span>
          <input type="text" class="input entry-first-name" placeholder="Juan" required />
        </label>
        <label>
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Middle Name</span>
          <input type="text" class="input entry-middle-name" placeholder="Santos" />
        </label>
        <label>
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Age *</span>
          <input type="number" class="input entry-age" placeholder="25" min="1" max="120" required />
        </label>
        <label>
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Role *</span>
          <select class="input entry-role" required>
            <option value="responder">Responder</option>
            <option value="barangay_staff">Barangay Staff</option>
          </select>
        </label>
        <label class="entry-responder-type-wrap">
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Responder Type *</span>
          <select class="input entry-responder-type">
            <option value="Fire">Fire</option>
            <option value="Medic">Medic</option>
            <option value="Tanod">Tanod</option>
          </select>
        </label>
        <button type="button" class="remove-row-btn">Remove</button>
      `;

      entriesContainer.appendChild(newRow);

      // Setup event listeners for new row
      const roleSelect = newRow.querySelector('.entry-role');
      if (roleSelect) {
        roleSelect.addEventListener('change', () => toggleResponderType(newRow));
        toggleResponderType(newRow);
      }

      const removeBtn = newRow.querySelector('.remove-row-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          if (entriesContainer.querySelectorAll('.entry-row').length > 1) {
            newRow.remove();
          }
        });
      }

      // Show remove button on all rows when there's more than one
      entriesContainer.querySelectorAll('.remove-row-btn').forEach(btn => {
        if (entriesContainer.querySelectorAll('.entry-row').length > 1) {
          btn.style.display = 'block';
        }
      });
    });
  })();

  /**
   * Get data from manual entries
   */
  function getManualEntries() {
    const entries = [];
    const rows = document.querySelectorAll('#manual-entries .entry-row');

    rows.forEach(row => {
      const email = row.querySelector('.entry-email')?.value.trim();
      const lastName = row.querySelector('.entry-last-name')?.value.trim();
      const firstName = row.querySelector('.entry-first-name')?.value.trim();
      const middleName = row.querySelector('.entry-middle-name')?.value.trim();
      const age = parseInt(row.querySelector('.entry-age')?.value);
      const role = row.querySelector('.entry-role')?.value;
      const responderType = row.querySelector('.entry-responder-type')?.value || 'Fire';

      const fullName = (lastName && firstName) 
        ? `${lastName}, ${firstName}${middleName ? ' ' + middleName : ''}` 
        : '';

      if (email && lastName && firstName && age && age > 0 && role) {
        entries.push({
          email: email.toLowerCase(),
          fullName: fullName,
          lastName: lastName,
          firstName: firstName,
          middleName: middleName || '',
          age: age,
          role: role,
          responderType: role === 'responder' ? responderType : null
        });
      }
    });

    return entries;
  }

  // ========================================
  // PASSWORD GENERATION
  // ========================================
  /**
   * Generate a random secure password
   */
  function generatePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  // ========================================
  // REGISTRATION PROCESS
  // ========================================
  (function setupRegistration() {
    const submitBtn = document.getElementById('submit-registration');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async function() {
      // Get data based on current mode
      let data = [];
      if (currentMode === 'csv') {
        data = parsedData;
      } else {
        data = getManualEntries();
      }

      if (data.length === 0) {
        alert('Please add at least one user to register.');
        return;
      }

      // Validate data
      const validationErrors = [];
      data.forEach((entry, index) => {
        if (!entry.email || !isValidEmail(entry.email)) {
          validationErrors.push(`Row ${index + 1}: Invalid email address`);
        }
        if (!entry.lastName || !entry.firstName) {
          validationErrors.push(`Row ${index + 1}: First and last name are required`);
        }
        if (!entry.age || entry.age < 1 || entry.age > 120) {
          validationErrors.push(`Row ${index + 1}: Age must be between 1 and 120`);
        }
        if (!entry.role || !['responder', 'barangay_staff'].includes(entry.role)) {
          validationErrors.push(`Row ${index + 1}: Invalid role`);
        }
        if (entry.role === 'responder' && !entry.responderType) {
          validationErrors.push(`Row ${index + 1}: Responder type is required for responders`);
        }
      });

      if (validationErrors.length > 0) {
        alert('Validation errors:\n' + validationErrors.join('\n'));
        return;
      }

      // Check Firebase availability
      if (!window.iSagipAuth || !window.iSagipDb) {
        alert('Firebase is not initialized. Please refresh the page.');
        return;
      }

      // Confirm before proceeding
      if (!confirm(`Are you sure you want to register ${data.length} user(s)? Account credentials will be sent to their email addresses.`)) {
        return;
      }

      // Start registration process
      await processRegistrations(data);
    });
  })();

  /**
   * Process all registrations
   */
  async function processRegistrations(data) {
    const progressSection = document.getElementById('progress-section');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const resultsSummary = document.getElementById('results-summary');
    const submitBtn = document.getElementById('submit-registration');

    // Show progress section
    progressSection.classList.add('active');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    const results = {
      success: [],
      errors: []
    };

    // Process each registration
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      const progress = ((i + 1) / data.length) * 100;

      progressFill.style.width = progress + '%';
      progressFill.textContent = Math.round(progress) + '%';
      progressText.textContent = `Processing ${i + 1} of ${data.length}: ${entry.email}`;

      try {
        const result = await registerUser(entry);
        results.success.push({
          email: entry.email,
          name: entry.fullName,
          password: result.password
        });
      } catch (error) {
        results.errors.push({
          email: entry.email,
          name: entry.fullName,
          error: error.message
        });
      }

      // Small delay to prevent overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Display results
    displayResults(results);

    // Show export button if EmailJS is not configured and there are successful registrations
    if (EMAILJS_PUBLIC_KEY === 'YOUR_EMAILJS_PUBLIC_KEY' && results.success.length > 0) {
      showCredentialsExport(results.success);
    }

    // Reset UI
    submitBtn.disabled = false;
    submitBtn.textContent = 'REGISTER ALL USERS';
    progressText.textContent = `Completed: ${results.success.length} successful, ${results.errors.length} failed`;
  }

  /**
   * Register a single user
   */
  async function registerUser(entry) {
    const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");
    const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");

    const auth = window.iSagipAuth;
    const db = window.iSagipDb;

    // Generate password
    const password = generatePassword(12);

    // Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, entry.email, password);
    const user = userCredential.user;

    // Prepare user data for Firestore
    const userData = {
      uid: user.uid,
      email: entry.email,
      authEmail: entry.email,
      role: entry.role,
      fullName: entry.fullName,
      age: entry.age,
      createdAt: serverTimestamp(),
      status: 'active'
    };

    // Add responder type if role is responder
    if (entry.role === 'responder' && entry.responderType) {
      userData.responderType = entry.responderType;
    }

    // Save to Firestore
    if (entry.role === 'responder') {
      await setDoc(doc(db, 'responder', user.uid), userData);
    } else {
      await setDoc(doc(db, 'staff', user.uid), userData);
    }

    // Send email with credentials
    try {
      await sendCredentialsEmail(entry.email, entry.fullName, password, entry.role);
    } catch (emailError) {
      console.warn('Failed to send email for', entry.email, ':', emailError);
      // Don't fail the registration if email fails
    }

    return { password, uid: user.uid };
  }

  /**
   * Send credentials email via EmailJS
   */
  async function sendCredentialsEmail(email, fullName, password, role) {
    // Check if EmailJS is configured
    if (typeof emailjs === 'undefined') {
      console.warn('EmailJS is not available on this page. Email will not be sent.');
      // Log the credentials to console for manual distribution
      console.log(`=== CREDENTIALS FOR ${email.toUpperCase()} ===`);
      console.log(`Name: ${fullName}`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      console.log(`Role: ${role}`);
      console.log(`=========================================`);
      // Store credentials in a global array for potential export
      if (!window.registrationCredentials) {
        window.registrationCredentials = [];
      }
      window.registrationCredentials.push({
        email: email,
        name: fullName,
        password: password,
        role: role
      });
      return;
    }

    try {
      const templateParams = {
        to_email: email,
        to_name: fullName,
        password: password,
        role: role,
        login_url: window.location.origin + '/index.html'
      };

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
    } catch (error) {
      console.error('EmailJS error:', error);
      throw new Error('Failed to send email: ' + error.text);
    }
  }

  /**
   * Display registration results
   */
  function displayResults(results) {
    const resultsSummary = document.getElementById('results-summary');
    if (!resultsSummary) return;

    let html = '<h4 style="margin-bottom: 12px;">Registration Results</h4>';

    if (results.success.length > 0) {
      html += '<div style="margin-bottom: 16px;"><strong class="result-success">✓ Successful (' + results.success.length + '):</strong>';
      results.success.forEach(result => {
        html += '<div class="result-item">';
        html += '<span>' + escapeHtml(result.name) + ' (' + escapeHtml(result.email) + ')</span>';
        html += '<span class="result-success">✓ Created</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (results.errors.length > 0) {
      html += '<div><strong class="result-error">✗ Failed (' + results.errors.length + '):</strong>';
      results.errors.forEach(result => {
        html += '<div class="result-item">';
        html += '<span>' + escapeHtml(result.name) + ' (' + escapeHtml(result.email) + ')</span>';
        html += '<span class="result-error">✗ ' + escapeHtml(result.error) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    resultsSummary.innerHTML = html;
    resultsSummary.style.display = 'block';
  }

  /**
   * Show credentials export button
   */
  function showCredentialsExport(successfulRegistrations) {
    const resultsSummary = document.getElementById('results-summary');
    if (!resultsSummary) return;

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-secondary';
    exportBtn.textContent = '📥 Export Credentials as CSV';
    exportBtn.style.marginTop = '16px';
    exportBtn.addEventListener('click', function() {
      exportCredentialsCSV(successfulRegistrations);
    });

    resultsSummary.appendChild(exportBtn);
  }

  /**
   * Export credentials to CSV
   */
  function exportCredentialsCSV(credentials) {
    let csv = 'Email,Full Name,Password,Role\n';
    
    credentials.forEach(cred => {
      csv += `"${cred.email}","${cred.name}","${cred.password}","${cred.role}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isagip-credentials-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();

