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

	const containerElement = useSyncExternalStore(
		(cb) =>
			canvas.containers.subscribe(`elementChanged`, (id) => {
				if (id === containerId) cb();
			}),
		() => (containerId ? canvas.containers.get(containerId)?.element : null),
	);

	if (disabled) return children;
	if (containerId && !containerElement) {
		console.warn('ContainerPortal: container not found', containerId);
		return null;
	}
	if (!containerElement) return children;

	return createPortal(children, containerElement);
};
