import { ReactNode, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useCanvas } from '../CanvasProvider.js';

export const ContainerPortal = ({
	children,
	containerId,
	disabled,
}: {
	children: ReactNode;
	containerId: string | null;
	disabled?: boolean;
}) => {
	const canvas = useCanvas();

	const container = useSyncExternalStore(
		(cb) => canvas.subscribe(`containerRegistered:${containerId}`, cb),
		() => (containerId ? canvas.containers.get(containerId) : null),
	);
	const containerElement = useSyncExternalStore(
		(cb) => container?.subscribe('elementChange', cb) ?? (() => {}),
		() => container?.element,
	);

	if (disabled) return children;
	if (containerId && !containerElement) {
		console.warn('ContainerPortal: container not found', containerId);
		return null;
	}
	if (!containerElement) return children;

	return createPortal(children, containerElement);
};
