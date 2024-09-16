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
		distance: { x: state.offset[0], y: state.offset[1] },
	};
}

export function applyGestureState(
	input: CanvasGestureInput,
	state: GestureState,
	distance: Vector2,
) {
	input.alt = state.altKey;
	input.ctrlOrMeta = state.ctrlKey || state.metaKey;
	input.shift = state.shiftKey;
	// unfortunately it seems this requires allocation to keep
	// signals happy.
	input.distance = distance;
	input.screenPosition.x = state.xy[0];
	input.screenPosition.y = state.xy[1];
}

export function isTouchEvent(event: Event) {
	if (event.type.startsWith('touch')) return true;
	if (event.type.startsWith('pointer'))
		return (event as PointerEvent).pointerType === 'touch';
	return false;
}
