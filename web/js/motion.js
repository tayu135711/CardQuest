(function (global) {
  function createMotionController({ onChange, onFallbackMessage }) {
    let motionStarted = false;
    let pointerFallbackBound = false;

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function handleOrientation(event) {
      if (typeof event.beta !== "number") return;
      const normalized = clamp((event.beta + 45) / 90, 0, 1);
      onChange(normalized);
    }

    function bindPointerFallback(target) {
      if (!target || pointerFallbackBound) return;
      pointerFallbackBound = true;

      const updateFromPointer = (event) => {
        const rect = target.getBoundingClientRect();
        const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
        onChange(y);
      };

      target.addEventListener("pointerdown", (event) => {
        target.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      });

      target.addEventListener("pointermove", (event) => {
        if (event.buttons) updateFromPointer(event);
      });
    }

    async function start(target) {
      if (motionStarted) return;
      motionStarted = true;

      if (!("DeviceOrientationEvent" in window)) {
        onFallbackMessage("傾きが使えません。画面を上下にドラッグしてください。");
        bindPointerFallback(target);
        return;
      }

      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission !== "granted") {
            onFallbackMessage("傾きの権限が必要です。画面を上下にドラッグしてください。");
            bindPointerFallback(target);
            return;
          }
        } catch {
          onFallbackMessage("傾きの権限が使えません。画面を上下にドラッグしてください。");
          bindPointerFallback(target);
          return;
        }
      }

      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    function stop() {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      motionStarted = false;
    }

    return {
      start,
      stop,
      bindPointerFallback,
    };
  }

  global.CardQuest = global.CardQuest || {};
  global.CardQuest.motion = { createMotionController };
})(window);
