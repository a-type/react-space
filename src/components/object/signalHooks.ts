import { RefObject, useEffect } from 'react';
import { react, Signal } from 'signia';
import { Vector2 } from '../../types.js';

export function useLiveElementPosition(
	ref: RefObject<HTMLElement | null>,
	position: Signal<Vector2> | undefined,
) {
	useEffect(() => {
		if (!position) return;
		return react('live element position', () => {
			const { x, y } = position.value;
			const element = ref.current;
			if (!element) return;
			element.style.setProperty('--x', `${x}px`);
			element.style.setProperty('--y', `${y}px`);
		});
	}, [position, ref]);
}
