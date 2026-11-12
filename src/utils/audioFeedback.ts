let audioCtx: AudioContext | null = null;
let beepOscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

export function playContinuityBeep(shouldBeep: boolean) {
  if (typeof window === 'undefined') return;

  if (shouldBeep) {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (audioCtx && !beepOscillator) {
      try {
        beepOscillator = audioCtx.createOscillator();
        gainNode = audioCtx.createGain();

        beepOscillator.type = 'sine';
        beepOscillator.frequency.setValueAtTime(2400, audioCtx.currentTime); // Standard 2.4 kHz multimeter piezo pitch
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); // Gentle volume

        beepOscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        beepOscillator.start();
      } catch {
        // Audio policy ignore
      }
    }
  } else {
    if (beepOscillator) {
      try {
        beepOscillator.stop();
        beepOscillator.disconnect();
      } catch {
        // Ignore
      }
      beepOscillator = null;
      gainNode = null;
    }
  }
}

export function playProbeTapSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    // Subtle acoustic metallic contact chirp: 1600Hz decaying rapidly to 320Hz over 35ms
    osc.frequency.setValueAtTime(1600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 0.035);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.035);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.035);
  } catch {
    // Audio policy ignore
  }
}
