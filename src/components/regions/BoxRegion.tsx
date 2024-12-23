import { animated, useSpring } from '@react-spring/web';
import { useId, useRef } from 'react';
import { BoundsRegistryEntry } from '../../logic/BoundsRegistry.js';
import {
	CanvasGestureInput,
	ContainerData,
	SurfaceData,
} from '../../logic/Canvas.js';
import { Vector2 } from '../../types.js';
import { useClaimedGestures } from '../canvas/canvasHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import {
	GestureClaimDetail,
	useClaimGesture,
} from '../gestures/useGestureState.js';

const ARect = animated.rect as any;

export interface BoxRegionProps {
	onPending?: (surfaceIds: Array<string>, info: CanvasGestureInput) => void;
	onEnd?: (surfaceIds: Array<string>, info: CanvasGestureInput) => void;
	tolerance?: number;
	className?: string;
	id?: string;
	claimGesture?: (event: GestureClaimDetail) => boolean;
	filter?: BoxRegionFilterFn;
}

export type BoxRegionFilterFn = (
	entry: BoundsRegistryEntry<SurfaceData<any> | ContainerData<any>>,
) => boolean;

const defaultClaim = (event: GestureClaimDetail) => {
	return event.isLeftMouse || event.isTouch;
};

export function BoxRegion({
	tolerance = 0.5,
	onPending,
	onEnd: onCommit,
	className,
	id: userId,
	claimGesture: claim = defaultClaim,
	filter,
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

	const claimProps = useClaimGesture('tool', id, claim, { onCanvas: true });

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
				let entries = canvas.bounds.getIntersections(
					rect,
					tolerance,
					(data) => data.type === 'surface',
				);
				if (filter) {
					entries = entries.filter(filter);
				}
				const surfaceIds = entries.map((entry) => entry.id);
				// this is all just logic to diff as much as possible...
				if (surfaceIds.length !== previousPending.current.length) {
					onPending?.(surfaceIds, input);
				} else if (surfaceIds.length === 0) {
					if (previousPending.current.length !== 0) {
						onPending?.(surfaceIds, input);
					}
				} else {
					for (const entry of surfaceIds) {
						if (!previousPending.current.includes(entry)) {
							onPending?.(surfaceIds, input);
							break;
						}
					}
				}

				previousPending.current = surfaceIds;
			},
			onDragEnd: (input) => {
				let entries = canvas.bounds.getIntersections(
					{
						x: x.get(),
						y: y.get(),
						width: width.get(),
						height: height.get(),
					},
					tolerance,
					(data) => data.type === 'surface',
				);
				if (filter) {
					entries = entries.filter(filter);
				}
				const surfaceIds = entries.map((entry) => entry.id);

				previousPending.current.length = 0;
				onPending?.(previousPending.current, input);
				onCommit?.(surfaceIds, input);

				spring.set({ x: 0, y: 0, width: 0, height: 0 });
				originRef.current.x = 0;
				originRef.current.y = 0;
			},
		},
		id,
	);

	return (
		<ARect
			x={x}
			y={y}
			width={width}
			height={height}
			className={className}
			{...claimProps}
		/>
	);
}
