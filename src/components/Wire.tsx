import { animated, to } from '@react-spring/web';
import { CSSProperties, SVGProps, useEffect, useMemo, useState } from 'react';
import { LiveVector2 } from '../types.js';
import { useGesture } from '@use-gesture/react';
import { getWireBezierForEndPoints } from '../logic/math.js';
import { useViewport } from './ViewportRoot.jsx';
import { useRegister } from './canvasHooks.js';
import { useCanvas } from './CanvasProvider.jsx';
import { CanvasGestureInfo } from '../logic/Canvas.js';

export interface WireProps extends Omit<SVGProps<SVGPathElement>, 'ref'> {
	sourcePosition: LiveVector2;
	targetPosition: LiveVector2;
	className?: string;
	interactiveClassName?: string;
	onTap?: (info: CanvasGestureInfo) => void;
	id: string;
	metadata?: any;
}

const baseInteractiveStyle: CSSProperties = {
	touchAction: 'none',
	contentVisibility: 'auto',
};
const baseVisualStyle: CSSProperties = {
	pointerEvents: 'none',
	contentVisibility: 'auto',
};

export function Wire({
	sourcePosition,
	targetPosition,
	className,
	interactiveClassName,
	onTap,
	id,
	metadata,
	...rest
}: WireProps) {
	const viewport = useViewport();
	const [hovered, setHovered] = useState(false);
	const bind = useGesture(
		{
			onHover: ({ hovering }) => {
				setHovered(!!hovering);
			},
			onDragStart: (state) => {
				state.event.stopPropagation();
				state.event.preventDefault();
			},
			onDrag: (state) => {
				state.event.stopPropagation();
				state.event.preventDefault();
			},
			onDragEnd: (state) => {
				if (state.tap) {
					const worldPos = viewport.viewportToWorld({
						x: state.xy[0],
						y: state.xy[1],
					});

					state.event.preventDefault();
					state.event.stopPropagation();
					onTap?.({
						shift: state.shiftKey,
						ctrlOrMeta: state.ctrlKey || state.metaKey,
						alt: state.altKey,
						delta: viewport.viewportDeltaToWorld({
							x: state.delta[0],
							y: state.delta[1],
						}),
						worldPosition: worldPos,
						intentional: state.intentional,
						targetId: id,
					});
				}
			},
		},
		{
			eventOptions: { passive: false },
		},
	);

	const curve = to(
		[sourcePosition.x, sourcePosition.y, targetPosition.x, targetPosition.y],
		(startX, startY, endX, endY) => {
			const { control1, control2 } = getWireBezierForEndPoints(
				startX,
				startY,
				endX,
				endY,
			);

			return `M ${startX} ${startY} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${endX} ${endY}`;
		},
	);

	const register = useRegister(id, metadata);
	const canvas = useCanvas();
	// register position as smallest of x,y values - i.e. top left
	useEffect(() => {
		return canvas.bounds.registerOrigin(id, {
			x: to([sourcePosition.x, targetPosition.x], Math.min),
			y: to([sourcePosition.y, targetPosition.y], Math.min),
		});
	}, [canvas, id, sourcePosition, targetPosition]);

	const interactiveStyle = useMemo(
		() => ({
			...baseInteractiveStyle,
			cursor: onTap ? 'pointer' : 'default',
		}),
		[!!onTap],
	);

	return (
		<>
			{/* invisible path for interaction boundaries */}
			<animated.path
				{...bind()}
				d={curve}
				strokeWidth="20"
				fill="none"
				opacity="50%"
				className={interactiveClassName}
				style={interactiveStyle}
				ref={register}
			/>
			<animated.path
				id={id}
				d={curve}
				fill="none"
				className={className}
				style={baseVisualStyle}
				data-hovered={hovered}
				{...rest}
			/>
		</>
	);
}
