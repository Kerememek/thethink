# Barebones Voice + Text + Screen Share App

This app is now **voice-only for calling** (no webcam video), plus text chat and screen sharing.

## Features
- 1:1 room-based voice call
- Text chat in the same room
- Browser screen share stream

## Run locally
```bash
npm install
npm start
```
Open `http://localhost:3000` on two devices/tabs and join the same room.

## Make it internet-wide
For internet-wide connectivity, you should run this over HTTPS and configure TURN:

1. Deploy server on a public host (e.g. Render, Fly.io, Railway, VPS).
2. Put it behind HTTPS (Nginx/Caddy/Cloudflare tunnel, or platform TLS).
3. Provide TURN servers in `window.TURN_CONFIG` before `app.js` loads.

Example snippet to inject in `index.html` before loading `app.js`:
```html
<script>
  window.TURN_CONFIG = [
    {
      urls: 'turn:your-turn-host.example.com:3478',
      username: 'turnuser',
      credential: 'turnpass'
    }
  ];
</script>
```

Without TURN, many users behind strict NAT/firewalls will fail to connect.
