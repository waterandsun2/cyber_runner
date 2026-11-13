export const LANE_X_POSITIONS = [-2.8, 0, 2.8] as const;

export const GAME_CONFIG = {
  INITIAL_LIVES: 3,
  MAX_LIVES: 3,
  BASE_SPEED: 24, // units per second
  MAX_SPEED: 42,
  SPEED_ACCELERATION: 0.25, // speed increase per 100m
  JUMP_HEIGHT: 2.3,
  JUMP_DURATION: 0.65, // seconds
  TRACK_SEGMENT_LENGTH: 120,
  SPAWN_AHEAD_DISTANCE: -90,
  DESPAWN_DISTANCE: 18,
  COIN_POINTS: 1,
  INVULNERABLE_DURATION: 1.5, // seconds after hit
};
