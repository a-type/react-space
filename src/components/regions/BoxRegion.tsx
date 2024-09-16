import { useSpring, animated } from '@react-spring/web';
import { useCanvasGestures } from '../canvas/canvasHooks.js';
import { useId, useRef } from 'react';
import { Vector2 } from '../../types.js';
import { CanvasGestureInfo } from '../../logic/Canvas.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import {
	claimGesture,
	gestureState,
	hasClaim,
} from '../gestures/useGestureState.js';

export interface BoxRegionProps {
	onPending?: (objectIds: Set<string>, info: CanvasGestureInfo) => void;
	onEnd?: (objectIds: Set<string>, info: CanvasGestureInfo) => void;
	tolerance?: number;
	className?: string;
	id?: string;
	filter?: (info: CanvasGestureInfo) => boolean;
}

const defaultFilter = (info: CanvasGestureInfo) => {
	return info.inputType === 'mouse1' || info.inputType === 'touch';
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

	useCanvasGestures({
		onDragStart: (info) => {
			if (!filter(info)) {
				return;
			}

			previousPending.current = new Set<string>();
			originRef.current = info.worldPosition;
			spring.set({
				x: info.worldPosition.x,
				y: info.worldPosition.y,
				width: 0,
				height: 0,
			});
			claimGesture('region', id);
		},
		onDrag: (info) => {
			// TODO: build this into useCanvasGestures?
			if (!hasClaim('region', id)) {
				return;
			}

			const rect = {
				x: Math.min(info.worldPosition.x, originRef.current.x),
				y: Math.min(info.worldPosition.y, originRef.current.y),
				width: Math.abs(info.worldPosition.x - originRef.current.x),
				height: Math.abs(info.worldPosition.y - originRef.current.y),
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
				onPending?.(objectIds, info);
			} else if (objectIds.size === 0) {
				if (previousPending.current.size !== 0) {
					onPending?.(objectIds, info);
				}
			} else {
				for (const entry of objectIds) {
					if (!previousPending.current.has(entry)) {
						onPending?.(objectIds, info);
						break;
					}
				}
			}

			previousPending.current = objectIds;
		},
		onDragEnd: (info) => {
			if (!hasClaim('region', id)) {
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
			onPending?.(previousPending.current, info);
			onCommit?.(objectIds, info);

			spring.set({ x: 0, y: 0, width: 0, height: 0 });
			originRef.current.x = 0;
			originRef.current.y = 0;
		},
	});

	return (
		<animated.rect
			x={x}
			y={y}
			width={width}
			height={height}
			className={className}
		/>
	);
}
