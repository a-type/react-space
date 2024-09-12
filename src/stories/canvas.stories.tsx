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
	VectorState,
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
				min: 0.25,
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
						<DemoNode id="1" initialPosition={{ x: 10, y: 30 }} />
						<DemoNode id="2" initialPosition={{ x: 100, y: 100 }} />
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
	const [position] = React.useState(() => new VectorState(initialPosition));

	const canvasObject = useCreateObject({
		id,
		initialPosition,
		containerId: container,
		onDrag: (event) => {
			position.set(event.worldPosition);
		},
		onDrop: (event) => {
			console.log('drop', id, event);
			if (event.container) {
				setContainer(event.container.id);
				position.set(event.container.relativePosition);
			} else {
				setContainer(null);
				position.set(event.worldPosition);
			}
		},
	});

	React.useEffect(() => position.subscribe(canvasObject.move), [position]);

	const canvas = useCanvas();
	const zoomToFit = useCallback(() => {
		const box = canvas.objects.getCurrentBounds(id);
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
				borderColor: overId ? 'green' : 'red',
			}}
		/>
	);
}