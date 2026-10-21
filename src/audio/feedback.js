import { app } from '../state/app.js';

let audioCtx = null;

// The audio context is created on the first sound, suspended while the tab is hidden
// (no audio thread running in the background), and resumed by the next sound.
export function suspendAudio() {
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
}

export function playFeedbackSound(type = 'check') {
    if (!app.soundEnabled) return;
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'check') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'uncheck') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(260, now + 0.08);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'celebrate') {
            const notes = [523.25, 659.25, 783.99, 1046.5];
            notes.forEach((freq, idx) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'triangle';
                o.connect(g);
                g.connect(audioCtx.destination);
                o.frequency.setValueAtTime(freq, now + idx * 0.06);
                g.gain.setValueAtTime(0.1, now + idx * 0.06);
                g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
                o.start(now + idx * 0.06);
                o.stop(now + idx * 0.06 + 0.19);
            });
        }
    } catch {}
}
