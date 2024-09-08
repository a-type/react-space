import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
	CanvasObjectDragHandle,
	CanvasObject,
	CanvasProvider,
	CanvasRenderer,
	CanvasSvgLayer,
	CanvasWallpaper,
	useCanvasObject,
	useClosestLiveObjectBoundaryPosition,
	useCreateCanvas,
	useLiveObjectCenter,
	Vector2,
	ViewportRoot,
	Wire,
	CanvasObjectRoot,
	useCanvas,
	ZERO_CENTER,
	useContainerCandidate,
} from '../index.js';
import { useCallback } from 'react';
import { animated, to } from '@react-spring/web';

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
						<CanvasSvgLayer id="wires">
							<NodeWire from="1" to="2" />
						</CanvasSvgLayer>
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
	const canvasObject = useCanvasObject({
		initialPosition,
		objectId: id,
		containerId: container,
		onDrop: (event) => {
			if (event.info.containerId) {
				setContainer(event.info.containerId);
				canvasObject.moveTo(event.containerPosition!);
			}
		},
	});
	const canvas = useCanvas();
	const zoomToFit = useCallback(() => {
		canvas.zoomToFit(id);
	}, [canvas, id]);
	const livePosition = useLiveObjectCenter(id) ?? ZERO_CENTER;
	return (
		<CanvasObjectRoot
			className="node"
			canvasObject={canvasObject}
			onDoubleClick={zoomToFit}
		>
			<CanvasObjectDragHandle className="handle" />
			<animated.div>
				{to([livePosition.x, livePosition.y], (x, y) => `(${x}, ${y})`)}
			</animated.div>
		</CanvasObjectRoot>
	);
}

function NodeWire({ from, to }: { from: string; to: string }) {
	const fromCenter = useLiveObjectCenter(from);
	const toCenter = useLiveObjectCenter(to);
	const fromPos = useClosestLiveObjectBoundaryPosition(from, toCenter);
	const toPos = useClosestLiveObjectBoundaryPosition(to, fromCenter);

	return (
		<Wire
			id={`${from}->${to}`}
			sourcePosition={fromPos}
			targetPosition={toPos}
			className="wire"
		/>
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
	const canvasObject = useCanvasObject({
		objectId: id,
		initialPosition,
		canContain: (event) => event.objectId === '1',
		containerPriority: priority,
	});
	const isCandidate = useContainerCandidate(id);
	return (
		<CanvasObjectRoot
			className="container"
			canvasObject={canvasObject}
			style={{
				width: 100,
				height: 100,
				border: '1px solid black',
				background:
					isCandidate ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)',
			}}
		/>
	);
}
