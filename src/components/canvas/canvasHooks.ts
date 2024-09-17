import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { atom } from 'signia';
import { useSnapshot } from 'valtio';
import { BoundsRegistryEntry } from '../../logic/BoundsRegistry.js';
import {
	CanvasGestureInfo,
	CanvasGestureInput,
	ContainerData,
	ObjectData,
} from '../../logic/Canvas.js';
import { useCanvas } from './CanvasProvider.js';
import { gestureState } from '../gestures/useGestureState.js';

export function useObjectEntry(objectId: string) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.bounds.subscribe('entryReplaced', (id) => {
				if (id === objectId) cb();
			}),
		() =>
			canvas.bounds.get(objectId) as BoundsRegistryEntry<
				ObjectData<any>
			> | null,
	);
}

export function useContainerEntry(containerId: string) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.bounds.subscribe('entryReplaced', (id) => {
				if (id === containerId) cb();
			}),
		() =>
			canvas.bounds.get(containerId) as BoundsRegistryEntry<
				ContainerData<any>
			> | null,
	);
}

export function useObjectElement(objectId: string | null) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.bounds.subscribe('elementChanged', (id) => {
				if (id === objectId) cb();
			}),
		() => (objectId ? (canvas.bounds.get(objectId)?.element ?? null) : null),
	);
}

export const useContainerElement = useObjectElement;

export function useObjectIds() {
	const canvas = useCanvas();
	const [ids, setIds] = useState<string[]>(() => canvas.bounds.ids);
	useEffect(() => {
		return canvas.bounds.subscribe('observedChange', () => {
			setIds(canvas.bounds.ids);
		});
	}, [canvas.bounds]);

	return ids;
}

export function useCanvasGestures(handlers: {
	onDragStart?: (info: CanvasGestureInfo) => void;
	onDrag?: (info: CanvasGestureInfo) => void;
	onDragEnd?: (info: CanvasGestureInfo) => void;
	onTap?: (info: CanvasGestureInfo) => void;
}) {
	const canvas = useCanvas();
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		const unsubs = [
			canvas.subscribe('canvasDragStart', (info) => {
				handlersRef.current.onDragStart?.(info);
			}),
			canvas.subscribe('canvasDrag', (info) => {
				handlersRef.current.onDrag?.(info);
			}),
			canvas.subscribe('canvasDragEnd', (info) => {
				handlersRef.current.onDragEnd?.(info);
			}),
			canvas.subscribe('canvasTap', (info) => {
				handlersRef.current.onTap?.(info);
			}),
		];

		return () => {
			unsubs.forEach((fn) => fn());
		};
	}, [canvas]);
}

export function useClaimedGestures(
	handlers: {
		onDragStart?: (info: CanvasGestureInput) => void;
		onDrag?: (info: CanvasGestureInput) => void;
		onDragEnd?: (info: CanvasGestureInput) => void;
		onTap?: (info: CanvasGestureInput) => void;
	},
	objectId: string,
) {
	const canvas = useCanvas();
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		const unsubs = [
			canvas.subscribe('claimedDragStart', (info) => {
				const selected = canvas.selections.selectedIds.has(objectId);
				if (
					(selected && gestureState.claimType === 'object') ||
					info.targetId === objectId
				) {
					handlersRef.current.onDragStart?.(info);
				}
			}),
			canvas.subscribe('claimedDrag', (info) => {
				const selected = canvas.selections.selectedIds.has(objectId);
				if (
					(selected && gestureState.claimType === 'object') ||
					info.targetId === objectId
				) {
					handlersRef.current.onDrag?.(info);
				}
			}),
			canvas.subscribe('claimedDragEnd', (info) => {
				const selected = canvas.selections.selectedIds.has(objectId);
				if (
					(selected && gestureState.claimType === 'object') ||
					info.targetId === objectId
				) {
					handlersRef.current.onDragEnd?.(info);
				}
			}),
			canvas.subscribe('claimedTap', (info) => {
				if (info.targetId === objectId) {
					handlersRef.current.onTap?.(info);
				}
			}),
		];

		return () => {
			unsubs.forEach((fn) => fn());
		};
	}, [canvas, objectId]);
}

export function useIsSelected(objectId: string) {
	const canvas = useCanvas();
	const selected = useSyncExternalStore(
		(cb) => canvas.selections.subscribe(`change:${objectId}`, cb),
		() => canvas.selections.selectedIds.has(objectId),
	);
	const exclusive = useSyncExternalStore(
		(cb) => canvas.selections.subscribe('change', cb),
		() =>
			canvas.selections.selectedIds.size === 1 &&
			canvas.selections.selectedIds.has(objectId),
	);
	const pending = useSyncExternalStore(
		(cb) => canvas.selections.subscribe(`pendingChange:${objectId}`, cb),
		() => canvas.selections.pendingIds.has(objectId),
	);

	return { selected, exclusive, pending };
}

export function useIsPendingSelection(objectId: string) {
	const canvas = useCanvas();
	const [pending, setPending] = useState(() =>
		canvas.selections.pendingIds.has(objectId),
	);
	useEffect(() => {
		return canvas.selections.subscribe(`pendingChange:${objectId}`, setPending);
	}, [canvas.selections, objectId]);

	return pending;
}

export function useSelectedObjectIds() {
	const canvas = useCanvas();
	const [selectedIds, setSelectedIds] = useState(() =>
		Array.from(canvas.selections.selectedIds),
	);

	useEffect(() => {
		return canvas.selections.subscribe('change', setSelectedIds);
	}, [canvas.selections]);

	return selectedIds;
}

export function useCanvasLimits() {
	const canvas = useCanvas();
	return canvas.limits;
}

export function useDragLocked() {
	const canvas = useCanvas();
	return useSnapshot(canvas.tools).dragLocked;
}

export function useBoxSelectEnabled() {
	const canvas = useCanvas();
	return useSnapshot(canvas.tools).boxSelect;
}

export const ZERO_CENTER = atom('zero center', { x: 0, y: 0 });
export const ZERO_BOUNDS = atom('zero bounds', {
	width: 0,
	height: 0,
});
