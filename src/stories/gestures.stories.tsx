import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useCreateViewport, ViewportRoot } from '../viewport';
import { CanvasRoot } from '../components/canvas/CanvasRoot';
import { useCreateCanvas } from '../components/canvas/CanvasProvider';
import { CanvasBackground } from '../components/canvas/CanvasBackground';
import { useClaimGesture } from '../components/gestures/useGestureState';
import { useClaimedGestures } from '../components/canvas/canvasHooks';

const meta = {
	title: 'gestures',
	argTypes: {},
	parameters: {
		controls: { expanded: true },
	},
} satisfies Meta;

export default meta;

export const ContinuousClaimGestures: StoryObj = {
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
		return (
			<>
				<ViewportRoot className="outer" viewport={viewport}>
					<CanvasRoot canvas={canvas}>
						<CanvasBackground className="background" />
						<GestureTester />
					</CanvasRoot>
				</ViewportRoot>
			</>
		);
	},
};

function GestureTester() {
	useClaimGesture(
		'tool',
		'tester',
		(state) => {
			return state.touchesCount === 1;
		},
		{
			onCanvas: true,
		},
	);

	const [active, setActive] = useState(false);
	useClaimedGestures(
		{
			onDragStart: () => {
				setActive(true);
			},
			onDrag: (info, tools) => {
				if (info.touchesCount > 1) {
					tools.abandon();
					console.log('abandoning (pinched)');
				}
			},
			onDragEnd: (info) => {
				setActive(false);
			},
			onAbandon: () => {
				setActive(false);
			},
		},
		'tester',
	);
	return (
		<div
			style={{
				position: 'absolute',
				width: 100,
				height: 100,
				background: active ? 'green' : 'red',
				top: 100,
				left: 100,
			}}
		/>
	);
}
