import { useEffect, useRef } from 'react';
import { react, Signal } from 'signia';
import { Vector2 } from '../../types.js';
import { useSpring } from '@react-spring/web';
import { SPRINGS } from '../../constants.js';

export function useLiveElementPosition<TElement extends HTMLElement>(
	position: Signal<Vector2> | undefined,
	immediateSignal?: Signal<boolean>,
) {
	const ref = useRef<TElement>(null);

	const [spring, springApi] = useSpring(() => ({
		x: position?.value.x ?? 0,
		y: position?.value.y ?? 0,
		config: SPRINGS.QUICK,
	}));

	useEffect(() => {
		if (!position) return;
		return react('live element position', () => {
			const { x, y } = position.value;
			const element = ref.current;
			const immediate = immediateSignal?.value;
			if (!element) return;
			element.style.setProperty('--x', `${x}px`);
			element.style.setProperty('--y', `${y}px`);
			springApi.start({
				x,
				y,
				immediate,
			});
		});
	}, [position, immediateSignal, ref, springApi]);

	const style: any = {
		position: 'absolute',
		x: spring.x,
		y: spring.y,
		'--x': position ? position.value.x + 'px' : '0px',
		'--y': position ? position.value.y + 'px' : '0px',
	};

	return {
		style,
		ref,
	};
}
