import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useContainerElement } from '../canvas/canvasHooks.js';

export const ContainerPortal = ({
	children,
	containerId,
	disabled,
}: {
	children: ReactNode;
	containerId: string | null;
	disabled?: boolean;
}) => {
	const containerElement = useContainerElement(containerId);

	if (disabled) return children;
	if (containerId && !containerElement) {
		console.warn('ContainerPortal: container not found', containerId);
		return null;
	}
	if (!containerElement) return children;

	return createPortal(children, containerElement);
};
