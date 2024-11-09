import { proxy, useSnapshot } from 'valtio';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { useDrag } from '@use-gesture/react';
import {
	isLeftButton,
	isMiddleButton,
	isRightButton,
} from '../../logic/gestureUtils.js';

export const gestureState = proxy({
	claimedBy: null as string | null,
	claimType: null as 'surface' | 'tool' | 'canvas' | null,
});

export function useGestureState() {
	return useSnapshot(gestureState);
}

export function resetGestureState() {
	gestureState.claimedBy = null;
	gestureState.claimType = null;
}

export function claimGesture(type: 'canvas'): void;
export function claimGesture(type: 'surface' | 'tool', id: string): void;
export function claimGesture(type: 'surface' | 'tool' | 'canvas', id?: string) {
	console.log('claiming for', type, id);
	gestureState.claimedBy = id ?? null;
	gestureState.claimType = type;
}

export function hasClaim(type: 'canvas'): boolean;
export function hasClaim(type: 'surface' | 'tool', id: string): boolean;
export function hasClaim(type: 'surface' | 'tool' | 'canvas', id?: string) {
	return (
		gestureState.claimType === type && gestureState.claimedBy === (id ?? null)
	);
}

export interface GestureClaimDetail {
	isLeftMouse: boolean;
	isRightMouse: boolean;
	isMiddleMouse: boolean;
	isTouch: boolean;
	isPinch: boolean;
	touchesCount: number;
	shift: boolean;
	ctrlOrMeta: boolean;
	alt: boolean;
	target: EventTarget;
	existingClaimType: 'surface' | 'tool' | 'canvas' | null;
	existingClaimId: string | null;
}

/**
 * Required configuration to claim a gesture for an surface when
 * the interaction begins. You must either pass the returned props
 * to an element, or pass onCanvas=true to attach to the root Canvas
 * gesture layer.
 */
export function useClaimGesture(
	type: 'surface' | 'tool',
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

			const isTouch = state.event.type === 'touchstart' || state.touches > 0;
			const detail: GestureClaimDetail = {
				isLeftMouse: !isTouch && isLeftButton(state.buttons),
				isRightMouse: !isTouch && isRightButton(state.buttons),
				isMiddleMouse: !isTouch && isMiddleButton(state.buttons),
				isTouch,
				shift: state.event.shiftKey,
				ctrlOrMeta: state.event.ctrlKey || state.event.metaKey,
				alt: state.event.altKey,
				target: state.target,
				existingClaimType: gestureState.claimType,
				existingClaimId: gestureState.claimedBy,
				touchesCount: state.touches,
				isPinch: !!state.pinching,
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
