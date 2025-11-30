import { pitches } from './pitches.js';

class Pitchpipe {
    constructor() {
        this.audioContext = null;
        this.currentOscillators = new Map();
        this.autoPlayInterval = null;
        this.currentAutoPlayIndex = 0;
        
        this.pitches = pitches;

        this.init();
    }

    init() {
        this.initAudio();
        this.createPitchButtons();
        this.setupEventListeners();
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

    createPitchButtons() {
        const container = document.getElementById('pitchButtons');
        container.innerHTML = '';

        this.pitches.forEach((pitch, index) => {
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

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(pitch.freq, this.audioContext.currentTime);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1.5);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 1.5);

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
                const pitch = this.pitches[this.currentAutoPlayIndex];
                const button = document.querySelector('[data-note="' + pitch.note + '"]');
                
                this.playPitch(pitch, button);
                
                setTimeout(() => {
                    this.stopPitch(pitch.note, button);
                }, 800);
                
                this.currentAutoPlayIndex = (this.currentAutoPlayIndex + 1) % this.pitches.length;
            }, 1000);
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