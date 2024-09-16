import { CommonGestureState, SharedGestureState } from '@use-gesture/react';
import { CanvasGestureInput } from './Canvas.js';
import { Vector2 } from '../types.js';
import { subtractVectors, vectorLength } from './math.js';

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
	input.screenDelta.x = state.delta[0];
	input.screenDelta.y = state.delta[1];
	input.pointerWorldPosition = worldPosition;
}

export function isTouchEvent(event: Event) {
	if (event.type.startsWith('touch')) return true;
	if (event.type.startsWith('pointer'))
		return (event as PointerEvent).pointerType === 'touch';
	return false;
}

export function isMouseEvent(event: Event) {
	if (event.type.startsWith('mouse')) return true;
	if (event.type.startsWith('pointer'))
		return (event as PointerEvent).pointerType === 'mouse';
	return false;
}

export function isLeftButton(buttons: number) {
	return !!(buttons & 1);
}

export function isMiddleButton(buttons: number) {
	return !!(buttons & 4);
}

export function isRightButton(buttons: number) {
	return !!(buttons & 2);
}

export function isDrag(input: CanvasGestureInput) {
	return vectorLength(input.distance) > 5;
}
