import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useContainerElement } from '../canvas/canvasHooks.js';

export const ContainerPortal = ({
	children,
	containerId,
}: {
	children: ReactNode;
	containerId: string | null;
}) => {
	const containerElement = useContainerElement(containerId);

	if (containerId && !containerElement) {
		console.warn('ContainerPortal: container not found', containerId);
		return null;
	}
	if (!containerElement) return children;

	return createPortal(children, containerElement);
};
