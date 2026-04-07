/**
 * Local configuration (secrets) for iSagip.
 *
 * 1. Copy this file to: assets/js/isagip-config.js
 * 2. Fill in your Firebase, Google Maps, and EmailJS values.
 * 3. isagip-config.js is listed in .gitignore and is not pushed to GitHub.
 */
window.__ISAGIP_CONFIG__ = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
  },
  googleMapsApiKey: '',
  emailjs: {
    publicKey: 'YOUR_EMAILJS_PUBLIC_KEY',
    serviceId: '',
    templateMassRegistration: '',
    templateResident: ''
  }
};
