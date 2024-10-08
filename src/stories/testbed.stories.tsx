import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { useCallback } from 'react';
import {
	BoxSelect,
	CanvasRoot,
	CanvasSvgLayer,
	CanvasBackground,
	ContainerRoot,
	DebugLayer,
	SurfaceRoot,
	SurfaceHandle,
	SurfacePickupEffect,
	useCreateSurface,
	useCreateContainer,
	useContainerSurfacesOver,
	Size,
	useCanvas,
	useCreateCanvas,
	useCreateViewport,
	useIsSelected,
	Vector2,
	ViewportRoot,
	Minimap,
} from '../index.js';
import clsx from 'clsx';

const meta = {
	title: 'Testbed',
	parameters: {
		layout: 'fullscreen',
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const canvasGestureLogs = {
	onTap: () => console.log('canvas tap'),
	onDrag: () => console.log('canvas drag'),
	onDragEnd: () => console.log('canvas drag end'),
};

export const KitchenSink: Story = {
	render() {
		const [debug, setDebug] = React.useState(false);
		const viewport = useCreateViewport({
			zoomLimits: {
				max: 3,
				min: 'fit',
			},
			defaultCenter: { x: 0, y: 0 },
			defaultZoom: 1,
			panLimitMode: 'viewport',
		});
		const canvas = useCreateCanvas({
			limits: {
				max: { x: 500, y: 500 },
				min: { x: -500, y: -500 },
			},
			viewport,
		});
		// @ts-ignore
		window.canvas = canvas;
		return (
			<>
				<ViewportRoot className="outer" viewport={viewport}>
					<CanvasRoot canvas={canvas} {...canvasGestureLogs}>
						<CanvasBackground className="background" />
						<Container id="container" priority={0} position={{ x: 0, y: 0 }} />
						<Container
							id="container2"
							priority={1}
							position={{ x: 40, y: 40 }}
						/>
						<Container
							id="container3"
							priority={2}
							position={{ x: -200, y: 100 }}
						/>
						<MovableContainer
							id="movable-1"
							priority={3}
							position={{ x: 200, y: 200 }}
						/>
						<MovableContainer
							id="movable-2"
							priority={4}
							position={{ x: -200, y: -200 }}
						/>
						<DemoNode id="1" initialPosition={{ x: 10, y: 30 }} />
						<DemoNode id="2" initialPosition={{ x: 100, y: 100 }}>
							<button
								style={{ margin: 'auto' }}
								onClick={() => alert('clicked')}
							>
								Click me
							</button>
						</DemoNode>
						<DemoNode
							id="4"
							initialPosition={{ x: 0, y: 0 }}
							size={32}
							getOrigin={(pos, size) => ({
								x: pos.x - size.width / 2,
								y: pos.y - size.height / 2,
							})}
						/>
						<AutonomousNode
							id="auto-1"
							initialPosition={{ x: 0, y: 0 }}
							size={32}
						/>
						<CanvasSvgLayer id="selection">
							<BoxSelect className="box-select" />
						</CanvasSvgLayer>
					</CanvasRoot>
				</ViewportRoot>
				<Minimap canvas={canvas} className="minimap" />
				{debug && <DebugLayer canvas={canvas} />}
				<div className="controls">
					<button onClick={() => canvas.resizeToFitContent(24)}>
						Fit content
					</button>
					<button onClick={() => setDebug((d) => !d)}>Toggle debug</button>
				</div>
			</>
		);
	},
};

function DemoNode({
	id,
	initialPosition,
	size,
	getOrigin,
	children,
}: {
	id: string;
	initialPosition: Vector2;
	size?: number;
	getOrigin?: (position: Vector2, size: Size) => Vector2;
	children?: React.ReactNode;
}) {
	const canvasSurface = useCreateSurface({
		id,
		initialTransform: {
			position: initialPosition,
			getOrigin,
			size: size ? { width: size, height: size } : undefined,
		},
		// demonstrate callbacks can be added without interefering with
		// inherent gesture behavior
		onDrag: () => {
			// too noisy to log here
		},
		onTap: () => {
			console.log('tap on', id);
		},
		onDrop: (event, self) => {
			console.log('drop on', event.containerId ?? 'canvas', event.position);
		},
	});

	const canvas = useCanvas();
	const zoomToFit = useCallback(() => {
		const box = canvas.bounds.getCurrentBounds(id);
		if (!box) return;
		canvas.viewport.fitOnScreen(box, {
			origin: 'control',
		});
	}, [canvas, id]);

	const { selected, pending } = useIsSelected(id);

	return (
		<SurfaceRoot
			className="node"
			surface={canvasSurface}
			onDoubleClick={zoomToFit}
		>
			<SurfaceHandle
				asChild
				className={clsx('handle', selected && 'selected', pending && 'pending')}
				style={{
					width: size,
					height: size,
				}}
			>
				<SurfacePickupEffect>{children}</SurfacePickupEffect>
			</SurfaceHandle>
		</SurfaceRoot>
	);
}

function AutonomousNode({
	id,
	initialPosition,
	size,
	children,
}: {
	id: string;
	initialPosition: Vector2;
	size: number;
	children?: React.ReactNode;
}) {
	const canvasSurface = useCreateSurface({
		id,
		initialTransform: {
			position: initialPosition,
			size: { width: size, height: size },
		},
		disableSelect: true,
	});

	React.useEffect(() => {
		const interval = setInterval(() => {
			canvasSurface.update({
				position: {
					x: initialPosition.x + Math.random() * 200 - 100,
					y: initialPosition.y + Math.random() * 200 - 100,
				},
			});
		}, 5000);
		return () => {
			clearInterval(interval);
		};
	}, [canvasSurface.update, initialPosition]);

	return (
		<SurfaceRoot className="node" surface={canvasSurface}>
			<SurfaceHandle className="handle" style={{ width: size, height: size }}>
				{children}
			</SurfaceHandle>
		</SurfaceRoot>
	);
}

function Container({
	id,
	priority,
	position,
}: {
	id: string;
	priority: number;
	position: Vector2;
}) {
	const container = useCreateContainer({
		id,
		accept: (event) => event.surfaceId === '1',
		priority,
	});
	const overSurfaces = useContainerSurfacesOver(container);
	const canDrop = overSurfaces.some((o) => o.accepted);

	return (
		<ContainerRoot
			container={container}
			className={clsx('container', { dance: canDrop })}
			data-object-over={!!overSurfaces.length}
			data-object-accepted={canDrop}
			style={{
				position: 'absolute',
				left: position.x,
				top: position.y,
			}}
		/>
	);
}

function MovableContainer({
	id,
	priority,
	position: initialPosition,
}: {
	id: string;
	priority: number;
	position: Vector2;
}) {
	const canvasSurface = useCreateSurface({
		id,
		initialTransform: {
			position: initialPosition,
		},
		onDrop: (event, self) => {
			console.log('drop on', event.containerId ?? 'canvas', event.position);
		},
	});
	const container = useCreateContainer({
		id: `container-${id}`,
		priority,
	});
	const overSurfaces = useContainerSurfacesOver(container);
	const canDrop = overSurfaces.some((o) => o.accepted);

	const { selected, pending } = useIsSelected(id);

	return (
		<SurfaceRoot
			className={clsx('containerFrame', { selected, pending, dance: canDrop })}
			surface={canvasSurface}
		>
			<SurfaceHandle className="containerFrameHandle" />
			<ContainerRoot
				container={container}
				className="container"
				data-object-over={!!overSurfaces.length}
				data-object-accepted={canDrop}
				style={{
					width: 200,
					height: 200,
				}}
			/>
		</SurfaceRoot>
	);
}
