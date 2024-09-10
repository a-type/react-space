import { useAtom } from 'signia-react';
import { Vector2 } from '../../types.js';
import { useEffect } from 'react';
import { useStableCallback } from '../../hooks.js';

/**
 * Converts a custom Vector value to a live position which can be
 * given to an Object.
 */
export function useLiveVector(
	subscribe: (onChange: (value: Vector2) => void) => () => void,
	get: () => Vector2,
) {
	const position = useAtom<Vector2>('useLiveVector', get);
	const stableSubscribe = useStableCallback(subscribe);
	useEffect(() => {
		return stableSubscribe(position.set);
	}, [position, stableSubscribe]);

	return position;
}

/**
 * A default state value for a vector. Create one and pass it to
 * useLiveVector to create a live position to be used in the Canvas.
 *
 * This is only an example implementation. Usually you'd instead want to
 * integrate your own app's state into useLiveVector instead.
 */
export class VectorState {
	private subscribers: ((value: Vector2) => void)[] = [];
	constructor(private current: Vector2) {}
	get() {
		return this.current;
	}
	set(value: Vector2) {
		this.current = value;
		this.subscribers.forEach((sub) => sub(value));
	}
	subscribe(onChange: (value: Vector2) => void) {
		this.subscribers.push(onChange);
		return () => {
			this.subscribers = this.subscribers.filter((sub) => sub !== onChange);
		};
	}
}
