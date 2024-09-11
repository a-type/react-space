import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { useCallback } from 'react';
import { useCreateObject } from '../components/object/useCreateObject.js';
import {
	CanvasProvider,
	CanvasRenderer,
	CanvasWallpaper,
	DebugLayer,
	Object,
	ObjectContainer,
	ObjectHandle,
	useCanvas,
	useCreateCanvas,
	Vector2,
	VectorState,
	ViewportRoot,
} from '../index.js';

const meta = {
	title: 'Demo',
	parameters: {
		layout: 'fullscreen',
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const KitchenSink: Story = {
	render() {
		const canvas = useCreateCanvas({
			limits: {
				max: { x: 500, y: 500 },
				min: { x: -500, y: -500 },
			},
			viewportConfig: {
				zoomLimits: {
					max: 1.5,
					min: 0.25,
				},
				defaultCenter: { x: 0, y: 0 },
				defaultZoom: 1,
			},
			positionSnapIncrement: 24,
		});
		// @ts-ignore
		window.canvas = canvas;
		return (
			<CanvasProvider value={canvas}>
				<ViewportRoot className="outer">
					<CanvasRenderer>
						<CanvasWallpaper className="background" />
						<Container
							id="container"
							priority={0}
							initialPosition={{ x: 0, y: 0 }}
						/>
						<Container
							id="container2"
							priority={1}
							initialPosition={{ x: 20, y: 20 }}
						/>
						<DemoNode id="1" initialPosition={{ x: 10, y: 30 }} />
						<DemoNode id="2" initialPosition={{ x: 100, y: 100 }} />
						<DebugLayer />
					</CanvasRenderer>
				</ViewportRoot>
			</CanvasProvider>
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
		canvas.zoomToFit(id);
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
	initialPosition,
}: {
	id: string;
	priority: number;
	initialPosition: Vector2;
}) {
	const canvasObject = useCreateObject({
		id,
		initialPosition,
	});

	return (
		<Object className="container" value={canvasObject}>
			<ObjectContainer
				accept={(event) => event.objectId === '1'}
				priority={priority}
				style={{ width: '100%', height: '100%' }}
			/>
		</Object>
	);
}
