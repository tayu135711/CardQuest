(function (global) {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function detectBluePresence(imageData) {
    if (!imageData) {
      return null;
    }

    const { data, width, height } = imageData;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const sampleHalf = Math.max(36, Math.floor(Math.min(width, height) * 0.2));
    let bluePixels = 0;
    let totalPixels = 0;
    let blueScoreSum = 0;

    for (let y = centerY - sampleHalf; y <= centerY + sampleHalf; y += 4) {
      if (y < 0 || y >= height) continue;

      for (let x = centerX - sampleHalf; x <= centerX + sampleHalf; x += 4) {
        if (x < 0 || x >= width) continue;

        const index = (y * width + x) * 4;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const blueScore = blue - Math.max(red, green);

        totalPixels += 1;
        blueScoreSum += blueScore;
        if (blue > 110 && blueScore > 35) {
          bluePixels += 1;
        }
      }
    }

    if (!totalPixels) return null;

    const blueRatio = bluePixels / totalPixels;
    const averageBlueScore = blueScoreSum / totalPixels;

    if (blueRatio < 0.12 || averageBlueScore < 18) {
      return null;
    }

    return {
      blueRatio,
      averageBlueScore,
      intensity: clamp(blueRatio * 5, 0, 1),
    };
  }

  function pickSpot(bluePresence, spots) {
    const index = clamp(Math.floor(bluePresence.intensity * spots.length), 0, spots.length - 1);
    return spots[index];
  }

  global.CardQuest = global.CardQuest || {};
  global.CardQuest.blueDetector = {
    detectBluePresence,
    pickSpot,
  };
})(window);
