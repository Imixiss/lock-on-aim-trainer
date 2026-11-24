export class TimerCues {
  constructor() {
    this.played = new Set();
  }

  reset() {
    this.played.clear();
  }

  update(remaining, audio) {
    [10, 5].forEach((seconds) => {
      if (remaining > 0 && remaining <= seconds && !this.played.has(seconds)) {
        this.played.add(seconds);
        audio.bell(seconds === 10 ? 1568 : 1960, 0.105, 0.42);
      }
    });
  }
}
