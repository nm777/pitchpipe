import { pitches } from './pitches.js';

class Pitchpipe {
    constructor() {
        this.audioContext = null;
        this.currentOscillators = new Map();
        this.autoPlayInterval = null;
        this.currentAutoPlayIndex = 0;
        this.currentOctave = 4;
        this.minOctave = 3;
        this.maxOctave = 5;
        this.toneDuration = 3; // Default 3 seconds
        this.soundType = 'bells'; // Default sound type
        
        this.allPitches = pitches;
        this.currentPitches = this.getPitchesForOctave(this.currentOctave);

        this.init();
    }

    init() {
        this.initAudio();
        this.createPitchButtons();
        this.setupEventListeners();
        this.updateOctaveDisplay();
    }

    initAudio() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (error) {
            console.error('Web Audio API not supported:', error);
            this.showError('Web Audio API not supported in this browser');
        }
    }

    getPitchesForOctave(octave) {
        return this.allPitches.filter(pitch => pitch.note.endsWith(octave.toString()));
    }

    createPitchButtons() {
        const container = document.getElementById('pitchButtons');
        container.innerHTML = '';

        this.currentPitches.forEach((pitch, index) => {
            const button = document.createElement('button');
            button.className = 'pitch-btn';
            button.textContent = pitch.note;
            button.dataset.note = pitch.note;
            button.dataset.freq = pitch.freq;
            button.dataset.index = index;
            
            button.addEventListener('click', () => this.togglePitch(pitch, button));
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.togglePitch(pitch, button);
            });
            
            container.appendChild(button);
        });
    }

    setupEventListeners() {
        document.getElementById('stopBtn').addEventListener('click', () => this.stopAll());
        document.getElementById('autoPlayBtn').addEventListener('click', () => this.toggleAutoPlay());
        document.getElementById('octaveUpBtn').addEventListener('click', () => this.changeOctave(1));
        document.getElementById('octaveDownBtn').addEventListener('click', () => this.changeOctave(-1));
        
        const durationSlider = document.getElementById('durationSlider');
        const durationValue = document.getElementById('durationValue');
        
        // Initialize display
        durationValue.textContent = `${this.toneDuration}s`;
        
        durationSlider.addEventListener('input', (e) => {
            this.toneDuration = parseInt(e.target.value);
            durationValue.textContent = `${this.toneDuration}s`;
            console.log('Duration changed to:', this.toneDuration);
        });

        const soundSelector = document.getElementById('soundSelector');
        soundSelector.addEventListener('change', (e) => {
            this.soundType = e.target.value;
            console.log('Sound type changed to:', this.soundType);
        });

        // Resume audio context on user interaction (required by some browsers)
        document.addEventListener('click', () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }, { once: true });
    }

    togglePitch(pitch, button) {
        const noteKey = pitch.note;
        
        if (this.currentOscillators.has(noteKey)) {
            this.stopPitch(noteKey, button);
        } else {
            this.playPitch(pitch, button);
        }
    }

    playPitch(pitch, button) {
        if (!this.audioContext) return;

        console.log('Playing pitch with duration:', this.toneDuration, 'and sound type:', this.soundType);

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Set oscillator type and characteristics based on sound type
        this.setSoundType(oscillator, gainNode);
        
        oscillator.frequency.setValueAtTime(pitch.freq, this.audioContext.currentTime);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.05);
        // Sustain at full volume, then fade out only in the last second
        const sustainTime = Math.max(0.1, this.toneDuration - 1);
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + sustainTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + this.toneDuration);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + this.toneDuration);

        oscillator.onended = () => {
            this.currentOscillators.delete(pitch.note);
            if (button) {
                button.classList.remove('playing');
            }
            if (this.currentOscillators.size === 0) {
                document.getElementById('currentPitch').textContent = 'Ready';
                document.getElementById('frequencyDisplay').textContent = '';
            }
        };

        this.currentOscillators.set(pitch.note, { oscillator, gainNode });
        
        if (button) {
            button.classList.add('playing');
        }

        document.getElementById('currentPitch').textContent = pitch.note;
        document.getElementById('frequencyDisplay').textContent = pitch.freq.toFixed(2) + ' Hz';
    }

    stopPitch(note, button) {
        const oscData = this.currentOscillators.get(note);
        if (oscData && this.audioContext) {
            const { oscillator, gainNode } = oscData;
            
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            setTimeout(() => {
                try {
                    oscillator.stop();
                } catch (e) {
                    // Oscillator might have already stopped
                }
            }, 100);
            
            this.currentOscillators.delete(note);
            
            if (button) {
                button.classList.remove('playing');
            }
        }
    }

    stopAll() {
        this.currentOscillators.forEach((oscData, note) => {
            this.stopPitch(note);
        });
        
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
            document.getElementById('autoPlayBtn').textContent = 'Auto Play';
        }
        
        document.getElementById('currentPitch').textContent = 'Ready';
        document.getElementById('frequencyDisplay').textContent = '';
    }

    changeOctave(direction) {
        const newOctave = this.currentOctave + direction;
        
        if (newOctave >= this.minOctave && newOctave <= this.maxOctave) {
            this.stopAll();
            this.currentOctave = newOctave;
            this.currentPitches = this.getPitchesForOctave(this.currentOctave);
            this.currentAutoPlayIndex = 0;
            this.createPitchButtons();
            this.updateOctaveDisplay();
        }
    }

    updateOctaveDisplay() {
        document.getElementById('octaveDisplay').textContent = `Octave ${this.currentOctave}`;
        document.getElementById('octaveUpBtn').disabled = this.currentOctave >= this.maxOctave;
        document.getElementById('octaveDownBtn').disabled = this.currentOctave <= this.minOctave;
    }

    toggleAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
            document.getElementById('autoPlayBtn').textContent = 'Auto Play';
            this.stopAll();
        } else {
            this.stopAll();
            document.getElementById('autoPlayBtn').textContent = 'Stop Auto';
            
            this.autoPlayInterval = setInterval(() => {
                const pitch = this.currentPitches[this.currentAutoPlayIndex];
                const button = document.querySelector('[data-note="' + pitch.note + '"]');
                
                this.playPitch(pitch, button);
                
                setTimeout(() => {
                    this.stopPitch(pitch.note, button);
                }, this.toneDuration * 1000 * 0.5); // Stop at 50% of duration for auto-play
                
                this.currentAutoPlayIndex = (this.currentAutoPlayIndex + 1) % this.currentPitches.length;
            }, 1000);
        }
    }

    setSoundType(oscillator, gainNode) {
        switch (this.soundType) {
            case 'bells':
                oscillator.type = 'sine';
                // Add slight vibrato for bell-like quality
                const vibrato = this.audioContext.createOscillator();
                const vibratoGain = this.audioContext.createGain();
                vibrato.frequency.setValueAtTime(5, this.audioContext.currentTime);
                vibratoGain.gain.setValueAtTime(2, this.audioContext.currentTime);
                vibrato.connect(vibratoGain);
                vibratoGain.connect(oscillator.frequency);
                vibrato.start();
                vibrato.stop(this.audioContext.currentTime + this.toneDuration);
                break;
                
            case 'kazoo':
                oscillator.type = 'sawtooth';
                // Add a filter for kazoo-like buzz
                const filter = this.audioContext.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(800, this.audioContext.currentTime);
                filter.Q.setValueAtTime(10, this.audioContext.currentTime);
                oscillator.connect(filter);
                filter.connect(gainNode);
                // Reduce gain for kazoo and sustain, then fade out only in the last second
                gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.05);
                const kazooSustainTime = Math.max(0.1, this.toneDuration - 1);
                gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + kazooSustainTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + this.toneDuration);
                break;
                
            case 'violin':
                oscillator.type = 'triangle';
                // Add envelope for violin-like attack
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.1); // Slower attack
                gainNode.gain.linearRampToValueAtTime(0.25, this.audioContext.currentTime + 0.2); // Slight swell
                // Sustain at full volume, then fade out only in the last second
                const violinSustainTime = Math.max(0.3, this.toneDuration - 1);
                gainNode.gain.linearRampToValueAtTime(0.25, this.audioContext.currentTime + violinSustainTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + this.toneDuration);
                // Add subtle vibrato
                const violinVibrato = this.audioContext.createOscillator();
                const violinVibratoGain = this.audioContext.createGain();
                violinVibrato.frequency.setValueAtTime(3, this.audioContext.currentTime);
                violinVibratoGain.gain.setValueAtTime(1.5, this.audioContext.currentTime);
                violinVibrato.connect(violinVibratoGain);
                violinVibratoGain.connect(oscillator.frequency);
                violinVibrato.start();
                violinVibrato.stop(this.audioContext.currentTime + this.toneDuration);
                break;
                
            default:
                oscillator.type = 'sine';
                break;
        }
    }

    showError(message) {
        const currentPitch = document.getElementById('currentPitch');
        currentPitch.textContent = 'Error';
        currentPitch.style.color = '#ff6b6b';
        
        const freqDisplay = document.getElementById('frequencyDisplay');
        freqDisplay.textContent = message;
        freqDisplay.style.color = '#ff6b6b';
    }
}

// Initialize the pitchpipe when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new Pitchpipe();
});