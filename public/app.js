const socket = io();
const roomIdInput = document.getElementById('roomId');
const joinBtn = document.getElementById('joinBtn');
const micCamBtn = document.getElementById('micCamBtn');
const shareBtn = document.getElementById('shareBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const messages = document.getElementById('messages');

let roomId = '';
let localStream;
let peerConnection;
let isJoined = false;

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function logMessage(text, css = '') {
  const p = document.createElement('p');
  p.className = `msg ${css}`;
  p.textContent = text;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
}

function makePeerConnection(targetId) {
  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { target: targetId, payload: { candidate: event.candidate } });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  if (localStream) {
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
  }

  return peerConnection;
}

async function ensureMedia() {
  if (localStream) return;
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

joinBtn.onclick = () => {
  roomId = roomIdInput.value.trim();
  if (!roomId) return;
  socket.emit('join-room', roomId);
  isJoined = true;
  joinBtn.disabled = true;
  roomIdInput.disabled = true;
  micCamBtn.disabled = false;
  chatInput.disabled = false;
  sendBtn.disabled = false;
  logMessage(`Joined room: ${roomId}`, 'system');
};

micCamBtn.onclick = async () => {
  try {
    await ensureMedia();
    shareBtn.disabled = false;
    logMessage('Mic + camera ready', 'system');
  } catch (err) {
    logMessage(`Media error: ${err.message}`, 'system');
  }
};

shareBtn.onclick = async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    const sender = peerConnection
      ?.getSenders()
      .find((s) => s.track && s.track.kind === 'video');

    if (sender) {
      await sender.replaceTrack(screenTrack);
      localVideo.srcObject = screenStream;
      logMessage('Sharing screen...', 'system');

      screenTrack.onended = async () => {
        if (!localStream) return;
        const camTrack = localStream.getVideoTracks()[0];
        await sender.replaceTrack(camTrack);
        localVideo.srcObject = localStream;
        logMessage('Screen sharing stopped', 'system');
      };
    }
  } catch (err) {
    logMessage(`Screen share error: ${err.message}`, 'system');
  }
};

sendBtn.onclick = () => {
  const text = chatInput.value.trim();
  if (!text || !isJoined) return;
  socket.emit('chat-message', text);
  logMessage(`You: ${text}`, 'self');
  chatInput.value = '';
};

chatInput.onkeydown = (e) => {
  if (e.key === 'Enter') sendBtn.click();
};

socket.on('chat-message', ({ from, text }) => {
  logMessage(`${from.slice(0, 6)}: ${text}`);
});

socket.on('existing-peers', async (peers) => {
  if (!peers.length) return;
  const targetId = peers[0];
  await ensureMedia();
  makePeerConnection(targetId);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', { target: targetId, payload: { sdp: offer } });
});

socket.on('peer-joined', async (peerId) => {
  await ensureMedia();
  makePeerConnection(peerId);
  logMessage('Peer joined', 'system');
});

socket.on('signal', async ({ from, payload }) => {
  if (!peerConnection) {
    await ensureMedia();
    makePeerConnection(from);
  }

  if (payload.sdp) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));

    if (payload.sdp.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { target: from, payload: { sdp: answer } });
    }
  }

  if (payload.candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
  }
});

socket.on('peer-left', () => {
  if (peerConnection) peerConnection.close();
  peerConnection = null;
  remoteVideo.srcObject = null;
  logMessage('Peer left', 'system');
});
