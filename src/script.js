import { pitches } from './pitches.js';

class Pitchpipe {
    constructor() {
        this.audioContext = null;
        this.touchedElement = null;
        this.touchTimeout = null;
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
        this.createPitchButtons();
        this.setupEventListeners();
        this.updateOctaveDisplay();
    }

    initAudio() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!this.audioContext) {
                this.audioContext = new AudioContext();
            }
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

            button.addEventListener('click', (e) => {
                // Prevent click event if this was already handled as touch
                if (this.touchedElement === button) {
                    e.preventDefault();
                    return;
                }
                this.togglePitch(pitch, button);
            });

            button.addEventListener('touchstart', (e) => {
                // Mark this element as touched and clear any existing timeout
                this.touchedElement = button;
                if (this.touchTimeout) {
                    clearTimeout(this.touchTimeout);
                }

                // Clear the touched element after a short delay
                this.touchTimeout = setTimeout(() => {
                    this.touchedElement = null;
                }, 500);

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
        });

        const soundSelector = document.getElementById('soundSelector');
        soundSelector.addEventListener('change', (e) => {
            this.soundType = e.target.value;
            // Stop all currently playing notes to apply new sound type
            this.stopAll();
        });

        // Track touched element to prevent duplicate events
        this.touchedElement = null;
        this.touchTimeout = null;

        // Single unified handler for first interaction and audio initialization
        const handleFirstInteraction = async (e) => {
            if (this.audioContext && this.audioContext.state === 'running') {
                // Audio is ready, let normal handlers process the event
                return;
            }

            // Prevent normal event processing while we initialize
            e.stopPropagation();
            e.preventDefault();

            try {
                // Create AudioContext in response to user gesture (required by iOS)
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();

                // Resume in same gesture (iOS requirement)
                await this.audioContext.resume();

                // Remove this handler after successful initialization
                document.removeEventListener('click', handleFirstInteraction, true);
                document.removeEventListener('touchstart', handleFirstInteraction, true);

                // Now manually trigger the intended action
                if (e.target.classList.contains('pitch-btn')) {
                    const note = e.target.dataset.note;
                    const pitch = this.currentPitches.find(p => p.note === note);
                    if (pitch) {
                        // Use togglePitch to maintain proper state management
                        this.togglePitch(pitch, e.target);
                    }
                }

            } catch (error) {
                console.error('Audio initialization error:', error);
            }
        };

        // Single handler that captures BEFORE normal event handlers
        document.addEventListener('click', handleFirstInteraction, true);
        document.addEventListener('touchstart', handleFirstInteraction, true);
    }

    togglePitch(pitch, button) {
        const noteKey = pitch.note;

        if (this.currentOscillators.has(noteKey)) {
            this.stopPitch(noteKey, button);
        } else {
            // Highlight button immediately for better UX
            if (button) {
                button.classList.add('playing');
            }
            this.playPitch(pitch, button);
        }
    }

    async playPitch(pitch, button) {
        // AudioContext must already be initialized by user interaction
        if (!this.audioContext) {
            return;
        }

        // AudioContext should be running if properly initialized
        if (this.audioContext.state !== 'running') {
            return;
        }



        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.frequency.setValueAtTime(pitch.freq, this.audioContext.currentTime);

        // Connect oscillator to gainNode first
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Set oscillator type and characteristics based on sound type
        this.setSoundType(oscillator, gainNode, pitch);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.05);
        // Sustain at full volume, then fade out only in the last second
        const sustainTime = Math.max(0.1, this.toneDuration - 1);
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + sustainTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + this.toneDuration);

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

        // Note: button should already be highlighted by togglePitch for immediate feedback

        document.getElementById('currentPitch').textContent = pitch.note;
        document.getElementById('frequencyDisplay').textContent = pitch.freq.toFixed(2) + ' Hz';
    }

    stopPitch(note, button) {
        const oscData = this.currentOscillators.get(note);
        if (oscData && this.audioContext) {
            const { oscillator, gainNode } = oscData;

            // Immediate fade out
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

    showError(message) {
        const currentPitch = document.getElementById('currentPitch');
        currentPitch.textContent = 'Error';
        currentPitch.style.color = '#ff6b6b';

        const freqDisplay = document.getElementById('frequencyDisplay');
        freqDisplay.textContent = message;
        freqDisplay.style.color = '#ff6b6b';
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

    setSoundType(oscillator, gainNode, pitch) {

        // Helper function to disconnect default connection and create new one
        const connectWithFilter = (oscillator, filter, gainNode) => {
            try { oscillator.disconnect(); } catch(e) {}
            oscillator.connect(filter);
            filter.connect(gainNode);
        };

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
                // Disconnect default connection and add a filter for kazoo-like buzz
                try { oscillator.disconnect(); } catch(e) {}
                const kazooFilter = this.audioContext.createBiquadFilter();
                kazooFilter.type = 'bandpass';
                kazooFilter.frequency.setValueAtTime(800, this.audioContext.currentTime);
                kazooFilter.Q.setValueAtTime(10, this.audioContext.currentTime);
                oscillator.connect(kazooFilter);
                kazooFilter.connect(gainNode);
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

            // Woodwind Instruments
            case 'flute':
                oscillator.type = 'triangle';
                // Disconnect default connection and add high-pass filter for breathy quality
                try { oscillator.disconnect(); } catch(e) {}
                const fluteFilter = this.audioContext.createBiquadFilter();
                fluteFilter.type = 'highpass';
                fluteFilter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
                oscillator.connect(fluteFilter);
                fluteFilter.connect(gainNode);
                // Add breath noise
                const breathNoise = this.audioContext.createBufferSource();
                const breathBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.1, this.audioContext.sampleRate);
                const breathData = breathBuffer.getChannelData(0);
                for (let i = 0; i < breathData.length; i++) {
                    breathData[i] = (Math.random() - 0.5) * 0.02;
                }
                const breathGain = this.audioContext.createGain();
                breathGain.gain.setValueAtTime(0.05, this.audioContext.currentTime);
                breathNoise.buffer = breathBuffer;
                breathNoise.connect(breathGain);
                breathGain.connect(this.audioContext.destination);
                breathNoise.start();
                breathNoise.stop(this.audioContext.currentTime + 0.1);
                break;

            case 'clarinet':
                oscillator.type = 'sawtooth';
                // Formant filters for reed quality
                try { oscillator.disconnect(); } catch(e) {}
                const clarinetFilter1 = this.audioContext.createBiquadFilter();
                clarinetFilter1.type = 'bandpass';
                clarinetFilter1.frequency.setValueAtTime(1500, this.audioContext.currentTime);
                clarinetFilter1.Q.setValueAtTime(5, this.audioContext.currentTime);
                const clarinetFilter2 = this.audioContext.createBiquadFilter();
                clarinetFilter2.type = 'bandpass';
                clarinetFilter2.frequency.setValueAtTime(800, this.audioContext.currentTime);
                clarinetFilter2.Q.setValueAtTime(8, this.audioContext.currentTime);
                oscillator.connect(clarinetFilter1);
                clarinetFilter1.connect(clarinetFilter2);
                clarinetFilter2.connect(gainNode);
                break;

            case 'saxophone':
                oscillator.type = 'sawtooth';
                // Rich harmonics with bandpass
                try { oscillator.disconnect(); } catch(e) {}
                const saxFilter = this.audioContext.createBiquadFilter();
                saxFilter.type = 'bandpass';
                saxFilter.frequency.setValueAtTime(1200, this.audioContext.currentTime);
                saxFilter.Q.setValueAtTime(3, this.audioContext.currentTime);
                oscillator.connect(saxFilter);
                saxFilter.connect(gainNode);
                // Add vibrato
                const saxVibrato = this.audioContext.createOscillator();
                const saxVibratoGain = this.audioContext.createGain();
                saxVibrato.frequency.setValueAtTime(4, this.audioContext.currentTime);
                saxVibratoGain.gain.setValueAtTime(3, this.audioContext.currentTime);
                saxVibrato.connect(saxVibratoGain);
                saxVibratoGain.connect(oscillator.frequency);
                saxVibrato.start();
                saxVibrato.stop(this.audioContext.currentTime + this.toneDuration);
                break;

            // Brass Instruments
            case 'trumpet':
                oscillator.type = 'square';
                // Bright harmonics with mute-like filtering
                try { oscillator.disconnect(); } catch(e) {}
                const trumpetFilter = this.audioContext.createBiquadFilter();
                trumpetFilter.type = 'lowpass';
                trumpetFilter.frequency.setValueAtTime(2000, this.audioContext.currentTime);
                trumpetFilter.Q.setValueAtTime(2, this.audioContext.currentTime);
                oscillator.connect(trumpetFilter);
                trumpetFilter.connect(gainNode);
                // Sharp attack
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.25, this.audioContext.currentTime + 0.02);
                break;

            case 'frenchHorn':
                oscillator.type = 'triangle';
                // Warm mellow tone
                try { oscillator.disconnect(); } catch(e) {}
                const hornFilter = this.audioContext.createBiquadFilter();
                hornFilter.type = 'lowpass';
                hornFilter.frequency.setValueAtTime(1500, this.audioContext.currentTime);
                hornFilter.Q.setValueAtTime(1, this.audioContext.currentTime);
                oscillator.connect(hornFilter);
                hornFilter.connect(gainNode);
                // Slow attack
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.15);
                break;

            // String Instruments
            case 'guitar':
                oscillator.type = 'sawtooth';
                // Plucked string with envelope
                try { oscillator.disconnect(); } catch(e) {}
                const guitarFilter = this.audioContext.createBiquadFilter();
                guitarFilter.type = 'lowpass';
                guitarFilter.frequency.setValueAtTime(3000, this.audioContext.currentTime);
                guitarFilter.Q.setValueAtTime(1, this.audioContext.currentTime);
                oscillator.connect(guitarFilter);
                guitarFilter.connect(gainNode);
                // Sharp attack, quick decay
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01);
                const guitarDecayTime = Math.max(0.1, this.toneDuration - 2);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + guitarDecayTime);
                break;

            case 'cello':
                oscillator.type = 'triangle';
                // Deep, warm tone with slower vibrato
                try { oscillator.disconnect(); } catch(e) {}
                const celloFilter = this.audioContext.createBiquadFilter();
                celloFilter.type = 'lowpass';
                celloFilter.frequency.setValueAtTime(800, this.audioContext.currentTime);
                celloFilter.Q.setValueAtTime(2, this.audioContext.currentTime);
                oscillator.connect(celloFilter);
                celloFilter.connect(gainNode);
                // Slow vibrato
                const celloVibrato = this.audioContext.createOscillator();
                const celloVibratoGain = this.audioContext.createGain();
                celloVibrato.frequency.setValueAtTime(2, this.audioContext.currentTime);
                celloVibratoGain.gain.setValueAtTime(2, this.audioContext.currentTime);
                celloVibrato.connect(celloVibratoGain);
                celloVibratoGain.connect(oscillator.frequency);
                celloVibrato.start();
                celloVibrato.stop(this.audioContext.currentTime + this.toneDuration);
                break;

            // Electronic
            case 'synthLead':
                oscillator.type = 'sawtooth';
                // Modern synth with filter sweeps
                try { oscillator.disconnect(); } catch(e) {}
                const synthFilter = this.audioContext.createBiquadFilter();
                synthFilter.type = 'lowpass';
                synthFilter.frequency.setValueAtTime(2000, this.audioContext.currentTime);
                synthFilter.Q.setValueAtTime(5, this.audioContext.currentTime);
                // Filter sweep
                synthFilter.frequency.linearRampToValueAtTime(500, this.audioContext.currentTime + this.toneDuration * 0.5);
                oscillator.connect(synthFilter);
                synthFilter.connect(gainNode);
                break;

            case '8bit':
                oscillator.type = 'square';
                // Retro game sound
                try { oscillator.disconnect(); } catch(e) {}
                const bitcrusher = this.audioContext.createScriptProcessor(256, 1, 1);
                bitcrusher.onaudioprocess = (e) => {
                    const input = e.inputBuffer.getChannelData(0);
                    const output = e.outputBuffer.getChannelData(0);
                    for (let i = 0; i < input.length; i++) {
                        output[i] = Math.sign(input[i]) * 0.3; // Bitcrush effect
                    }
                };
                oscillator.connect(bitcrusher);
                bitcrusher.connect(gainNode);
                break;

            case 'wobbleBass':
                oscillator.type = 'sawtooth';
                // Dubstep-style wobble
                try { oscillator.disconnect(); } catch(e) {}
                const wobbleFilter = this.audioContext.createBiquadFilter();
                wobbleFilter.type = 'lowpass';
                wobbleFilter.Q.setValueAtTime(10, this.audioContext.currentTime);
                oscillator.connect(wobbleFilter);
                wobbleFilter.connect(gainNode);
                // Wobble effect
                const wobbleLFO = this.audioContext.createOscillator();
                wobbleLFO.frequency.setValueAtTime(2, this.audioContext.currentTime);
                const wobbleGain = this.audioContext.createGain();
                wobbleGain.gain.setValueAtTime(1500, this.audioContext.currentTime);
                wobbleLFO.connect(wobbleGain);
                wobbleGain.connect(wobbleFilter.frequency);
                wobbleLFO.start();
                wobbleLFO.stop(this.audioContext.currentTime + this.toneDuration);
                break;

            case 'pad':
                oscillator.type = 'sine';
                // Ambient synth pad with slow attack
                try { oscillator.disconnect(); } catch(e) {}
                const padFilter = this.audioContext.createBiquadFilter();
                padFilter.type = 'lowpass';
                padFilter.frequency.setValueAtTime(1500, this.audioContext.currentTime);
                padFilter.Q.setValueAtTime(2, this.audioContext.currentTime);
                oscillator.connect(padFilter);
                padFilter.connect(gainNode);
                // Very slow attack
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.5);
                break;

            case 'theremin':
                oscillator.type = 'sine';
                // Continuous pitch with hand vibrato simulation
                const thereminVibrato = this.audioContext.createOscillator();
                const thereminVibratoGain = this.audioContext.createGain();
                thereminVibrato.frequency.setValueAtTime(6, this.audioContext.currentTime);
                thereminVibratoGain.gain.setValueAtTime(5, this.audioContext.currentTime);
                thereminVibrato.connect(thereminVibratoGain);
                thereminVibratoGain.connect(oscillator.frequency);
                thereminVibrato.start();
                thereminVibrato.stop(this.audioContext.currentTime + this.toneDuration);
                // Hand wavering effect
                const thereminLFO = this.audioContext.createOscillator();
                const thereminLFOGain = this.audioContext.createGain();
                thereminLFO.frequency.setValueAtTime(0.5, this.audioContext.currentTime);
                thereminLFOGain.gain.setValueAtTime(2, this.audioContext.currentTime);
                thereminLFO.connect(thereminLFOGain);
                thereminLFOGain.connect(thereminVibratoGain.gain);
                thereminLFO.start();
                thereminLFO.stop(this.audioContext.currentTime + this.toneDuration);
                break;

            // World Instruments
            case 'didgeridoo':
                oscillator.type = 'sine';
                // Low drone with formant filtering
                try { oscillator.disconnect(); } catch(e) {}
                const didgeFilter = this.audioContext.createBiquadFilter();
                didgeFilter.type = 'bandpass';
                didgeFilter.frequency.setValueAtTime(200, this.audioContext.currentTime);
                didgeFilter.Q.setValueAtTime(2, this.audioContext.currentTime);
                oscillator.connect(didgeFilter);
                didgeFilter.connect(gainNode);
                // Add vocal formants
                const formantFilter = this.audioContext.createBiquadFilter();
                formantFilter.type = 'peaking';
                formantFilter.frequency.setValueAtTime(800, this.audioContext.currentTime);
                formantFilter.Q.setValueAtTime(3, this.audioContext.currentTime);
                formantFilter.gain.setValueAtTime(3, this.audioContext.currentTime);
                didgeFilter.connect(formantFilter);
                formantFilter.connect(gainNode);
                break;

            default:
                oscillator.type = 'sine';
                break;
        }
    }



        const debugDiv = document.createElement('div');
        debugDiv.id = 'debugOverlay';

        // Use individual style assignments for better mobile compatibility
        debugDiv.style.position = 'fixed';
        debugDiv.style.top = '5px';
        debugDiv.style.left = '5px'; // Changed from right for better mobile visibility
        debugDiv.style.background = 'rgba(255,0,0,0.95)';
        debugDiv.style.color = 'white';
        debugDiv.style.padding = '8px';
        debugDiv.style.fontFamily = 'monospace';
        debugDiv.style.fontSize = '11px';
        debugDiv.style.zIndex = '999999';
        debugDiv.style.maxWidth = '200px';
        debugDiv.style.borderRadius = '4px';
        debugDiv.style.border = '2px solid yellow';
        debugDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
        debugDiv.style.lineHeight = '1.2';
        debugDiv.style.webkitTransform = 'translateZ(0)'; // Force hardware acceleration
        debugDiv.style.pointerEvents = 'none'; // Don't interfere with touches

        // Try to append to body
        try {
            document.body.appendChild(debugDiv);
            console.log('Debug overlay appended to body');
        } catch (error) {
            console.error('Failed to append debug overlay:', error);
        }

        // Make sure it's actually in the DOM
        setTimeout(() => {
            const element = document.getElementById('debugOverlay');
            console.log('Debug overlay in DOM:', !!element);
            if (element) {
                const rect = element.getBoundingClientRect();
                console.log('Debug overlay rect:', rect);
            }
        }, 100);

        this.debugLog = (message) => {
            console.log('DEBUG:', message);
            const debugDiv = document.getElementById('debugOverlay');
            if (debugDiv) {
            debugDiv.innerHTML += `<div style="margin: 1px 0; font-size: 10px; border-bottom: 1px solid rgba(255,255,255,0.3);">${new Date().toLocaleTimeString()}: ${message}</div>`;
            // Keep only last 6 messages to save space on mobile
            const logs = debugDiv.children;
            if (logs.length > 6) {
                debugDiv.removeChild(logs[0]);
            }
                debugDiv.scrollTop = debugDiv.scrollHeight;
            } else {
                console.error('Debug overlay not found!');
            }
        };
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
