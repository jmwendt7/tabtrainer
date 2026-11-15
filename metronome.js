// Web Audio lookahead metronome: schedules clicks on the audio clock, so no drift.
export class Metronome {
  constructor() {
    this.ctx = null;
    this.bpm = 90;
    this.beats = 4;
    this.countIn = false;
    this.running = false;
    this.onBeat = null;
    this._timer = null;
    this._beat = 0;
    this._next = 0;
    this._queue = [];
  }

  // Must be called from a user gesture (iOS).
  unlock() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  start() {
    this.unlock();
    this.running = true;
    this._beat = this.countIn ? -this.beats : 0;
    this._next = this.ctx.currentTime + 0.08;
    this._timer = setInterval(() => this._schedule(), 25);
    this._raf();
    this._schedule();
  }

  stop() {
    this.running = false;
    clearInterval(this._timer);
    this._queue = [];
  }

  _click(time, accent) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(accent ? 1 : 0.6, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    o.connect(g).connect(this.ctx.destination);
    o.start(time);
    o.stop(time + 0.06);
  }

  _schedule() {
    while (this._next < this.ctx.currentTime + 0.15) {
      const pos = ((this._beat % this.beats) + this.beats) % this.beats;
      this._click(this._next, pos === 0);
      this._queue.push({ time: this._next, beat: pos, countIn: this._beat < 0 });
      this._next += 60 / this.bpm; // bpm changes apply on the next beat
      this._beat++;
    }
  }

  _raf() {
    if (!this.running) return;
    while (this._queue.length && this._queue[0].time <= this.ctx.currentTime) {
      const e = this._queue.shift();
      if (this.onBeat) this.onBeat(e);
    }
    requestAnimationFrame(() => this._raf());
  }
}
