# Barebones Call + Text + Screen Share App

This is a minimal Node + Socket.IO + WebRTC starter you can run locally.

## Features
- 1:1 room-based voice/video call
- Text chat in the same room
- Browser screen sharing (replaces camera track while sharing)

## Run
```bash
npm install
npm start
```
Then open `http://localhost:3000` in two browser tabs/devices, join the same room name, and allow media permissions.

## Notes
- This is intentionally barebones and not production-hardened.
- For internet-wide usage, add HTTPS and TURN servers.
