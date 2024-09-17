import { animated, useSpring } from '@react-spring/web';
import { useId, useRef } from 'react';
import { CanvasGestureInput } from '../../logic/Canvas.js';
import { Vector2 } from '../../types.js';
import { useClaimedGestures } from '../canvas/canvasHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import {
	claimGesture,
	GestureClaimDetail,
	hasClaim,
	useClaimGesture,
} from '../gestures/useGestureState.js';

export interface BoxRegionProps {
	onPending?: (objectIds: Array<string>, info: CanvasGestureInput) => void;
	onEnd?: (objectIds: Array<string>, info: CanvasGestureInput) => void;
	tolerance?: number;
	className?: string;
	id?: string;
	filter?: (event: GestureClaimDetail) => boolean;
}

const defaultFilter = (event: GestureClaimDetail) => {
	return event.isLeftMouse || event.isTouch;
};

export function BoxRegion({
	tolerance = 0.5,
	onPending,
	onEnd: onCommit,
	className,
	id: userId,
	filter = defaultFilter,
}: BoxRegionProps) {
	const generatedId = useId();
	const id = userId ?? generatedId;
	const [{ x, y, width, height }, spring] = useSpring(() => ({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	}));
	const originRef = useRef<Vector2>({ x: 0, y: 0 });

	const previousPending = useRef<Array<string>>(new Array<string>());

	const canvas = useCanvas();

	const claimProps = useClaimGesture('tool', id, filter, { onCanvas: true });

	useClaimedGestures(
		{
			onDragStart: (input) => {
				previousPending.current.length = 0;
				originRef.current = input.pointerWorldPosition;
				spring.set({
					x: input.pointerWorldPosition.x,
					y: input.pointerWorldPosition.y,
					width: 0,
					height: 0,
				});
			},
			onDrag: (input) => {
				const rect = {
					x: Math.min(input.pointerWorldPosition.x, originRef.current.x),
					y: Math.min(input.pointerWorldPosition.y, originRef.current.y),
					width: Math.abs(input.pointerWorldPosition.x - originRef.current.x),
					height: Math.abs(input.pointerWorldPosition.y - originRef.current.y),
				};
				spring.set(rect);
				const entries = canvas.bounds.getIntersections(
					rect,
					tolerance,
					(data) => data.type === 'object',
				);
				const objectIds = entries.map((entry) => entry.id);
				// this is all just logic to diff as much as possible...
				if (objectIds.length !== previousPending.current.length) {
					onPending?.(objectIds, input);
				} else if (objectIds.length === 0) {
					if (previousPending.current.length !== 0) {
						onPending?.(objectIds, input);
					}
				} else {
					for (const entry of objectIds) {
						if (!previousPending.current.includes(entry)) {
							onPending?.(objectIds, input);
							break;
						}
					}
				}

				previousPending.current = objectIds;
			},
			onDragEnd: (input) => {
				const entries = canvas.bounds.getIntersections(
					{
						x: x.get(),
						y: y.get(),
						width: width.get(),
						height: height.get(),
					},
					tolerance,
					(data) => data.type === 'object',
				);
				const objectIds = entries.map((entry) => entry.id);

				previousPending.current.length = 0;
				onPending?.(previousPending.current, input);
				onCommit?.(objectIds, input);

				spring.set({ x: 0, y: 0, width: 0, height: 0 });
				originRef.current.x = 0;
				originRef.current.y = 0;
			},
		},
		id,
	);

	return (
		<animated.rect
			x={x}
			y={y}
			width={width}
			height={height}
			className={className}
			{...claimProps}
		/>
	);
}
