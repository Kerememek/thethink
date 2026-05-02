const socket = io();
const roomIdInput = document.getElementById('roomId');
const joinBtn = document.getElementById('joinBtn');
const micBtn = document.getElementById('micBtn');
const shareBtn = document.getElementById('shareBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remoteAudio = document.getElementById('remoteAudio');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const messages = document.getElementById('messages');

let roomId = '';
let micStream;
let screenStream;
let peerConnection;
let isJoined = false;

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    ...(window.TURN_CONFIG || [])
  ]
};

function logMessage(text, css = '') {
  const p = document.createElement('p');
  p.className = `msg ${css}`;
  p.textContent = text;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
}

function attachExistingTracks(pc) {
  if (micStream) {
    micStream.getAudioTracks().forEach((track) => pc.addTrack(track, micStream));
  }
  if (screenStream) {
    screenStream.getVideoTracks().forEach((track) => pc.addTrack(track, screenStream));
  }
}

function makePeerConnection(targetId) {
  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { target: targetId, payload: { candidate: event.candidate } });
    }
  };

  peerConnection.ontrack = (event) => {
    const track = event.track;
    if (track.kind === 'audio') {
      remoteAudio.srcObject = event.streams[0];
    }
    if (track.kind === 'video') {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  attachExistingTracks(peerConnection);
  return peerConnection;
}

async function ensureMic() {
  if (micStream) return;
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  logMessage('Voice is live', 'system');
}

joinBtn.onclick = () => {
  roomId = roomIdInput.value.trim();
  if (!roomId) return;
  socket.emit('join-room', roomId);
  isJoined = true;
  joinBtn.disabled = true;
  roomIdInput.disabled = true;
  micBtn.disabled = false;
  shareBtn.disabled = false;
  chatInput.disabled = false;
  sendBtn.disabled = false;
  logMessage(`Joined room: ${roomId}`, 'system');
};

micBtn.onclick = async () => {
  try {
    await ensureMic();
    if (peerConnection && micStream) {
      const hasAudioSender = peerConnection.getSenders().some((s) => s.track?.kind === 'audio');
      if (!hasAudioSender) {
        micStream.getAudioTracks().forEach((t) => peerConnection.addTrack(t, micStream));
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
      }
    }
  } catch (err) {
    logMessage(`Mic error: ${err.message}`, 'system');
  }
};

shareBtn.onclick = async () => {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    localVideo.srcObject = screenStream;

    if (peerConnection) {
      const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video');
      const track = screenStream.getVideoTracks()[0];
      if (sender) await sender.replaceTrack(track);
      else peerConnection.addTrack(track, screenStream);

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
    }

    screenStream.getVideoTracks()[0].onended = async () => {
      localVideo.srcObject = null;
      if (!peerConnection) return;
      const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(null);
      }
      logMessage('Screen share stopped', 'system');
    };

    logMessage('Screen share started', 'system');
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
  makePeerConnection(targetId);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', { target: targetId, payload: { sdp: offer } });
});

socket.on('peer-joined', async (peerId) => {
  makePeerConnection(peerId);
  logMessage('Peer joined', 'system');
});

socket.on('signal', async ({ from, payload }) => {
  if (!peerConnection) {
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
  remoteAudio.srcObject = null;
  logMessage('Peer left', 'system');
});
