import { BoxRegion, BoxRegionFilterFn } from './BoxRegion.jsx';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { Vector2 } from '../../types.js';
import { useCallback } from 'react';
import { GestureClaimDetail } from '../gestures/useGestureState.js';

export interface BoxSelectProps {
	className?: string;
	onCommit?: (surfaceIds: Array<string>, endPosition: Vector2) => void;
}

const filter: BoxRegionFilterFn = (entry) => {
	return entry.data.type === 'surface' && !entry.data.disableSelect.current;
};

export function BoxSelect({ className, onCommit }: BoxSelectProps) {
	const canvas = useCanvas();

	const claimGesture = useCallback(
		(event: GestureClaimDetail) => {
			if (event.isLeftMouse) return true;
			// touch box select is enabled via a control
			if (canvas.tools.boxSelect) return true;
			return false;
		},
		[canvas],
	);

	return (
		<BoxRegion
			onPending={(surfaceIds, info) => {
				canvas.selections.setPending(surfaceIds);
			}}
			onEnd={(surfaceIds, info) => {
				if (info.shift) {
					canvas.selections.addAll(surfaceIds);
				} else {
					canvas.selections.set(surfaceIds);
				}
				onCommit?.(surfaceIds, info.pointerWorldPosition);
			}}
			className={className}
			claimGesture={claimGesture}
			filter={filter}
		/>
	);
}
