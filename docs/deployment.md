# Whisper Slate — Deployment Guide

This guide covers running Whisper Slate in a classroom environment on a local network (no internet required).

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Student Phones │────▶│  Teacher Laptop │────▶│  Teacher Screen │
│  (Student App)  │ LAN │  (Server +      │ HDMI│  (Dashboard)    │
│  PWA / Browser  │     │  Teacher App)   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Travel Router  │
                       │  (WiFi AP, no   │
                       │   internet)     │
                       └─────────────────┘
```

**All components run on the teacher's laptop.** Students only need a browser on their phones.

---

## Hardware Requirements

| Component | Spec | Notes |
|-----------|------|-------|
| Teacher Laptop | 8+ GB RAM, 4+ cores | Runs FastAPI server + teacher dashboard |
| Travel Router | Any OpenWrt / GL.iNet / TP-Link | Creates isolated WiFi network (AP mode, no WAN) |
| Student Devices | Any phone/tablet with browser | Chrome, Safari, Firefox — PWA supported |

---

## Network Setup

### 1. Configure Travel Router

1. Connect router to teacher laptop via Ethernet (or use laptop's WiFi as AP if no router)
2. Set router to **Access Point mode** (no WAN/internet connection)
3. Enable **DHCP server** — students get IPs automatically
4. Set SSID to something recognizable: `Classroom-WhisperSlate`
5. Note the router's LAN IP (typically `192.168.8.1` for GL.iNet, `192.168.0.1` for TP-Link)

### 2. Find Teacher Laptop LAN IP

On the teacher laptop, run:

```bash
# Linux / macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# Or (if using WiFi)
ipconfig getifaddr en0
```

You'll see something like `192.168.8.105` — this is the **LAN IP** students will connect to.

---

## Server Setup (Teacher Laptop)

### 1. Install Dependencies

```bash
cd server

# Python 3.10+ required
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# For production: install faster-whisper with CUDA if GPU available
# pip install faster-whisper[cuda]
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values:
# - JWT_SECRET: Generate with `openssl rand -hex 32`
# - AUTH_COLLEGE_IDS: "student1:pass1,student2:pass2" (for demo)
# - CORS_ORIGINS: "http://<LAN_IP>:5173" (teacher app URL)
# - OCR_ENABLED: "true" if you want OCR on slides (requires tesseract)
```

### 3. Run Server

```bash
# Development (with auto-reload)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Production (single worker, no reload)
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Verify:** Open `http://<LAN_IP>:8000/ping` — should return `{"status":"ok"}`.

---

## Teacher App Setup

### 1. Build for Production

```bash
cd teacher-app

# Install dependencies
npm install

# Set API URL to server's LAN IP
echo "VITE_API_URL=http://<LAN_IP>:8000" > .env

# Build
npm run build

# Preview production build (serves on port 5173)
npm run preview -- --host 0.0.0.0 --port 5173
```

**Verify:** Open `http://<LAN_IP>:5173/teacher` on teacher laptop — should show dashboard.

---

## Student App Setup

### 1. Build for Production

```bash
cd student-app

# Install dependencies
npm install

# Set API URL to server's LAN IP (same as teacher app)
echo "VITE_API_URL=http://<LAN_IP>:8000" > .env

# Build
npm run build

# Preview production build (serves on port 5174 to avoid conflict)
npm run preview -- --host 0.0.0.0 --port 5174
```

**Verify:** Open `http://<LAN_IP>:5174` on a phone connected to the classroom WiFi — should show login screen.

---

## HTTPS / SSL (Production)

Browsers require HTTPS for:
- PWA installation (Service Workers)
- WebRTC (if used)
- Secure cookies

### Generate Self-Signed Certificate

```bash
# On teacher laptop
mkdir -p ~/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ~/certs/selfsigned.key \
  -out ~/certs/selfsigned.crt \
  -subj "/CN=whisper-slate.local"
```

### Nginx Reverse Proxy Config

Create `/etc/nginx/sites-available/whisper-slate`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name _;

    ssl_certificate /home/teacher/certs/selfsigned.crt;
    ssl_certificate_key /home/teacher/certs/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # API Server
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket endpoints
    location /ws/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Teacher App (built static files)
    location /teacher/ {
        proxy_pass http://localhost:5173/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Student App (built static files)
    location / {
        proxy_pass http://localhost:5174/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/whisper-slate /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**Note:** Browsers will show a certificate warning on first visit (self-signed cert). Users click **"Advanced" → "Proceed unsafe"** once. This is acceptable for local classroom networks.

---

## Quick Start Checklist

- [ ] Travel router configured (AP mode, DHCP on)
- [ ] Teacher laptop connected to router (Ethernet preferred)
- [ ] Teacher laptop LAN IP known (e.g., `192.168.8.105`)
- [ ] `.env` files created with correct `CORS_ORIGINS` and `VITE_API_URL`
- [ ] Server running on `0.0.0.0:8000`
- [ ] Teacher app built and served on `0.0.0.0:5173`
- [ ] Student app built and served on `0.0.0.0:5174`
- [ ] (Optional) Nginx + SSL configured for production

---

## In-Class Workflow

1. **Teacher:** Opens `https://<LAN_IP>/teacher` → clicks "Start Session"
2. **Teacher:** Shows QR code on projector (or shares URL)
3. **Students:** Connect to classroom WiFi → scan QR / open URL → enter college ID or class code
4. **Students:** Record doubts → preview/edit transcript → send
5. **Teacher:** Reviews doubts in moderation queue → accept/reject with feedback
6. **Dashboard:** Clusters appear in real-time → teacher sees "what to re-teach"
7. **End of class:** Teacher clicks "End Session" → optionally export summary

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Students can't connect | Check firewall: `sudo ufw allow 8000,5173,5174` or Windows Defender exceptions |
| QR code shows localhost | Teacher app auto-detects LAN IP via WebRTC; if it fails, verify `window.location.host` |
| CORS errors | Verify `CORS_ORIGINS` in server `.env` includes teacher/student app URLs exactly |
| WebSocket disconnects | Check nginx `proxy_read_timeout` for `/ws/`; increase if needed |
| PWA won't install | Must use HTTPS (or localhost); self-signed cert requires "Proceed unsafe" once |
| Transcription slow | Server runs faster-whisper on CPU; GPU acceleration needs CUDA build |
| OCR not working | Install tesseract: `apt-get install tesseract-ocr` or `brew install tesseract` |

---

## Backup / Persistence

- Database: `server/classroom.db` (SQLite) — copy for backup
- Student doubts are tied to session; ending session doesn't delete data
- For multi-class use, consider separate DB files per class

---

## Security Notes

- **No internet required** — all traffic stays on local LAN
- **Self-signed TLS** — acceptable for closed classroom network
- **JWT_SECRET** — must be changed from default in `.env`
- **AUTH_COLLEGE_IDS** — mock credentials for demo; replace with SSO for production
- **Device tokens** — ephemeral per-session, hashed in DB (SHA-256)
- **Audio files** — deleted immediately after transcription (privacy by design)