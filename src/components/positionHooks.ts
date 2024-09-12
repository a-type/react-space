import { useComputed } from 'signia-react';
import { BoundsRegistryEntry } from '../logic/BoundsRegistry.js';
import { LiveVector2, Vector2 } from '../types.js';
import { Signal } from 'signia';
import { closestLivePoint } from '../logic/math.js';

export function useCenter(entry: BoundsRegistryEntry) {
	return useComputed(
		`center of ${entry.id}`,
		() => {
			const origin = entry.origin.value;
			const size = entry.size.value;
			return {
				x: origin.x + size.width / 2,
				y: origin.y + size.height / 2,
			};
		},
		[entry],
	);
}

export function useClosestPointTo(
	entry: BoundsRegistryEntry,
	point: Signal<Vector2>,
	shortenBy = 0,
) {
	const center = useCenter(entry);
	return useComputed(
		`closest point to ${entry.id}`,
		() => {
			return closestLivePoint(center, entry.size, point, shortenBy);
		},
		[entry, point, center, shortenBy],
	);
}
