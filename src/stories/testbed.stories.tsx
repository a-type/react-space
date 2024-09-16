import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { useCallback } from 'react';
import {
	useContainerObjectsOver,
	useCreateContainer,
} from '../components/container/containerHooks.js';
import { useCreateObject } from '../components/object/useCreateObject.js';
import {
	BoxSelect,
	CanvasOverlay,
	CanvasRoot,
	CanvasSvgLayer,
	CanvasWallpaper,
	ContainerArea,
	DebugLayer,
	Minimap,
	NonDraggable,
	Object,
	ObjectHandle,
	Size,
	useCanvas,
	useCreateCanvas,
	useCreateViewport,
	useIsSelected,
	Vector2,
	ViewportRoot,
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
						<CanvasWallpaper className="background" />
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
						<CanvasSvgLayer id="selection">
							<BoxSelect className="box-select" />
						</CanvasSvgLayer>
					</CanvasRoot>
					{/* <CanvasOverlay>
						<Minimap canvas={canvas} />
					</CanvasOverlay> */}
				</ViewportRoot>
				<DebugLayer canvas={canvas} />
				<div className="controls">
					<button onClick={() => canvas.resizeToFitContent(24)}>
						Fit content
					</button>
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
	const [container, setContainer] = React.useState<string | null>(null);
	const [position, setPosition] = React.useState(() => initialPosition);

	const canvasObject = useCreateObject({
		id,
		initialPosition: position,
		containerId: container,
		getOrigin,
		onDrop: (event) => {
			setContainer(event.containerId ?? null);
			setPosition(event.position);
			console.log('drop on', event.containerId ?? 'canvas', event.position);
		},
		onTap: (event) => {
			if (event.shift || event.ctrlOrMeta) {
				canvas.selections.add(id);
			} else {
				canvas.selections.set([id]);
			}
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
		<Object className="node" value={canvasObject} onDoubleClick={zoomToFit}>
			<ObjectHandle
				className={clsx('handle', selected && 'selected', pending && 'pending')}
				style={{
					width: size,
					height: size,
				}}
			>
				{children}
			</ObjectHandle>
		</Object>
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
		accept: (event) => event.objectId === '1',
		priority,
	});
	const overObjects = useContainerObjectsOver(container);

	return (
		<ContainerArea
			value={container}
			className="container"
			data-object-over={!!overObjects.length}
			data-object-accepted={overObjects.some((o) => o.accepted)}
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
	const [parentContainer, setParentContainer] = React.useState<string | null>(
		null,
	);
	const [position, setPosition] = React.useState(() => initialPosition);

	const canvasObject = useCreateObject({
		id,
		initialPosition: position,
		containerId: parentContainer,
		onDrag: (event) => {},
		onDrop: (event) => {
			setParentContainer(event.containerId ?? null);
			setPosition(event.position);
			console.log(
				'drop on',
				event.containerId ?? 'canvas',
				event.worldPosition,
			);
		},
	});
	const container = useCreateContainer({
		id: `container-${id}`,
		priority,
	});
	const overObjects = useContainerObjectsOver(container);

	const { selected, pending } = useIsSelected(id);

	return (
		<Object
			className={clsx('containerFrame', { selected, pending })}
			value={canvasObject}
		>
			<ObjectHandle className="containerFrameHandle" />
			<ContainerArea
				value={container}
				className="container"
				data-object-over={!!overObjects.length}
				data-object-accepted={overObjects.some((o) => o.accepted)}
				style={{
					width: 200,
					height: 200,
				}}
			/>
		</Object>
	);
}
