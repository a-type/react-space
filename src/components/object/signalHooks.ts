import { useEffect, useRef } from 'react';
import { react, Signal } from 'signia';
import { Vector2 } from '../../types.js';

export function useLiveElementPosition<TElement extends HTMLElement>(
	position: Signal<Vector2> | undefined,
) {
	const ref = useRef<TElement>(null);
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

	const style: any = {
		position: 'absolute',
		transform: 'translate(var(--x), var(--y))',
		'--x': position ? position.value.x + 'px' : '0px',
		'--y': position ? position.value.y + 'px' : '0px',
	};

	return {
		style,
		ref,
	};
}
