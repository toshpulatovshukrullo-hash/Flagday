/** Scene timing in seconds (§3). Frame = s × 30. */
export const T = {
  birdIn: 0.0, birdInDur: 2.2,
  ribbonIn: 2.2, spiralStart: 3.4, spiralEnd: 5.5,
  logoIn: 3.5, logoInDur: 1.6,
  traceStart: 5.5, traceHeadEnd: 7.4, traceTailEnd: 8.0,
  yilligiIn: 7.0,
  streaksIn: 8.0, streaksDur: 1.5,
  edgeIn: 8.0,
  lowerThirdIn: 9.0,
  finale: 11.0,
  birdOut: 11.0, birdOutDur: 1.6,
  textDissolve: 11.1,
  glide: 11.0, glideDur: 0.8,
  ring: 11.6, ringDur: 0.6,
  badge: 12.0, badgeDur: 0.75,
  sweep: 13.0, sweepDur: 0.8,
  end: 14.0,
} as const;
