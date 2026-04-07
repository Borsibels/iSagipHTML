# Mass Registration System - Implementation Guide

## Overview

The mass registration system has been implemented to replace individual staff/responder registration. This new system allows administrators to register multiple staff members and responders at once, with automatic account creation and credential distribution via email.

## What Changed

### New Files Created

1. **`mass-register-staff.html`** - New mass registration page
2. **`assets/js/mass-registration.js`** - Mass registration logic and functionality
3. **`staff-registration-template.csv`** - CSV template for bulk uploads
4. **`EMAILJS_SETUP.md`** - Guide for setting up email notifications
5. **`MASS_REGISTRATION_GUIDE.md`** - This file

### Files Modified

1. **Navigation Links Updated** - All pages now link to `mass-register-staff.html` instead of `register-staff.html`:
   - `dashboard.html`
   - `reports.html`
   - `resident-management.html`
   - `settings.html`
   - `register-resident.html`
   - `ambulance.html`
   - `assets/js/script.js` (role-based routing)

### Old Files (Still Available)

- `register-staff.html` - Old individual registration page (can be removed if no longer needed)
- `register.html` - Alternative registration page (can be removed if no longer needed)

## Features

### 1. CSV Upload
- Upload a CSV file with staff/responder information
- CSV format: `Email, Full Name, Age, Role, Responder Type`
- Preview uploaded data before registration
- Download template CSV file

### 2. Manual Entry
- Add entries one by one through a form
- Add/remove entry rows dynamically
- Real-time validation

### 3. Automatic Account Creation
- Generates secure random passwords (12 characters)
- Creates Firebase Authentication accounts
- Saves user data to Firestore (`staff` or `responder` collections)
- Calculates age from birth date (if provided)

### 4. Email Notifications
- Sends credentials via EmailJS (when configured)
- Falls back to console logging and CSV export if EmailJS not configured
- Includes login URL and role information

### 5. Progress Tracking
- Real-time progress bar
- Success/error summary
- Detailed error messages

## Data Collected

The mass registration system collects minimal information:

- **Email** (required) - Used for login and credential delivery
- **Full Name** (required) - User's complete name
- **Age** (required) - User's age
- **Role** (required) - Either `responder` or `barangay_staff`
- **Responder Type** (conditional) - Required only if role is `responder` (Fire/Medic/Tanod)

## CSV Format

```csv
Email,Full Name,Age,Role,Responder Type
john.doe@example.com,John Doe,30,responder,Fire
jane.smith@example.com,Jane Smith,25,barangay_staff,
bob.wilson@example.com,Bob Wilson,35,responder,Medic
```

**Notes:**
- Header row is required
- Email must be valid
- Age must be a number between 1-120
- Role must be `responder` or `barangay_staff`
- Responder Type is optional for barangay_staff, required for responders
- Empty Responder Type field for barangay_staff (can leave blank)

## Setup Instructions

### 1. EmailJS Configuration (Recommended)

To enable automatic email sending:

1. Follow the instructions in `EMAILJS_SETUP.md`
2. Get your EmailJS Public Key, Service ID, and Template ID
3. Open `assets/js/mass-registration.js`
4. Update these constants:
   ```javascript
   const EMAILJS_PUBLIC_KEY = 'your_public_key_here';
   const EMAILJS_SERVICE_ID = 'service_xxxxx';
   const EMAILJS_TEMPLATE_ID = 'template_xxxxx';
   ```

### 2. Without EmailJS

If EmailJS is not configured:
- Credentials will be logged to the browser console
- An "Export Credentials as CSV" button will appear after registration
- You can manually distribute the CSV file to users

## Usage

### Using CSV Upload

1. Navigate to **Mass Staff Registration** from the sidebar
2. Click **CSV Upload** tab (default)
3. Download the CSV template if needed
4. Fill in the template with user information
5. Click **Choose CSV File** and select your CSV
6. Review the preview table
7. Click **REGISTER ALL USERS**

### Using Manual Entry

1. Navigate to **Mass Staff Registration** from the sidebar
2. Click **Manual Entry** tab
3. Fill in the form fields for each user
4. Click **+ Add Another Entry** to add more users
5. Click **REGISTER ALL USERS**

## Security Considerations

1. **Password Generation**: Uses cryptographically secure random passwords (12 characters, mixed case, numbers, symbols)
2. **Email Delivery**: Credentials are sent via email only (never displayed on screen)
3. **Firebase Security**: Uses Firebase Authentication for secure account management
4. **Data Storage**: User data stored in Firestore with proper role-based collections

## Error Handling

The system handles various error scenarios:

- **Invalid Email**: Validates email format
- **Duplicate Email**: Firebase will reject duplicate emails
- **Missing Fields**: Validates all required fields
- **Invalid Age**: Must be between 1-120
- **Email Send Failures**: Logs errors but doesn't fail registration
- **Network Issues**: Shows appropriate error messages

## Troubleshooting

### Emails Not Sending
- Check EmailJS configuration in `mass-registration.js`
- Verify EmailJS service is connected
- Check browser console for errors
- Use CSV export as fallback

### Registration Fails
- Check Firebase connection
- Verify user has admin/system_admin role
- Check browser console for detailed errors
- Ensure all required fields are filled

### CSV Upload Issues
- Ensure CSV has header row
- Check CSV format matches template
- Verify no special characters in email addresses
- Check file encoding (should be UTF-8)

## Future Enhancements

Potential improvements:
- Password reset functionality
- Bulk user management (edit/delete)
- Import from Excel files
- Role-based access control for registration
- Audit log of registrations
- Email template customization

## Support

For issues or questions:
1. Check browser console for error messages
2. Review Firebase console for authentication errors
3. Verify EmailJS service status
4. Check network connectivity

