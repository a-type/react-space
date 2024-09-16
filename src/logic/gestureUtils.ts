import { CommonGestureState, SharedGestureState } from '@use-gesture/react';
import { CanvasGestureInput } from './Canvas.js';
import { Vector2 } from '../types.js';

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
	canvasGestureState: { displacement: Vector2 },
) {
	input.alt = state.altKey;
	input.ctrlOrMeta = state.ctrlKey || state.metaKey;
	input.shift = state.shiftKey;
	input.delta.x = state.delta[0];
	input.delta.y = state.delta[1];
	// unfortunately it seems this requires allocation to keep
	// signals happy.
	input.distance = {
		x: state.movement[0],
		y: state.movement[1],
	};
	input.screenPosition.x = Math.round(
		state.xy[0] + canvasGestureState.displacement.x,
	);
	input.screenPosition.y = Math.round(
		state.xy[1] + canvasGestureState.displacement.y,
	);
}

export function isTouchEvent(event: Event) {
	if (event.type.startsWith('touch')) return true;
	if (event.type.startsWith('pointer'))
		return (event as PointerEvent).pointerType === 'touch';
	return false;
}
