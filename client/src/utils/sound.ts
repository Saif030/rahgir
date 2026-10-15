let audioCtx: AudioContext | null = null;

/**
 * Plays a pleasant modern notification ping sound using the Web Audio API.
 * Synthesizes a clean two-tone chime without external asset dependencies.
 */
export function playNotificationPing() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Harmonic two-note notification chime (D5 -> A5 glide and shimmer)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.05); // A5
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12); // D6

    // Smooth gain envelope (soft attack, gentle decay, zero clicks)
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.38);

    osc2.start(now + 0.04);
    osc2.stop(now + 0.38);
  } catch {
    // Gracefully ignore environments where AudioContext is blocked or unsupported
  }
}
