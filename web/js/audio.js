(function (global) {
  function createOceanAudio() {
    if (!global.Tone) {
      return {
        start() { return Promise.resolve(); },
        setSpot() {},
        pulse() {},
        playCatch() {},
        stop() {},
      };
    }

    const palettes = {
      pond: { chord: ["C3", "E3", "G3"], noise: 0.012, filter: 210 },
      river: { chord: ["Bb2", "D3", "F3"], noise: 0.013, filter: 185 },
      sea: { chord: ["A2", "C3", "E3"], noise: 0.015, filter: 160 },
    };

    let started = false;
    let noise = null;
    let noiseFilter = null;
    let noiseGain = null;
    let pad = null;
    let padFilter = null;
    let padReverb = null;
    let chime = null;
    let currentPalette = palettes.sea;

    async function start() {
      if (started) {
        await global.Tone.start();
        return;
      }

      await global.Tone.start();

      padReverb = new global.Tone.Reverb({ decay: 10, wet: 0.42 });
      await padReverb.generate();

      padFilter = new global.Tone.Filter(180, "lowpass");
      pad = new global.Tone.PolySynth(global.Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 1.8, decay: 1.2, sustain: 0.58, release: 5 },
      });
      pad.chain(padFilter, padReverb, global.Tone.Destination);

      noiseFilter = new global.Tone.Filter(currentPalette.filter, "lowpass");
      noiseGain = new global.Tone.Gain(currentPalette.noise);
      noise = new global.Tone.Noise("pink").start();
      noise.chain(noiseFilter, noiseGain, padReverb);

      chime = new global.Tone.PolySynth(global.Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 1.6 },
      }).connect(padReverb);

      started = true;
      pad.triggerAttack(currentPalette.chord);
    }

    function setSpot(spot) {
      currentPalette = palettes[spot.id] || palettes.sea;
      if (padFilter) {
        padFilter.frequency.rampTo(currentPalette.filter, 0.8);
      }
      if (noiseFilter) {
        noiseFilter.frequency.rampTo(currentPalette.filter + 45, 0.8);
      }
      if (noiseGain) {
        noiseGain.gain.rampTo(currentPalette.noise, 0.8);
      }
      if (pad) {
        pad.triggerAttackRelease(currentPalette.chord, "2m");
      }
    }

    function pulse(intensity = 1) {
      if (noiseGain) {
        noiseGain.gain.rampTo(currentPalette.noise + intensity * 0.01, 0.08);
      }
      if (padFilter) {
        padFilter.frequency.rampTo(currentPalette.filter + intensity * 40, 0.08);
      }
    }

    function playCatch() {
      if (!chime) {
        return;
      }
      chime.triggerAttackRelease(["C5", "E5", "G5", "B5"], "8n");
      if (padFilter) {
        padFilter.frequency.rampTo(currentPalette.filter + 90, 0.14);
      }
    }

    function stop() {
      try { noise?.stop(); } catch {}
      try { pad?.dispose(); } catch {}
      try { chime?.dispose(); } catch {}
      try { padReverb?.dispose(); } catch {}
      try { padFilter?.dispose(); } catch {}
      try { noiseFilter?.dispose(); } catch {}
      try { noiseGain?.dispose(); } catch {}
    }

    return {
      start,
      setSpot,
      pulse,
      playCatch,
      stop,
    };
  }

  global.CardQuest = global.CardQuest || {};
  global.CardQuest.audio = { createOceanAudio };
})(window);
