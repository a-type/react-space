import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useContainerElement } from '../canvas/canvasHooks.js';
import { Signal } from 'signia';
import { useValue } from 'signia-react';

export const ContainerPortal = ({
	children,
	containerId,
	// disabledSignal,
}: {
	children: ReactNode;
	containerId: string | null;
	// disabledSignal: Signal<boolean>;
}) => {
	const containerElement = useContainerElement(containerId);
	// const disabled = useValue(disabledSignal);

	// if (disabled) return children;
	if (containerId && !containerElement) {
		console.warn('ContainerPortal: container not found', containerId);
		return null;
	}
	if (!containerElement) return children;

	return createPortal(children, containerElement);
};
