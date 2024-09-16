import { CommonGestureState, SharedGestureState } from '@use-gesture/react';
import { CanvasGestureInput } from './Canvas.js';
import { Vector2 } from '../types.js';
import { subtractVectors } from './math.js';

type GestureState = CommonGestureState &
	SharedGestureState & { xy: [number, number] };

export function applyGestureState(
	input: CanvasGestureInput,
	state: GestureState,
	worldPosition: Vector2,
) {
	input.alt = state.altKey;
	input.ctrlOrMeta = state.ctrlKey || state.metaKey;
	input.shift = state.shiftKey;
	input.distance = subtractVectors(worldPosition, input.startPosition);
	input.screenPosition.x = state.xy[0];
	input.screenPosition.y = state.xy[1];
}

export function isTouchEvent(event: Event) {
	if (event.type.startsWith('touch')) return true;
	if (event.type.startsWith('pointer'))
		return (event as PointerEvent).pointerType === 'touch';
	return false;
}
