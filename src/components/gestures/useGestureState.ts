import { proxy, useSnapshot } from 'valtio';

export const gestureState = proxy({
	claimedBy: null as string | null,
	claimType: null as 'object' | 'canvas' | 'region' | null,
});

export function useGestureState() {
	return useSnapshot(gestureState);
}

export function resetGestureState() {
	gestureState.claimedBy = null;
	gestureState.claimType = null;
}

export function claimGesture(type: 'canvas'): void;
export function claimGesture(type: 'object' | 'region', id: string): void;
export function claimGesture(
	type: 'object' | 'region' | 'canvas',
	id?: string,
) {
	gestureState.claimedBy = id ?? null;
	gestureState.claimType = type;
}

export function hasClaim(type: 'canvas'): boolean;
export function hasClaim(type: 'object' | 'region', id: string): boolean;
export function hasClaim(type: 'object' | 'region' | 'canvas', id?: string) {
	return (
		gestureState.claimType === type && gestureState.claimedBy === (id ?? null)
	);
}

// @ts-ignore
window.gestureState = gestureState;
