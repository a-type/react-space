import { useSpring, animated } from '@react-spring/web';
import { useCanvasGestures, useObjectGestures } from '../canvas/canvasHooks.js';
import { PointerEvent, useId, useRef } from 'react';
import { Vector2 } from '../../types.js';
import { CanvasGestureInfo, CanvasGestureInput } from '../../logic/Canvas.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import {
	claimGesture,
	GestureClaimDetail,
	gestureState,
	hasClaim,
	useClaimGesture,
} from '../gestures/useGestureState.js';
import { isLeftClick } from '@a-type/utils';

export interface BoxRegionProps {
	onPending?: (objectIds: Set<string>, info: CanvasGestureInput) => void;
	onEnd?: (objectIds: Set<string>, info: CanvasGestureInput) => void;
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

	const previousPending = useRef<Set<string>>(new Set<string>());

	const canvas = useCanvas();

	const claimProps = useClaimGesture('tool', id, filter, { onCanvas: true });

	useObjectGestures(
		{
			onDragStart: (input) => {
				previousPending.current = new Set<string>();
				originRef.current = input.pointerWorldPosition;
				spring.set({
					x: input.pointerWorldPosition.x,
					y: input.pointerWorldPosition.y,
					width: 0,
					height: 0,
				});
				claimGesture('object', id);
			},
			onDrag: (input) => {
				// TODO: build this into useCanvasGestures?
				if (!hasClaim('object', id)) {
					return;
				}

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
				// TODO: make more efficient, this is just adapting old code.
				const objectIds = new Set(entries.map((entry) => entry.id));
				// this is all just logic to diff as much as possible...
				if (objectIds.size !== previousPending.current.size) {
					onPending?.(objectIds, input);
				} else if (objectIds.size === 0) {
					if (previousPending.current.size !== 0) {
						onPending?.(objectIds, input);
					}
				} else {
					for (const entry of objectIds) {
						if (!previousPending.current.has(entry)) {
							onPending?.(objectIds, input);
							break;
						}
					}
				}

				previousPending.current = objectIds;
			},
			onDragEnd: (input) => {
				if (!hasClaim('object', id)) {
					return;
				}

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
				// TODO: make more efficient, this is just adapting old code.
				const objectIds = new Set(entries.map((entry) => entry.id));

				previousPending.current.clear();
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
