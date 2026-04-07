# iSagip

Web dashboard for emergency / barangay coordination: incident reports, responders, residents, and admin tools. Static HTML, CSS, and JavaScript with **Firebase** (Auth, Firestore), optional **Google Maps** heatmaps on the dashboard, and **EmailJS** for registration emails.

## Run locally

1. Clone the repository.
2. Copy the example config and add your own keys (this file is **not** committed):

   ```text
   copy assets\js\isagip-config.example.js assets\js\isagip-config.js
   ```

   On macOS/Linux:

   ```bash
   cp assets/js/isagip-config.example.js assets/js/isagip-config.js
   ```

3. Fill in `firebase`, `googleMapsApiKey`, and `emailjs` in `assets/js/isagip-config.js`.
4. Open the site with a local server (Firebase and modules expect HTTP(S)), for example:

   ```bash
   npx --yes serve .
   ```

   Then open the URL it prints (often `http://localhost:3000`) and start from `index.html`.

## More documentation

- `mdfiles/EMAILJS_SETUP.md` — EmailJS templates and IDs  
- `mdfiles/MASS_REGISTRATION_GUIDE.md` — mass registration flow  
- `mdfiles/GITHUB_SETUP.md` — Git remotes and GitHub basics  

## License

Add a `LICENSE` file if you want to specify terms for reuse.
