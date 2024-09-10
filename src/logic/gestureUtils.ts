import { CommonGestureState, SharedGestureState } from '@use-gesture/react';
import { CanvasGestureInput } from './Canvas.js';

type GestureState = CommonGestureState &
	SharedGestureState & { xy: [number, number] };

export function gestureStateToInput(state: GestureState): CanvasGestureInput {
	return {
		screenPosition: { x: state.xy[0], y: state.xy[1] },
		alt: state.altKey,
		shift: state.shiftKey,
		ctrlOrMeta: state.ctrlKey || state.metaKey,
		intentional: state.intentional,
		delta: { x: state.delta[0], y: state.delta[1] },
		distance: { x: state.offset[0], y: state.offset[1] },
	};
}

export function applyGestureState(
	input: CanvasGestureInput,
	state: GestureState,
) {
	input.alt = state.altKey;
	input.ctrlOrMeta = state.ctrlKey || state.metaKey;
	input.shift = state.shiftKey;
	input.delta.x = state.delta[0];
	input.delta.y = state.delta[1];
	input.distance.x = state.offset[0];
	input.distance.y = state.offset[1];
	input.screenPosition.x = state.xy[0];
	input.screenPosition.y = state.xy[1];
}
