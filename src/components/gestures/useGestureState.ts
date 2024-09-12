import { proxy, useSnapshot } from 'valtio';

export const gestureState = proxy({
	claimedBy: null as string | null,
});

export function useGestureState() {
	return useSnapshot(gestureState);
}
