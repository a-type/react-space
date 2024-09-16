import { PointerEvent as ReactPointerEvent, useCallback } from 'react';
import { proxy, useSnapshot } from 'valtio';
import { useStableCallback } from '../../hooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { useDrag } from '@use-gesture/react';
import {
	isLeftButton,
	isMiddleButton,
	isRightButton,
} from '../../logic/gestureUtils.js';

export const gestureState = proxy({
	claimedBy: null as string | null,
	claimType: null as 'object' | 'tool' | 'canvas' | null,
});

export function useGestureState() {
	return useSnapshot(gestureState);
}

export function resetGestureState() {
	gestureState.claimedBy = null;
	gestureState.claimType = null;
}

export function claimGesture(type: 'canvas'): void;
export function claimGesture(type: 'object' | 'tool', id: string): void;
export function claimGesture(type: 'object' | 'tool' | 'canvas', id?: string) {
	console.log('claiming for', type, id);
	gestureState.claimedBy = id ?? null;
	gestureState.claimType = type;
}

export function hasClaim(type: 'canvas'): boolean;
export function hasClaim(type: 'object' | 'tool', id: string): boolean;
export function hasClaim(type: 'object' | 'tool' | 'canvas', id?: string) {
	return (
		gestureState.claimType === type && gestureState.claimedBy === (id ?? null)
	);
}

export interface GestureClaimDetail {
	isLeftMouse: boolean;
	isRightMouse: boolean;
	isMiddleMouse: boolean;
	isTouch: boolean;
	shift: boolean;
	ctrlOrMeta: boolean;
	alt: boolean;
	target: EventTarget;
	existingClaimType: 'object' | 'tool' | 'canvas' | null;
	existingClaimId: string | null;
}

/**
 * Required configuration to claim a gesture for an object when
 * the interaction begins. You must either pass the returned props
 * to an element, or pass onCanvas=true to attach to the root Canvas
 * gesture layer.
 */
export function useClaimGesture(
	type: 'object' | 'tool',
	id: string,
	filter: (detail: GestureClaimDetail) => boolean = () => true,
	{
		onCanvas,
		overrideOtherClaim,
	}: { onCanvas?: boolean; overrideOtherClaim?: boolean } = {},
) {
	const canvas = useCanvas();
	return useDrag(
		(state) => {
			if (!state.first) {
				return;
			}

			if (gestureState.claimedBy && !overrideOtherClaim) {
				return;
			}

			const detail: GestureClaimDetail = {
				isLeftMouse: isLeftButton(state.buttons),
				isRightMouse: isRightButton(state.buttons),
				isMiddleMouse: isMiddleButton(state.buttons),
				isTouch: state.event.type === 'touchstart' || state.touches > 0,
				shift: state.event.shiftKey,
				ctrlOrMeta: state.event.ctrlKey || state.event.metaKey,
				alt: state.event.altKey,
				target: state.target,
				existingClaimType: gestureState.claimType,
				existingClaimId: gestureState.claimedBy,
			};

			if (filter(detail)) {
				claimGesture(type, id);
			}
		},
		{
			target: onCanvas ? canvas.gestureLayerRef : undefined,
			eventOptions: {
				capture: true,
			},
		},
	);
}

// @ts-ignore
window.gestureState = gestureState;
