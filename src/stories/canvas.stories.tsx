import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { useCallback } from 'react';
import {
	useContainerOverObject,
	useCreateContainer,
} from '../components/container/containerHooks.js';
import { useCreateObject } from '../components/object/useCreateObject.js';
import {
	CanvasRoot,
	CanvasWallpaper,
	ContainerArea,
	DebugLayer,
	Object,
	ObjectHandle,
	useCanvas,
	useCreateCanvas,
	useCreateViewport,
	Vector2,
	ViewportRoot,
} from '../index.js';

const meta = {
	title: 'Canvas',
	parameters: {
		layout: 'fullscreen',
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const KitchenSink: Story = {
	render() {
		const viewport = useCreateViewport({
			zoomLimits: {
				max: 1.5,
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
			positionSnapIncrement: 24,
		});
		// @ts-ignore
		window.canvas = canvas;
		return (
			<>
				<ViewportRoot className="outer" viewport={viewport}>
					<CanvasRoot canvas={canvas}>
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
						<DemoNode id="1" initialPosition={{ x: 10, y: 30 }} />
						<DemoNode id="2" initialPosition={{ x: 100, y: 100 }} />
						<MovableContainer
							id="3"
							priority={3}
							position={{ x: 200, y: 200 }}
						/>
					</CanvasRoot>
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
}: {
	id: string;
	initialPosition: Vector2;
}) {
	const [container, setContainer] = React.useState<string | null>(null);
	const [position, setPosition] = React.useState(() => initialPosition);

	const canvasObject = useCreateObject({
		id,
		initialPosition: position,
		containerId: container,
		onDrag: (event) => {},
		onDrop: (event) => {
			if (event.container) {
				setContainer(event.container.id);
				setPosition(event.container.relativePosition);
				console.log(
					'drop on container',
					event.worldPosition,
					event.container.relativePosition,
				);
			} else {
				setContainer(null);
				setPosition(event.worldPosition);
				console.log('drop on canvas', event.worldPosition);
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

	return (
		<Object className="node" value={canvasObject} onDoubleClick={zoomToFit}>
			<ObjectHandle className="handle" />
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
	const overId = useContainerOverObject(container);

	return (
		<ContainerArea
			value={container}
			className="container"
			style={{
				position: 'absolute',
				left: position.x,
				top: position.y,
				borderColor: overId ? 'green' : 'black',
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
			if (event.container) {
				setParentContainer(event.container.id);
				setPosition(event.container.relativePosition);
				console.log(
					'drop on container',
					event.worldPosition,
					event.container.relativePosition,
				);
			} else {
				setParentContainer(null);
				setPosition(event.worldPosition);
				console.log('drop on canvas', event.worldPosition);
			}
		},
	});
	const container = useCreateContainer({
		id: `container-${id}`,
		accept: (event) => event.objectId === '2',
		priority,
	});
	const overId = useContainerOverObject(container);

	return (
		<Object className="containerFrame" value={canvasObject}>
			<ObjectHandle className="containerFrameHandle" />
			<ContainerArea
				value={container}
				className="container"
				data-object-over={!!overId}
				style={{
					width: 200,
					height: 200,
				}}
			/>
		</Object>
	);
}
