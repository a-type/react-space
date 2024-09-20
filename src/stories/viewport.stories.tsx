import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { useCreateViewport, ViewportRoot } from '../viewport.js';
import { DebugLayer } from '../components/canvas/DebugLayer.js';

const meta = {
	title: 'Viewport',
	parameters: {
		layout: 'fullscreen',
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CameraControls: Story = {
	render() {
		const viewport = useCreateViewport({
			zoomLimits: {
				max: 1.5,
				min: 0.25,
			},
			defaultCenter: { x: 0, y: 0 },
			defaultZoom: 1,
			panLimits: {
				max: { x: 1000, y: 500 },
				min: { x: -1000, y: -500 },
			},
			panLimitMode: 'viewport',
		});
		return (
			<>
				<ViewportRoot className="outer" viewport={viewport}>
					<div style={{ width: 2000, height: 1000 }}>
						<img
							src="https://resources.biscuits.club/images/pashka.jpg"
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					</div>
				</ViewportRoot>
				<div style={{ position: 'absolute', top: 0, left: 0, padding: 10 }}>
					<button
						onClick={() =>
							viewport.updateConfig({
								panLimitMode:
									viewport.config.panLimitMode === 'viewport' ?
										'center'
									:	'viewport',
							})
						}
					>
						Toggle limit mode
					</button>
					<button
						onClick={() => {
							viewport.updateConfig({
								zoomLimits: {
									min: 'fit',
									max: 2,
								},
							});
						}}
					>
						Turn on fit zoom
					</button>
					<button
						onClick={() =>
							viewport.pan(
								{ x: 0, y: 0 },
								{
									origin: 'animation',
								},
							)
						}
					>
						Center
					</button>
				</div>
				<DebugLayer viewport={viewport} />
			</>
		);
	},
};

export const Unlimited: Story = {
	render() {
		const viewport = useCreateViewport({
			zoomLimits: {
				max: 1,
				min: 0.025,
			},
		});
		return (
			<ViewportRoot className="outer" viewport={viewport}>
				<div style={{ width: 5000, height: 5000 }}>
					<img
						src="https://resources.biscuits.club/images/pashka.jpg"
						style={{ width: '100%', height: '100%', objectFit: 'cover' }}
					/>
				</div>
			</ViewportRoot>
		);
	},
};

export const NonCentered: Story = {
	render() {
		const viewport = useCreateViewport({
			zoomLimits: {
				max: 1,
				min: 0.5,
			},
			panLimits: {
				min: { x: 0, y: 0 },
				max: { x: 1000, y: 1000 },
			},
		});
		return (
			<>
				<ViewportRoot
					className="outer"
					viewport={viewport}
					onClick={(ev) => {
						alert(
							`clicked ${JSON.stringify(viewport.viewportToWorld({ x: ev.clientX, y: ev.clientY }))}`,
						);
					}}
				>
					<div style={{ width: 1000, height: 1000 }}>
						<img
							src="https://resources.biscuits.club/images/pashka.jpg"
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					</div>
				</ViewportRoot>
				<DebugLayer viewport={viewport} />
			</>
		);
	},
};
