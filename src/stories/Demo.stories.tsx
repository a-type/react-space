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
	const canvasObject = useCanvasObject({
		initialPosition,
		objectId: id,
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
