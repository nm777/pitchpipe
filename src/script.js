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
        const resumeAudio = async () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                    console.log('AudioContext resumed');
                } catch (error) {
                    console.error('Failed to resume AudioContext:', error);
                }
            }
        };

        // Try to resume on first user interaction
        document.addEventListener('click', resumeAudio, { once: true, capture: true });
        document.addEventListener('touchstart', resumeAudio, { once: true, capture: true });
        
        // Also try to resume immediately after initialization
        setTimeout(resumeAudio, 100);
    }

    togglePitch(pitch, button) {
        const noteKey = pitch.note;
        
        if (this.currentOscillators.has(noteKey)) {
            this.stopPitch(noteKey, button);
        } else {
            this.playPitch(pitch, button);
        }
    }

    async playPitch(pitch, button) {
        if (!this.audioContext) return;

        // Ensure audio context is running
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('AudioContext resumed in playPitch');
            } catch (error) {
                console.error('Failed to resume AudioContext in playPitch:', error);
                return;
            }
        }

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
                // High-pass filter for breathy quality
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

            case 'trombone':
                oscillator.type = 'sawtooth';
                // Slide effect capability
                const tromboneFilter = this.audioContext.createBiquadFilter();
                tromboneFilter.type = 'lowpass';
                tromboneFilter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
                tromboneFilter.Q.setValueAtTime(1.5, this.audioContext.currentTime);
                oscillator.connect(tromboneFilter);
                tromboneFilter.connect(gainNode);
                // Glissando effect
                const slideTime = this.audioContext.currentTime + 0.1;
                oscillator.frequency.setValueAtTime(pitch.freq * 0.95, this.audioContext.currentTime);
                oscillator.frequency.linearRampToValueAtTime(pitch.freq, slideTime);
                break;

            // String Instruments
            case 'guitar':
                oscillator.type = 'sawtooth';
                // Plucked string with envelope
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

            case 'harp':
                oscillator.type = 'sine';
                // Soft attack with long decay and resonance
                const harpFilter = this.audioContext.createBiquadFilter();
                harpFilter.type = 'bandpass';
                harpFilter.frequency.setValueAtTime(pitch.freq, this.audioContext.currentTime);
                harpFilter.Q.setValueAtTime(15, this.audioContext.currentTime);
                oscillator.connect(harpFilter);
                harpFilter.connect(gainNode);
                // Very soft attack
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.3);
                break;

            case 'cello':
                oscillator.type = 'triangle';
                // Deep, warm tone with slower vibrato
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

            // Percussion
            case 'xylophone':
                oscillator.type = 'square';
                // Sharp attack with wooden resonance
                const xyloFilter = this.audioContext.createBiquadFilter();
                xyloFilter.type = 'bandpass';
                xyloFilter.frequency.setValueAtTime(pitch.freq * 2, this.audioContext.currentTime);
                xyloFilter.Q.setValueAtTime(20, this.audioContext.currentTime);
                oscillator.connect(xyloFilter);
                xyloFilter.connect(gainNode);
                // Very sharp attack, quick decay
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + 0.001);
                const xyloDecayTime = Math.max(0.1, this.toneDuration - 1.5);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + xyloDecayTime);
                break;

            // Electronic
            case 'synthLead':
                oscillator.type = 'sawtooth';
                // Modern synth with filter sweeps
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

            case 'organ':
                // Drawbar organ with harmonic mixing
                const organOsc1 = this.audioContext.createOscillator();
                const organOsc2 = this.audioContext.createOscillator();
                const organOsc3 = this.audioContext.createOscillator();
                organOsc1.type = 'sine';
                organOsc2.type = 'sine';
                organOsc3.type = 'sine';
                organOsc1.frequency.setValueAtTime(pitch.freq, this.audioContext.currentTime);
                organOsc2.frequency.setValueAtTime(pitch.freq * 2, this.audioContext.currentTime);
                organOsc3.frequency.setValueAtTime(pitch.freq * 3, this.audioContext.currentTime);
                const organGain1 = this.audioContext.createGain();
                const organGain2 = this.audioContext.createGain();
                const organGain3 = this.audioContext.createGain();
                organGain1.gain.setValueAtTime(0.5, this.audioContext.currentTime);
                organGain2.gain.setValueAtTime(0.25, this.audioContext.currentTime);
                organGain3.gain.setValueAtTime(0.125, this.audioContext.currentTime);
                organOsc1.connect(organGain1);
                organOsc2.connect(organGain2);
                organOsc3.connect(organGain3);
                organGain1.connect(gainNode);
                organGain2.connect(gainNode);
                organGain3.connect(gainNode);
                organOsc1.start();
                organOsc2.start();
                organOsc3.start();
                organOsc1.stop(this.audioContext.currentTime + this.toneDuration);
                organOsc2.stop(this.audioContext.currentTime + this.toneDuration);
                organOsc3.stop(this.audioContext.currentTime + this.toneDuration);
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
            case 'sitar':
                oscillator.type = 'sawtooth';
                // Droning strings with sympathetic resonance
                const sitarFilter = this.audioContext.createBiquadFilter();
                sitarFilter.type = 'bandpass';
                sitarFilter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
                sitarFilter.Q.setValueAtTime(8, this.audioContext.currentTime);
                oscillator.connect(sitarFilter);
                sitarFilter.connect(gainNode);
                // Add sympathetic strings
                const sympatheticOsc = this.audioContext.createOscillator();
                sympatheticOsc.type = 'sine';
                sympatheticOsc.frequency.setValueAtTime(pitch.freq * 1.01, this.audioContext.currentTime);
                const sympatheticGain = this.audioContext.createGain();
                sympatheticGain.gain.setValueAtTime(0.05, this.audioContext.currentTime);
                sympatheticOsc.connect(sympatheticGain);
                sympatheticGain.connect(this.audioContext.destination);
                sympatheticOsc.start();
                sympatheticOsc.stop(this.audioContext.currentTime + this.toneDuration);
                break;

            case 'didgeridoo':
                oscillator.type = 'sine';
                // Low drone with formant filtering
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

            case 'bagpipes':
                // Complex drone with chanter melody
                const droneOsc = this.audioContext.createOscillator();
                droneOsc.type = 'sine';
                droneOsc.frequency.setValueAtTime(pitch.freq * 0.5, this.audioContext.currentTime); // Low drone
                const droneGain = this.audioContext.createGain();
                droneGain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                droneOsc.connect(droneGain);
                droneGain.connect(this.audioContext.destination);
                droneOsc.start();
                droneOsc.stop(this.audioContext.currentTime + this.toneDuration);
                // Chanter (main melody)
                const chanterFilter = this.audioContext.createBiquadFilter();
                chanterFilter.type = 'bandpass';
                chanterFilter.frequency.setValueAtTime(1500, this.audioContext.currentTime);
                chanterFilter.Q.setValueAtTime(5, this.audioContext.currentTime);
                oscillator.connect(chanterFilter);
                chanterFilter.connect(gainNode);
                // Add reedy quality
                const chanterNoise = this.audioContext.createBufferSource();
                const chanterBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.05, this.audioContext.sampleRate);
                const chanterData = chanterBuffer.getChannelData(0);
                for (let i = 0; i < chanterData.length; i++) {
                    chanterData[i] = (Math.random() - 0.5) * 0.03;
                }
                const chanterNoiseGain = this.audioContext.createGain();
                chanterNoiseGain.gain.setValueAtTime(0.02, this.audioContext.currentTime);
                chanterNoise.buffer = chanterBuffer;
                chanterNoise.connect(chanterNoiseGain);
                chanterNoiseGain.connect(gainNode);
                chanterNoise.start();
                chanterNoise.stop(this.audioContext.currentTime + 0.05);
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