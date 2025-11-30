export default {
  async fetch(request, env, ctx) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pitchpipe</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            color: white;
            user-select: none;
            -webkit-user-select: none;
            touch-action: manipulation;
        }

        .header {
            text-align: center;
            padding: 2rem 1rem 1rem;
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 300;
            margin-bottom: 0.5rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .subtitle {
            font-size: 1rem;
            opacity: 0.9;
            font-weight: 300;
        }

        .pitch-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 1rem;
            gap: 2rem;
        }

        .current-pitch {
            font-size: 4rem;
            font-weight: 200;
            text-align: center;
            min-height: 5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            text-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }

        .pitch-buttons {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0.75rem;
            width: 100%;
            max-width: 400px;
            padding: 0 1rem;
        }

        .pitch-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 1.25rem 0.5rem;
            border-radius: 12px;
            font-size: 1.25rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
        }

        .pitch-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }

        .pitch-btn:active {
            transform: translateY(0);
            background: rgba(255, 255, 255, 0.4);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .pitch-btn.playing {
            background: rgba(255, 255, 255, 0.5);
            border-color: rgba(255, 255, 255, 0.8);
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
            70% { box-shadow: 0 0 0 20px rgba(255, 255, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }

        .controls {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
        }

        .control-btn {
            background: rgba(255, 255, 255, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }

        .control-btn:hover {
            background: rgba(255, 255, 255, 0.25);
        }

        .control-btn:active {
            transform: scale(0.95);
        }

        @media (max-width: 480px) {
            h1 {
                font-size: 2rem;
            }
            
            .current-pitch {
                font-size: 3rem;
                min-height: 4rem;
            }
            
            .pitch-buttons {
                grid-template-columns: repeat(3, 1fr);
                gap: 0.5rem;
                max-width: 300px;
            }
            
            .pitch-btn {
                padding: 1rem 0.25rem;
                font-size: 1.1rem;
            }
        }

        @media (min-width: 768px) {
            .pitch-buttons {
                grid-template-columns: repeat(6, 1fr);
                max-width: 600px;
            }
        }

        .frequency-display {
            font-size: 0.9rem;
            opacity: 0.8;
            text-align: center;
            margin-top: -1rem;
            min-height: 1.2rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pitchpipe</h1>
        <div class="subtitle">Tap a note to play its pitch</div>
    </div>

    <div class="pitch-container">
        <div class="current-pitch" id="currentPitch">Ready</div>
        <div class="frequency-display" id="frequencyDisplay"></div>
        
        <div class="pitch-buttons" id="pitchButtons">
            <!-- Pitch buttons will be generated by JavaScript -->
        </div>

        <div class="controls">
            <button class="control-btn" id="stopBtn">Stop All</button>
            <button class="control-btn" id="autoPlayBtn">Auto Play</button>
        </div>
    </div>

    <script>
        class Pitchpipe {
            constructor() {
                this.audioContext = null;
                this.currentOscillators = new Map();
                this.autoPlayInterval = null;
                this.currentAutoPlayIndex = 0;
                
                this.pitches = [
                    { note: 'C3', freq: 130.81 },
                    { note: 'C#3', freq: 138.59 },
                    { note: 'D3', freq: 146.83 },
                    { note: 'D#3', freq: 155.56 },
                    { note: 'E3', freq: 164.81 },
                    { note: 'F3', freq: 174.61 },
                    { note: 'F#3', freq: 185.00 },
                    { note: 'G3', freq: 196.00 },
                    { note: 'G#3', freq: 207.65 },
                    { note: 'A3', freq: 220.00 },
                    { note: 'A#3', freq: 233.08 },
                    { note: 'B3', freq: 246.94 },
                    { note: 'C4', freq: 261.63 },
                    { note: 'C#4', freq: 277.18 },
                    { note: 'D4', freq: 293.66 },
                    { note: 'D#4', freq: 311.13 },
                    { note: 'E4', freq: 329.63 },
                    { note: 'F4', freq: 349.23 },
                    { note: 'F#4', freq: 369.99 },
                    { note: 'G4', freq: 392.00 },
                    { note: 'G#4', freq: 415.30 },
                    { note: 'A4', freq: 440.00 },
                    { note: 'A#4', freq: 466.16 },
                    { note: 'B4', freq: 493.88 },
                    { note: 'C5', freq: 523.25 },
                    { note: 'C#5', freq: 554.37 },
                    { note: 'D5', freq: 587.33 },
                    { note: 'D#5', freq: 622.25 },
                    { note: 'E5', freq: 659.25 },
                    { note: 'F5', freq: 698.46 },
                    { note: 'F#5', freq: 739.99 },
                    { note: 'G5', freq: 783.99 },
                    { note: 'G#5', freq: 830.61 },
                    { note: 'A5', freq: 880.00 },
                    { note: 'A#5', freq: 932.33 },
                    { note: 'B5', freq: 987.77 }
                ];

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
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  },
};