import { animated, useSpring } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';
import { Fragment, JSX, useEffect, useRef } from 'react';
import { react } from 'signia';
import {
	useObjectIds,
	useCanvasLimits,
	useObjectEntry,
} from './canvas/canvasHooks.js';
import { useViewport } from './viewport/ViewportRoot.js';
import { useCanvas } from './canvas/CanvasProvider.js';

export interface MinimapProps {
	className?: string;
	renderItem?: (objectId: string) => JSX.Element | null;
}

export function Minimap({ className, renderItem }: MinimapProps) {
	const viewport = useViewport();
	const canvas = useCanvas();

	const bind = useGesture({
		onDrag: ({ event }) => {
			event.stopPropagation();
			if ('clientX' in event) {
				const svg = event.target as SVGSVGElement;
				const point = svg.createSVGPoint();
				point.x = event.clientX;
				point.y = event.clientY;
				const cursor = point.matrixTransform(svg.getScreenCTM()?.inverse());

				viewport.pan(cursor);
			}
		},
	});

	const ref = useRef<SVGSVGElement>(null);

	useEffect(() => {
		return react('canvas minimap viewbox', () => {
			const { min, max } = canvas.limits.value;
			if (ref.current) {
				ref.current.setAttribute(
					'viewBox',
					`${min.x} ${min.y} ${max.x - min.x} ${max.y - min.y}`,
				);
			}
		});
	}, [canvas, ref]);

	const { min, max } = canvas.limits.value;

	const ids = useObjectIds();

	return (
		<div className={className}>
			<svg
				width="100%"
				height="100%"
				preserveAspectRatio="xMidYMid meet"
				ref={ref}
				viewBox={`${min.x} ${min.y} ${max.x - min.x} ${max.y - min.y}`}
				{...bind()}
			>
				{ids.map((id) =>
					renderItem ?
						<Fragment key={id}>{renderItem(id)}</Fragment>
					:	<MinimapRect key={id} objectId={id} />,
				)}
				<MinimapViewportRect />
			</svg>
		</div>
	);
}

export function MinimapRect({
	objectId,
	className,
}: {
	objectId: string;
	className?: string;
}) {
	const entry = useObjectEntry(objectId);
	const ref = useRef<SVGRectElement>(null);

	useEffect(() => {
		const rect = ref.current;
		if (!rect || !entry) return;

		return react('minimap rect', () => {
			rect.x.baseVal.value = entry.transform.worldOrigin.value.x;
			rect.y.baseVal.value = entry.transform.worldOrigin.value.y;
			rect.width.baseVal.value = entry.transform.size.value.width;
			rect.height.baseVal.value = entry.transform.size.value.height;
		});
	}, [entry]);

	return (
		<rect
			x={entry?.transform.worldOrigin.value.x}
			y={entry?.transform.worldOrigin.value.y}
			width={entry?.transform.size.value.width}
			height={entry?.transform.size.value.height}
			fill="transparent"
			stroke="black"
			strokeWidth={1}
			pointerEvents="none"
			className={className}
		/>
	);
}

function MinimapViewportRect() {
	const viewport = useViewport();
	const [{ x, y, width, height }, spring] = useSpring(() => ({
		x: viewport.topLeft.x,
		y: viewport.topLeft.y,
		width: viewport.size.width,
		height: viewport.size.height,
	}));

	useEffect(() => {
		function update() {
			spring.start({
				x: viewport.topLeft.x,
				y: viewport.topLeft.y,
				width: viewport.size.width,
				height: viewport.size.height,
			});
		}
		const unsubs = [
			viewport.subscribe('centerChanged', update),
			viewport.subscribe('sizeChanged', update),
			viewport.subscribe('zoomChanged', update),
		];
		return () => {
			unsubs.forEach((unsub) => unsub());
		};
	}, [viewport, spring]);

	return (
		<animated.rect
			x={x}
			y={y}
			width={width}
			height={height}
			fill="transparent"
			stroke="black"
			strokeWidth={1}
			pointerEvents="none"
		/>
	);
}
