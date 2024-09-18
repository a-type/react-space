import { HTMLAttributes } from 'react';
import { useSurface } from './SurfaceRoot.js';
import { useSpring, animated } from '@react-spring/web';
import { useValue } from 'signia-react';
import { SPRINGS } from '../../constants.js';

export interface SurfacePickupEffectProps
	extends HTMLAttributes<HTMLDivElement> {}

export function SurfacePickupEffect({
	style,
	...rest
}: SurfacePickupEffectProps) {
	const surface = useSurface();
	// by using this signal which fires a little after actual drop,
	// we can preserve visual continuity during a reparent / element
	// rebuild upon container change.
	const dragging = useValue(surface.blockInteractionSignal);
	const pickupSpring = useSpring({
		scale: dragging ? 1.1 : 1,
		config: SPRINGS.WOBBLY,
	});

	return (
		<animated.div
			style={{
				...style,
				scale: pickupSpring.scale,
				boxShadow: pickupSpring.scale.to((v) =>
					v === 1 ? `0 0 0 0 transparent` : (
						`0 ${v * 3}px ${v * 10}px 0 rgba(0, 0, 0, 0.15)`
					),
				),
			}}
			{...rest}
		/>
	);
}
