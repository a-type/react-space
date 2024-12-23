import { animated, useSpring } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';
import { Fragment, JSX, useEffect, useRef } from 'react';
import { react } from 'signia';
import { Canvas } from '../logic/Canvas.js';
import { Viewport } from '../viewport.js';
import { useObjectIds, useSurfaceEntry } from './canvas/canvasHooks.js';
import { CanvasProvider } from './canvas/CanvasProvider.js';

const ARect = animated.rect as any;

export interface MinimapProps {
	canvas: Canvas;
	className?: string;
	renderItem?: (objectId: string) => JSX.Element | null;
	canvasClassName?: string;
	viewportClassName?: string;
	surfaceClassName?: string;
	containerClassName?: string;
}

export function Minimap({
	className,
	renderItem,
	canvas,
	canvasClassName = 'mm-canvas',
	viewportClassName = 'mm-viewport',
	surfaceClassName = 'mm-surface',
	containerClassName = 'mm-container',
}: MinimapProps) {
	const viewport = canvas.viewport;

	const bind = useGesture({
		onDrag: ({ event }) => {
			event.stopPropagation();
			if ('clientX' in event) {
				const svg = event.target as SVGSVGElement;
				const point = svg.createSVGPoint();
				point.x = event.clientX;
				point.y = event.clientY;
				const cursor = point.matrixTransform(svg.getScreenCTM()?.inverse());

				viewport.pan(cursor, {
					origin: 'control',
				});
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

	const ids = useObjectIds(canvas);

	return (
		<CanvasProvider value={canvas}>
			<svg
				width="100%"
				height="100%"
				preserveAspectRatio="xMidYMid meet"
				ref={ref}
				viewBox={`${min.x} ${min.y} ${max.x - min.x} ${max.y - min.y}`}
				className={className}
				{...bind()}
			>
				<MinimapLimitsRect className={canvasClassName} canvas={canvas} />
				{ids.map((id) =>
					renderItem ?
						<Fragment key={id}>{renderItem(id)}</Fragment>
					:	<MinimapRect
							key={id}
							objectId={id}
							surfaceClassName={surfaceClassName}
							containerClassName={containerClassName}
						/>,
				)}
				<MinimapViewportRect
					className={viewportClassName}
					viewport={viewport}
				/>
			</svg>
		</CanvasProvider>
	);
}

export function MinimapRect({
	objectId,
	surfaceClassName,
	containerClassName,
	className: userClassName,
}: {
	objectId: string;
	surfaceClassName?: string;
	containerClassName?: string;
	className?: string;
}) {
	const entry = useSurfaceEntry(objectId);
	const ref = useRef<SVGRectElement>(null);

	useEffect(() => {
		if (!entry) return;

		return react('minimap rect', () => {
			const rect = ref.current;
			const bounds = entry.transform.bounds.value;
			if (!rect) return;
			rect.setAttribute('x', bounds.x.toString());
			rect.setAttribute('y', bounds.y.toString());
			rect.setAttribute('width', bounds.width.toString());
			rect.setAttribute('height', bounds.height.toString());
		});
	}, [entry]);

	let className = '';
	if (entry?.data.type === 'surface') {
		className = surfaceClassName ?? '';
	} else {
		className = containerClassName ?? '';
	}
	className += ' ' + (userClassName || '');

	return (
		<rect
			ref={ref}
			x={entry?.transform.bounds.value.x}
			y={entry?.transform.bounds.value.y}
			width={entry?.transform.bounds.value.width}
			height={entry?.transform.bounds.value.height}
			fill="transparent"
			stroke="black"
			strokeWidth={1}
			pointerEvents="none"
			className={className}
			data-object-id={objectId}
		/>
	);
}

function MinimapViewportRect({
	viewport,
	className,
}: {
	viewport: Viewport;
	className?: string;
}) {
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
		<ARect
			x={x}
			y={y}
			width={width}
			height={height}
			fill="transparent"
			stroke="black"
			strokeWidth={1}
			pointerEvents="none"
			className={className}
		/>
	);
}

function MinimapLimitsRect({
	canvas,
	className,
}: {
	canvas: Canvas;
	className?: string;
}) {
	const [{ x, y, width, height }, spring] = useSpring(() => {
		const { min, max } = canvas.limits.value;
		return {
			x: min.x,
			y: min.y,
			width: max.x - min.x,
			height: max.y - min.y,
		};
	});

	useEffect(() => {
		return react('minimap limits', () => {
			const { min, max } = canvas.limits.value;
			spring.start({
				x: min.x,
				y: min.y,
				width: max.x - min.x,
				height: max.y - min.y,
			});
		});
	}, [canvas, spring]);

	return (
		<ARect
			x={x}
			y={y}
			width={width}
			height={height}
			fill="transparent"
			stroke="black"
			strokeWidth={1}
			pointerEvents="none"
			className={className}
		/>
	);
}
