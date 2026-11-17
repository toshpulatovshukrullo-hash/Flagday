import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import { DURATION_FRAMES, FPS, FlagDayProps, defaultProps } from './config';
import { FlagDay } from './FlagDay';

const calc: CalculateMetadataFunction<FlagDayProps> = ({ props }) => ({
  width: props.width, height: props.height, durationInFrames: DURATION_FRAMES, fps: FPS,
});

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="FlagDay" component={FlagDay} durationInFrames={DURATION_FRAMES} fps={FPS}
      width={1080} height={1920} defaultProps={defaultProps} calculateMetadata={calc} />
    <Composition id="FlagDay1x1" component={FlagDay} durationInFrames={DURATION_FRAMES} fps={FPS}
      width={1080} height={1080} defaultProps={{ ...defaultProps, width: 1080, height: 1080 }} calculateMetadata={calc} />
    <Composition id="FlagDay4x5" component={FlagDay} durationInFrames={DURATION_FRAMES} fps={FPS}
      width={1080} height={1350} defaultProps={{ ...defaultProps, width: 1080, height: 1350 }} calculateMetadata={calc} />
  </>
);
