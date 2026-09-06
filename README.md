# Tution Management System

A comprehensive ERP system for managing tuitions and educational institutions. This application allows you to manage students, staff, batches, fees, attendance, and daily operations.

## Features

- **Student Management**: Add, edit, and track student information.
- **Staff Management**: Manage teacher profiles and assignments.
- **Batch Management**: Create and manage batches with schedules.
- **Fee Management**: Track fee payments, installments, and dues.
- **Attendance**: Mark and monitor student attendance.
- **User Management**: Secure login with role-based access (Admin/Staff).
- **Dashboard**: Quick overview of statistics and analytics.

## Demo

Live demo available at: **[https://learningspace.visionfall.in/](https://learningspace.visionfall.in/)**

## Setup & Installation

Follow the steps below to set up the project locally.

### Prerequisites

- Node.js >= 18.x
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
