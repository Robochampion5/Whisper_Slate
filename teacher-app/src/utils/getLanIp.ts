/**
 * Get the LAN IP address and port for QR code generation.
 *
 * Strategy:
 * 1. If opened via LAN IP (e.g. http://192.168.1.5:5173), use window.location.host
 * 2. Otherwise, attempt WebRTC trick to detect local IP
 * 3. Fallback to localhost (won't work on phones, but better than crash)
 */
export async function getLanIpAndPort(): Promise<string> {
  // If teacher already opened via LAN IP, use that
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.host; // includes port
  }

  // Try WebRTC local IP detection
  try {
    const ip = await detectLocalIp();
    if (ip) {
      const port = window.location.port || '5173';
      return `${ip}:${port}`;
    }
  } catch (err) {
    console.warn('WebRTC IP detection failed:', err);
  }

  // Fallback to localhost (teacher will need to type IP manually)
  return window.location.host;
}

/**
 * Use WebRTC to detect the local IP address.
 * Creates a temporary RTCPeerConnection with a STUN server,
 * then extracts the local candidate IP from the SDP.
 */
function detectLocalIp(): Promise<string | null> {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.createDataChannel('');

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        pc.close();
        resolve(null);
        return;
      }

      const candidate = event.candidate.candidate;
      // Parse ICE candidate line: "candidate:... typ host ..."
      // Example: "candidate:0 1 UDP 2130706431 192.168.1.5 54321 typ host"
      const match = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match && match[1]) {
        const ip = match[1];
        // Filter out loopback and link-local addresses
        if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
          pc.close();
          resolve(ip);
        }
      }
    };

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => resolve(null));

    // Timeout after 3 seconds
    setTimeout(() => {
      pc.close();
      resolve(null);
    }, 3000);
  });
}
