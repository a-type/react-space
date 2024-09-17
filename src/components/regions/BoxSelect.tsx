import { BoxRegion, BoxRegionFilterFn } from './BoxRegion.jsx';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { Vector2 } from '../../types.js';
import { useCallback } from 'react';
import { GestureClaimDetail } from '../gestures/useGestureState.js';
import { BoundsRegistryEntry } from '../../logic/BoundsRegistry.js';
import { ContainerData, ObjectData } from '../../logic/Canvas.js';

export interface BoxSelectProps {
	className?: string;
	onCommit?: (objectIds: Array<string>, endPosition: Vector2) => void;
}

const filter: BoxRegionFilterFn = (entry) => {
	return entry.data.type === 'object' && !entry.data.disableSelect.current;
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
			onPending={(objectIds, info) => {
				canvas.selections.setPending(objectIds);
			}}
			onEnd={(objectIds, info) => {
				if (info.shift) {
					canvas.selections.addAll(objectIds);
				} else {
					canvas.selections.set(objectIds);
				}
				onCommit?.(objectIds, info.pointerWorldPosition);
			}}
			className={className}
			claimGesture={claimGesture}
			filter={filter}
		/>
	);
}
