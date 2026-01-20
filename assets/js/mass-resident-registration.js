/**
 * Mass Registration System for Residents
 * Handles CSV upload, manual entry, and automated account creation with email notifications
 */

(function() {
  'use strict';

  // Initialize EmailJS (you'll need to set your public key)
  const EMAILJS_PUBLIC_KEY = 'HdfCtAM1oRBEUuyy9'; // Same as staff registration
  const EMAILJS_SERVICE_ID = 'service_c04v2hd'; // Same as staff registration
  const EMAILJS_TEMPLATE_ID = 'template_gyywi28'; // You can use the same template or create a new one

  // Initialize EmailJS if public key is set
  if (EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY' && typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  let parsedData = [];
  let currentMode = 'csv';

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
      if (!file) return;

      fileName.textContent = 'Selected: ' + file.name;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const csv = e.target.result;
          parsedData = parseCSV(csv);
          displayCSVPreview(parsedData);
        } catch (error) {
          alert('Error parsing CSV: ' + error.message);
          fileName.textContent = '';
          preview.style.display = 'none';
        }
      };
      reader.readAsText(file);
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
   * Expected format: Email, Full Name, Gender, Birth Date, Contact, Address
   * Full Name format: "Last Name, First Name Middle Name" or "Last Name, First Name"
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
      if (values.length < 4) continue; // Skip empty rows

      const email = values[0] || '';
      const fullName = values[1] || '';
      const gender = values[2] || '';
      const birthDate = values[3] || '';
      const contact = values[4] || '';
      const address = values[5] || '';

      // Parse Full Name into Last Name, First Name, Middle Name
      let lastName = '';
      let firstName = '';
      let middleName = '';
      
      if (fullName) {
        const nameParts = fullName.split(',').map(p => p.trim());
        if (nameParts.length >= 2) {
          lastName = nameParts[0];
          const firstMiddleParts = nameParts[1].split(/\s+/).filter(p => p);
          if (firstMiddleParts.length >= 1) {
            firstName = firstMiddleParts[0];
            if (firstMiddleParts.length > 1) {
              middleName = firstMiddleParts.slice(1).join(' ');
            }
          }
        } else {
          // If no comma, treat entire string as last name (fallback)
          lastName = fullName;
        }
      }

      // Format fullName to match manual entry format: "Last Name, First Name Middle Name"
      const formattedFullName = lastName && firstName 
        ? `${lastName}, ${firstName}${middleName ? ' ' + middleName : ''}` 
        : fullName; // Fallback to original if parsing failed

      const entry = {
        email: email.toLowerCase(),
        fullName: formattedFullName,
        lastName: lastName,
        firstName: firstName,
        middleName: middleName || '',
        gender: gender,
        birthDate: birthDate,
        contact: contact,
        address: address
      };

      // Validate entry
      if (!entry.email || !entry.lastName || !entry.firstName || !entry.gender || !entry.birthDate || !entry.contact || !entry.address) {
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
    html += '<th>Email</th><th>Full Name</th><th>Gender</th><th>Birth Date</th><th>Contact</th><th>Address</th>';
    html += '</tr></thead><tbody>';

    data.forEach(entry => {
      html += '<tr>';
      html += '<td>' + escapeHtml(entry.email) + '</td>';
      html += '<td>' + escapeHtml(entry.fullName) + '</td>';
      html += '<td>' + escapeHtml(entry.gender) + '</td>';
      html += '<td>' + escapeHtml(entry.birthDate) + '</td>';
      html += '<td>' + escapeHtml(entry.contact) + '</td>';
      html += '<td>' + escapeHtml(entry.address) + '</td>';
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

    // Add event listeners to existing rows
    entriesContainer.querySelectorAll('.entry-row').forEach(row => {
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
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Gender *</span>
          <select class="input entry-gender" required>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </label>
        <label>
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Birth Date *</span>
          <input type="date" class="input entry-birthdate" required />
        </label>
        <label>
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Contact *</span>
          <input type="tel" class="input entry-contact" placeholder="09123456789" required />
        </label>
        <label style="grid-column: 1/-1;">
          <span style="font-size: 12px; color: var(--muted); margin-bottom: 4px; display: block;">Address *</span>
          <input type="text" class="input entry-address" placeholder="Street Address" required />
        </label>
        <button type="button" class="remove-row-btn">Remove</button>
      `;

      entriesContainer.appendChild(newRow);

      // Setup event listeners for new row
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
      const gender = row.querySelector('.entry-gender')?.value;
      const birthDate = row.querySelector('.entry-birthdate')?.value;
      const contact = row.querySelector('.entry-contact')?.value.trim();
      const address = row.querySelector('.entry-address')?.value.trim();

      const fullName = (lastName && firstName) 
        ? `${lastName}, ${firstName}${middleName ? ' ' + middleName : ''}` 
        : '';

      if (email && lastName && firstName && gender && birthDate && contact && address) {
        entries.push({
          email: email.toLowerCase(),
          fullName: fullName,
          lastName: lastName,
          firstName: firstName,
          middleName: middleName || '',
          gender: gender,
          birthDate: birthDate,
          contact: contact,
          address: address
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
        alert('Please add at least one resident to register.');
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
        if (!entry.gender) {
          validationErrors.push(`Row ${index + 1}: Gender is required`);
        }
        if (!entry.birthDate) {
          validationErrors.push(`Row ${index + 1}: Birth date is required`);
        }
        if (!entry.contact) {
          validationErrors.push(`Row ${index + 1}: Contact number is required`);
        }
        if (!entry.address) {
          validationErrors.push(`Row ${index + 1}: Address is required`);
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
      if (!confirm(`Are you sure you want to register ${data.length} resident(s)? Account credentials will be sent to their email addresses.`)) {
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
        const result = await registerResident(entry);
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
    submitBtn.textContent = 'REGISTER ALL RESIDENTS';
    progressText.textContent = `Completed: ${results.success.length} successful, ${results.errors.length} failed`;
  }

  /**
   * Register a single resident
   */
  async function registerResident(entry) {
    const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");
    const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");

    const auth = window.iSagipAuth;
    const db = window.iSagipDb;

    // Generate password
    const password = generatePassword(12);

    // Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, entry.email, password);
    const user = userCredential.user;

    // Prepare resident data for Firestore
    const residentData = {
      uid: user.uid,
      email: entry.email,
      firstName: entry.firstName || '',
      middleName: entry.middleName || '',
      lastName: entry.lastName || '',
      gender: entry.gender || '',
      birthDate: entry.birthDate || '',
      mobileNumber: entry.contact || '',
      contact: entry.contact || '',
      homeAddress: entry.address || '',
      address: entry.address || '',
      status: 'active',
      approvedAt: serverTimestamp(),
      approvedBy: localStorage.getItem('iSagip_userUID') || '',
      createdAt: serverTimestamp()
    };

    // Save to Firestore residents collection
    await setDoc(doc(db, 'residents', user.uid), residentData);

    // Send email with credentials
    try {
      await sendCredentialsEmail(entry.email, entry.fullName, password);
    } catch (emailError) {
      console.warn('Failed to send email for', entry.email, ':', emailError);
      // Don't fail the registration if email fails
    }

    return { password, uid: user.uid };
  }

  /**
   * Send credentials email via EmailJS
   */
  async function sendCredentialsEmail(email, fullName, password) {
    // Check if EmailJS is configured
    if (typeof emailjs === 'undefined') {
      console.warn('EmailJS is not available on this page. Email will not be sent.');
      // Log the credentials to console for manual distribution
      console.log(`=== CREDENTIALS FOR ${email.toUpperCase()} ===`);
      console.log(`Name: ${fullName}`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      console.log(`=========================================`);
      // Store credentials in a global array for potential export
      if (!window.residentRegistrationCredentials) {
        window.residentRegistrationCredentials = [];
      }
      window.residentRegistrationCredentials.push({
        email: email,
        name: fullName,
        password: password
      });
      return;
    }

    try {
      const templateParams = {
        to_email: email,
        to_name: fullName,
        password: password,
        role: 'resident',
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
    let csv = 'Email,Full Name,Password\n';
    
    credentials.forEach(cred => {
      csv += `"${cred.email}","${cred.name}","${cred.password}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isagip-resident-credentials-${new Date().toISOString().split('T')[0]}.csv`;
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
