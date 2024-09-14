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

// @ts-ignore
window.gestureState = gestureState;
