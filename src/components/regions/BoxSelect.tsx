import { BoxRegion } from './BoxRegion.jsx';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { Vector2 } from '../../types.js';

export interface BoxSelectProps {
	className?: string;
	onCommit?: (objectIds: Set<string>, endPosition: Vector2) => void;
}

export function BoxSelect({ className, onCommit }: BoxSelectProps) {
	const canvas = useCanvas();

	return (
		<BoxRegion
			onPending={(objectIds, info) => {
				canvas.selections.setPending(objectIds);
			}}
			onEnd={(objectIds, info) => {
				console.log('box select end', objectIds);
				if (info.shift) {
					canvas.selections.addAll(objectIds);
				} else {
					canvas.selections.set(objectIds);
				}
				onCommit?.(objectIds, info.worldPosition);
			}}
			className={className}
		/>
	);
}
