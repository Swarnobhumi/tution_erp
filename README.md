# Tution Management System

A management system for tuition centres and small institutions. It lets a single administrator manage students, attendance, fees, and daily operations from one dashboard.

## Features

- **Student Management**: Add, edit, and delete students (name, phone, batch time, fee type and amount). Deleting a student also removes their fee and attendance history.
- **Attendance**: Mark daily attendance (Present / Absent / Late) with per-student notes.
- **Fee Management**: Track monthly dues per student and record payments.
- **Dashboard**: At-a-glance totals — students, pending fees (₹), and present-today — plus a recent-enrolments feed.
- **AI Assistant**: A local NLP assistant (node-nlp) that answers quick data questions such as student count and who has pending fees. Runs fully offline, no external API.
- **Automated Tasks**: Monthly fee records are auto-generated for monthly-plan students via a built-in cron job (node-cron).
- **Secure Admin Login**: JWT-based authentication, with an AES-256 encrypted superadmin recovery flow.

## Demo

Live demo available at: **[https://learningspace.visionfall.in/](https://learningspace.visionfall.in/)**

## Setup & Installation

Follow the steps below to set up the project locally.

### Prerequisites

- Node.js 20.x (see `.node-version`)
- npm (Node Package Manager)

### Installation Steps

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd tution_erp
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Copy Environment File**
    Copy the sample environment file and adjust if necessary.
    ```bash
    cp .env.example .env
    ```

4.  **Database Setup**
    The application uses SQLite by default. The database file will be automatically created when you start the server.

### Configuration (environment variables)

Set these in `.env` (all optional locally; set them for production):

| Variable | Purpose |
| --- | --- |
| `PORT` | Port the server listens on (default `3000`). |
| `ADMIN_USERNAME` | Admin login username (default `superadmin`). |
| `ADMIN_PASSWORD` | Admin login password. If unset, a built-in encrypted fallback is used (recoverable via the login screen's "Recover Superadmin Access"). Set this in production. |
| `JWT_SECRET` | Secret used to sign session tokens. **Set this in production** — if unset in production the server generates a random per-process secret (secure, but sessions are dropped on restart). |
| `NODE_ENV` | Set to `production` on the live server. |

5.  **Run the Server**
    Start the local development server:
    ```bash
    npm start
    ```
    The application will be accessible at `http://localhost:3000`.

### Superadmin Credentials

The superadmin credentials have been securely encrypted (AES-256-CBC) so they are safe even in a public repository. To decrypt them, use your primary email address as the key.

**Encrypted Data**:
`52d41f9ab48dcb6b8a5a6f430ad32367:e5ddcb4b28c6bc3d9a6269cebdbb03f9b8f080eaedfaadffb39214ad4aac400f34ae2080513c56dc3cdf495e13bb05c1e8e482d9802ed874fc2e3384f1c5874c`

**How to Decrypt (Node.js snippet)**:
```javascript
const crypto = require('crypto');
const emailKey = 'your_email_here'; // Use your main email address
const data = '52d41f9ab48dcb6b8a5a6f430ad32367:e5ddcb4b28c6bc3d9a6269cebdbb03f9b8f080eaedfaadffb39214ad4aac400f34ae2080513c56dc3cdf495e13bb05c1e8e482d9802ed874fc2e3384f1c5874c';
const [ivHex, encrypted] = data.split(':');
const key = crypto.scryptSync(emailKey, 'salt', 32);
const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
let decrypted = decipher.update(encrypted, 'hex', 'utf8');
decrypted += decipher.final('utf8');
console.log(decrypted);
```

### Deployment

**Render.com**
A `render.yaml` file is included for easy deployment to Render (Infrastructure as Code). Just connect your repository in the Render Dashboard and it will automatically provision the Node.js web service.

**Hostinger / cPanel**
A `.htaccess` file is provided to enable Passenger for Node.js out of the box, ensuring seamless SPA routing and API fallbacks.

### GitHub Actions

A `.github/workflows/auto-sync.yml` workflow is included to automatically keep your fork synced with the upstream repository.
