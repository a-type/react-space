import { BoundsRegistryEntry } from '../logic/BoundsRegistry.js';
import { Vector2 } from '../types.js';
import { Signal } from 'signia';
import { closestLivePoint } from '../logic/math.js';
import { useMemo } from 'react';

export function useClosestPointTo(
	entry: BoundsRegistryEntry<any>,
	point: Signal<Vector2>,
	shortenBy = 0,
) {
	return useMemo(() => {
		const { center, size } = entry.transform;
		return closestLivePoint(center, size, point, shortenBy);
	}, [entry, point, shortenBy]);
}
