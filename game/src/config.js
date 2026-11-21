// Goldshore: every tuning number and colour in one place. The world is a fixed 1280x720 logical area.
export const WORLD = { width: 1280, height: 720, landY: 560, coastY: 600 };

export const STEP = 1 / 60;

export const CAR = { width: 46, height: 24, speed: 210, maxSpeed: 290, accel: 120, brake: 320, turn: 2.3 };

export const PED = { radius: 10, speed: 74 };
export const COP = { radius: 11, speed: 92, damage: 12, shootRange: 120 };

export const WANTED = { max: 5, decayAfter: 16, copDistance: 430 };

export const HEALTH = 100;
export const SHOOT_RANGE = 430;

export const MISSIONS = [
  { id: 'harbor-run', title: 'Harbor Run', where: 'Old Market', objective: 'Get the package to the Old Market drop.', kind: 'drive', target: { x: 80, y: 300 } },
  { id: 'market-vigil', title: 'Market Vigil', where: 'Old Market', objective: 'Hold Stall 12 against the harbor crew.', kind: 'defend', waves: 2 },
  { id: 'hillside', title: 'Hillside', where: 'Hillside', objective: 'Lose the Goldshore PD in the hills.', kind: 'lose' },
];

export const PALETTE = {
  skyTop: '#79c2e4',
  skyBottom: '#e8f7fd',
  sun: '#fff3c4',
  water: '#2f6f8f',
  waterDeep: '#1d4e6b',
  sand: '#eedcae',
  sandDeep: '#e0c68c',
  road: '#71798a',
  roadLine: '#ece7db',
  sidewalk: '#d9cba9',
  building: ['#9db4c6', '#b09a86', '#8ba08c', '#c0a488', '#7e93a8', '#a08c9b', '#97a08b'],
  tint: ['#a9bcd0', '#8fa39c', '#9aa7b5', '#b3a08c'],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const BEST_KEY = 'goldshore.save.v1';
