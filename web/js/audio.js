(function (global) {
  function createOceanAudio() {
    let context = null;
    let master = null;
    let lowOsc = null;
    let highOsc = null;
    let noise = null;
    let noiseGain = null;
    let textureGain = null;
    let initialized = false;

    function ensureContext() {
      if (context) return context;
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = 0.02;
      master.connect(context.destination);
      return context;
    }

    function createNoiseBuffer() {
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i += 1) {
        channel[i] = (Math.random() * 2 - 1) * 0.25;
      }
      return buffer;
    }

    async function start() {
      ensureContext();
      if (initialized) {
        if (context.state === "suspended") await context.resume();
        return;
      }

      if (context.state === "suspended") {
        await context.resume();
      }

      lowOsc = context.createOscillator();
      lowOsc.type = "sine";
      lowOsc.frequency.value = 32;

      const lowFilter = context.createBiquadFilter();
      lowFilter.type = "lowpass";
      lowFilter.frequency.value = 120;

      const lowGain = context.createGain();
      lowGain.gain.value = 0.018;

      lowOsc.connect(lowFilter);
      lowFilter.connect(lowGain);
      lowGain.connect(master);

      highOsc = context.createOscillator();
      highOsc.type = "triangle";
      highOsc.frequency.value = 216;

      const highFilter = context.createBiquadFilter();
      highFilter.type = "bandpass";
      highFilter.frequency.value = 660;
      highFilter.Q.value = 0.6;

      const highGain = context.createGain();
      highGain.gain.value = 0.004;

      highOsc.connect(highFilter);
      highFilter.connect(highGain);
      highGain.connect(master);

      noise = context.createBufferSource();
      noise.buffer = createNoiseBuffer();
      noise.loop = true;

      const noiseFilter = context.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.value = 280;
      noiseFilter.Q.value = 0.9;

      noiseGain = context.createGain();
      noiseGain.gain.value = 0.012;

      textureGain = context.createGain();
      textureGain.gain.value = 0.006;

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(textureGain);
      textureGain.connect(master);

      lowOsc.start();
      highOsc.start();
      noise.start();
      initialized = true;
    }

    function setSpot(spot) {
      if (!master || !context) return;
      master.gain.setTargetAtTime(0.02 + (spot.targetBoost * 0.003), context.currentTime, 0.1);
      if (lowOsc) {
        lowOsc.frequency.setTargetAtTime(30 + spot.targetBoost * 2, context.currentTime, 0.15);
      }
      if (highOsc) {
        highOsc.frequency.setTargetAtTime(200 + spot.targetBoost * 12, context.currentTime, 0.15);
      }
    }

    function pulse(intensity = 1) {
      if (!context || !textureGain) return;
      textureGain.gain.cancelScheduledValues(context.currentTime);
      textureGain.gain.setTargetAtTime(0.006 + intensity * 0.009, context.currentTime, 0.05);
    }

    function stop() {
      try {
        lowOsc?.stop();
        highOsc?.stop();
        noise?.stop();
      } catch {}
      context?.close();
      context = null;
      initialized = false;
    }

    return {
      start,
      setSpot,
      pulse,
      stop,
      getContext: () => context,
    };
  }

  global.CardQuest = global.CardQuest || {};
  global.CardQuest.audio = { createOceanAudio };
})(window);
