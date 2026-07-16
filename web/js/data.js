(function (global) {
  const spots = [
    {
      id: "pond",
      name: "ため池",
      mood: "静かな水面",
      tint: "rgba(120, 228, 255, 0.16)",
      stageTop: "rgba(85, 196, 228, 0.26)",
      stageBottom: "rgba(12, 38, 60, 0.96)",
      glow: "rgba(129, 237, 255, 0.2)",
      targetBoost: 0,
    },
    {
      id: "river",
      name: "川",
      mood: "やわらかな流れ",
      tint: "rgba(93, 190, 255, 0.2)",
      stageTop: "rgba(83, 186, 255, 0.3)",
      stageBottom: "rgba(9, 32, 56, 0.97)",
      glow: "rgba(110, 210, 255, 0.22)",
      targetBoost: 1,
    },
    {
      id: "sea",
      name: "海",
      mood: "深い海の気配",
      tint: "rgba(58, 150, 255, 0.24)",
      stageTop: "rgba(53, 150, 255, 0.32)",
      stageBottom: "rgba(5, 21, 42, 0.98)",
      glow: "rgba(87, 170, 255, 0.28)",
      targetBoost: 2,
    },
  ];

  const fish = [
    { id: 0, name: "Minnow", rarity: "common" },
    { id: 1, name: "Carp", rarity: "common" },
    { id: 2, name: "Trout", rarity: "rare" },
    { id: 3, name: "King Salmon", rarity: "epic" },
    { id: 4, name: "Moon Jelly", rarity: "rare" },
    { id: 5, name: "Pearl Eel", rarity: "epic" },
  ];

  global.CardQuest = global.CardQuest || {};
  global.CardQuest.data = { spots, fish };
})(window);
